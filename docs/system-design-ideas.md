# System Design Ideas

Collection of design ideas for the NSE Stock Scanner. Each idea is explored independently. Once all ideas are finalized, we'll check inter-dependencies and refine before implementing.

---

## Idea 1: Idempotent Alert Writes (SET NX Guard)

### Status: Explored — Ready for implementation

### Problem

`addAlert()` in `src/lib/store.ts` uses a non-atomic read-modify-write pattern:

```
loadAlerts() → search for duplicate → push new alert → saveAlerts()
```

Two concurrent Vercel Lambda invocations (e.g., auto-check timer + manual scan) can both read the same snapshot, both detect the same breakout, and both write — resulting in duplicates or lost writes. The dedup check happens in-memory against a stale snapshot, not atomically in Redis.

### Current Dedup

- Key: `symbol + alertType + YYYY-MM-DD` (date only, one alert per type per day)
- Location: `src/lib/store.ts` lines 178-192
- Pattern: Array `.find()` on full alert list loaded from Redis
- No atomic Redis operations (no SET NX, no MULTI/EXEC)

### Proposed Solution

**Hybrid approach**: Use Redis `SET NX` as an atomic guard *before* the existing array write. Keep the current array storage model (no dashboard changes needed).

**Dedup granularity**: Per candle / time window (not just per day). A stock that breaks out at 10:30 and again at 14:00 should fire two alerts.

### Design

```
1. Generate deterministic lock key:
   "alert-lock:{symbol}:{alertType}:{date}:{timeWindow}"
   e.g., "alert-lock:RELIANCE:breakout:2026-03-04:10:30"

2. Redis SET NX with TTL:
   SET alert-lock:RELIANCE:breakout:2026-03-04:10:30 "1" EX 1800 NX
   (EX 1800 = 30-minute expiry, NX = only if not exists)

3. If SET NX returns OK → proceed with addAlert() array write
4. If SET NX returns null → skip (already fired in this window)
```

### Time Window Logic

- Round the exchange data timestamp down to the nearest 30-minute boundary
- e.g., 10:47 becomes 10:30, 11:12 becomes 11:00
- Use the exchange's data timestamp (from scan result), not system clock (avoids clock skew between serverless instances)

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/store.ts` | Add SET NX guard in `addAlert()` before the array write |
| `src/lib/types.ts` | No change needed (Alert type unchanged) |
| `src/app/api/scan/route.ts` | Ensure `scannedAt` timestamp is passed through to `addAlert()` |
| `src/app/api/nifty50/route.ts` | Same — ensure exchange timestamp flows through |

### Edge Cases

- **Redis unavailable (filesystem fallback)**: Fall back to current in-memory dedup (no SET NX). Acceptable — filesystem mode is local dev only, no concurrent Lambdas.
- **Lock key TTL**: 30 minutes matches the candle window. Keys auto-clean.
- **Day boundary**: A breakout at 15:25 and another at 09:20 next day have different date components — no collision.
- **Multiple alert types same stock**: Different `alertType` in key — no collision between breakout and ma200-touch for the same symbol.

### What This Does NOT Change

- Alert display, grouping, or styling in the frontend
- The `/api/state` endpoint or dashboard polling
- The alert array storage model (still one JSON array in `nse:alerts`)
- Activity logging

---

## Idea 2: Distributed Debounce Lock (Scan Throttling)

### Status: Explored — Ready for implementation

### Problem

No server-side guards against concurrent or redundant scans. Client-side protection is minimal:

- **Manual scan**: `scanning` state disables the button — but a page refresh resets it
- **Auto-check**: `autoCheckRunningRef` prevents overlapping checks — but only within the same browser tab, and doesn't block a simultaneous manual scan

At the server level (`POST /api/scan`), every request immediately starts a full scan against NSE. Nothing checks "is another scan already in flight?"

**The stale data spiral**: When NSE is unresponsive, scans return stale/empty data. Dad sees broken cards, spams "Run Scan", each click spawns a new Lambda that hammers an already-unresponsive NSE, making things worse.

### Current Flow

```
Dad clicks "Run Scan"
  -> Client: if scanning, button disabled (UI-only guard)
  -> Server: POST /api/scan -- no guard, starts immediately
  -> Fetches 10+ stocks from NSE (3-5 seconds)
  -> Returns results

Dad refreshes page (scanning state resets to false)
Dad clicks "Run Scan" again
  -> Server: new Lambda, new full scan, hits NSE again
  -> Previous Lambda may still be running

Auto-check timer (every 30s) fires simultaneously
  -> Server: another Lambda, another NSE scan
  -> Three concurrent scans now hitting NSE
```

### Proposed Solution

Acquire a Redis lock before scanning. If lock is held, return cached results instantly.

### Design

```
POST /api/scan arrives

lockKey = "scan-lock:manual" (or "scan-lock:auto" for auto-checks)
requestId = crypto.randomUUID()

SET scan-lock:manual <requestId> NX EX 30

Acquired (OK)?
  YES -> run full scan -> return fresh results
  NO  -> return getScanResults() from Redis (last cached results)
         + flag: { cached: true, lockHeld: true }
```

### Lock Key Design

Two separate locks for the two scan paths:

| Lock Key | Used By | Rationale |
|----------|---------|-----------|
| `scan-lock:manual` | Manual "Run Scan" button | Prevents spam-clicking after refresh |
| `scan-lock:auto` | Auto-check (30s timer) | Prevents overlapping auto-checks across tabs |

Manual and auto scans use **separate locks** because:
- Auto-checks scan only close-watch stocks (small subset)
- Manual scans cover the full watchlist
- A running auto-check shouldn't block a manual full scan (different scope)

### TTL: 30 Seconds

- Matches the auto-check interval (30s)
- A typical scan takes 3-5s — 30s covers even slow scans with margin
- If a Lambda crashes mid-scan, lock auto-releases after 30s (no deadlock)
- Short enough that dad waits at most 30s before a fresh scan is possible

### UX When Lock Is Held

> **Decision: Option C — Loading state with countdown.** Show a spinner or progress bar with "Scan in progress... try again in ~Xs" (using `lockExpiresIn` from the response). Most informative, prevents further spam-clicking.

The API response includes flags for whichever UX approach is chosen:

```json
{ "results": [...], "cached": true, "lockHeld": true, "lockExpiresIn": 22 }
```

### Files to Modify

#### Backend (server-side logic)

| File | Change |
|------|--------|
| `src/app/api/scan/route.ts` | Add lock acquisition at top of POST handler; return cached on lock-held |
| `src/lib/store.ts` | Add helper for `acquireLock(key, ttl)` / `releaseLock(key, id)` using SET NX |

#### Frontend (UI components) — handoff-ready for a UI developer

> **UI Developer scope**: Only files in `src/components/` need to change. Do not modify anything in `src/lib/`, `src/app/api/`, or `src/middleware.ts`.
>
> The API will return `{ cached: true, lockHeld: true, lockExpiresIn: number }` when a scan was debounced. Your job is to handle this response gracefully in the dashboard UI.

| File | Change |
|------|--------|
| `src/components/dashboard.tsx` | Detect `lockHeld` flag in scan response; trigger chosen UX pattern (toast, timer, disabled button) |
| `src/components/scan-button.tsx` (if extracted) | Optional: extract scan button into its own component with cooldown/disabled state |

### Edge Cases

- **Redis unavailable**: Skip lock, run scan as today (local dev has no concurrent Lambdas)
- **Scan finishes early**: Lock remains until TTL expires. Could optionally release early with compare-and-delete, but adds complexity for marginal benefit
- **Nifty 50 scans**: `/api/nifty50` could use its own `scan-lock:nifty50` — same pattern, independent lock
- **Lock contention visibility**: Log when a scan is skipped due to lock in the activity feed

### Relationship to Idea 1

Complementary, not overlapping:
- **Idea 1 (Idempotent Writes)**: Prevents the *same alert* from being written twice (alert level)
- **Idea 2 (Debounce Lock)**: Prevents the *same scan* from running twice (scan level)
- Together: the lock reduces redundant NSE calls, idempotent writes catch any alerts that still slip through

### What This Does NOT Change

- Alert dedup logic (that's Idea 1)
- Scan detection algorithms (breakout, MA touch, etc.)
- Baseline computation or caching
- Auth or middleware

---

## Idea 3: Event-Sourced Activity Timeline (Redis Streams)

### Status: Future — implement after Ideas 1 & 2 are proven

### Problem

`activity.ts` uses the same non-atomic read-modify-write pattern as alerts:
- Load full 200-event JSON array from Redis
- Prepend new event, truncate to 200
- Save entire array back

This means: concurrent Lambdas can overwrite each other's events (lost writes), old events are silently dropped at 200, and there's no way to query events by time range for debugging.

### Current System

- Storage: single JSON array in Redis key `nse:activity` (max 200 events)
- 24 `addActivity()` call sites across the codebase
- Public API: `addActivity(cat, action, label, opts)` and `getActivity(limit)`
- Filesystem fallback for local dev (`data/activity.json`)

### Proposed Solution

Replace the storage layer in `activity.ts` with Redis Streams. Keep the same public API.

### Design

**Writes** — replace `r.set(ACTIVITY_KEY, events)` with:
```
XADD nse:activity-stream * cat "system" action "scan-manual" label "Scanned 10 stocks" ...
XTRIM nse:activity-stream MAXLEN ~ 1000
```

**Reads** — replace `r.get<ActivityEvent[]>(ACTIVITY_KEY)` with:
```
XREVRANGE nse:activity-stream + - COUNT 50
```

**Time-range queries** (new capability):
```
XRANGE nse:activity-stream <start-timestamp> <end-timestamp>
```

### Key Benefits

- **Atomic writes**: Each `XADD` is independent — no read-modify-write, no lost events
- **Debuggability**: "Why didn't RELIANCE alert at 11:30?" becomes queryable by time range
- **Higher retention**: 1000 events vs 200, with approximate trimming
- **Ordered by default**: Redis Stream IDs have microsecond precision

### Scope Boundaries

- Change **only** the internals of `activity.ts` — `addActivity()` and `getActivity()` signatures unchanged
- Do NOT wire into `logger.ts` — logger is for console output, activity is for user-facing feed
- Keep filesystem fallback as-is for local dev (no Streams equivalent on filesystem)
- No new `addActivity()` call sites in this phase (granular scan-step events like BASELINE_LOADED, VOLUME_CHECK can be added later)

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/activity.ts` | Replace `loadEvents`/`saveEvents` internals with `XADD`/`XREVRANGE` |
| `src/lib/types.ts` | No change — `ActivityEvent` type stays the same |

### Why Future (Not Now)

- Ideas 1 & 2 use simple `SET NX` — a well-understood Redis pattern
- Streams are a different Redis data structure with a larger API surface
- Current activity system works; it's just not optimal under concurrency
- Better to prove the SET NX patterns first, then upgrade activity storage

---

## Idea 4: Visibility-Aware Polling (Pause When Tab Hidden)

### Status: Explored — Ready for implementation

### Problem

The auto-check timer (`setInterval(runCloseWatchCheck, 30_000)` at `dashboard.tsx:207`) runs continuously during market hours regardless of whether the tab is visible. If dad opens the dashboard at 9:15 AM and switches to another tab:

- **No `visibilitychange` listener exists** — polling continues in the background
- Browsers throttle background `setInterval` to ~1/minute (Chrome), but that's still ~360 wasted Lambda invocations across a full trading day
- Each invocation hits NSE, consumes Vercel execution time, and can trigger stale data cascades

### Current Behavior

```
Tab visible, market open, close-watch stocks exist:
  -> setInterval fires every 30s -> hits /api/scan -> hits NSE

Dad switches to another tab:
  -> setInterval still fires (throttled to ~1/min by browser)
  -> ~360 unnecessary scans over 6 hours
  -> Nobody sees the results
```

### Proposed Solution

Listen for `visibilitychange` events. Pause the auto-check interval when the tab is hidden, resume when visible.

### Design

```
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Tab backgrounded -> clear interval
    clearInterval(autoCheckTimerRef.current)
    autoCheckTimerRef.current = null
  } else {
    // Tab foregrounded -> run one immediate check + restart interval
    runCloseWatchCheck()
    autoCheckTimerRef.current = setInterval(runCloseWatchCheck, 30_000)
  }
})
```

### Additional Consideration: Nifty 50 Polling

Check if the Nifty 50 table/ticker also polls on an interval. If so, apply the same visibility pause.

### Files to Modify

#### Frontend only — handoff-ready for a UI developer

> **UI Developer scope**: Only `src/components/dashboard.tsx` changes. No backend modifications.

| File | Change |
|------|--------|
| `src/components/dashboard.tsx` | Add `visibilitychange` listener in the auto-check `useEffect`; clear/restart interval based on `document.hidden` |

### Edge Cases

- **Tab becomes visible after market close**: The existing `isMarketHours()` check (line 79) already handles this — auto-check won't restart if market is closed
- **Multiple tabs open**: Each tab manages its own interval independently (combined with Idea 2's debounce lock, only one scan actually executes)
- **Mobile browser backgrounding**: `visibilitychange` fires reliably on mobile — same behavior
- **Page reload while hidden**: No issue — fresh page load re-evaluates from scratch

### Relationship to Other Ideas

- **Complements Idea 2 (Debounce Lock)**: Idea 4 reduces unnecessary requests at the client; Idea 2 catches any that still overlap at the server. Defense in depth.
- **Independent of Ideas 1 & 3**: No shared code or conflicts.

### What This Does NOT Change

- Scan logic, alert detection, or persistence
- Backend API routes
- Manual scan behavior (only affects the auto-check timer)

---

## Idea 5: Backpressure on Polling (Adaptive Poll Interval)

### Status: Explored — Ready for implementation

### Problem

The auto-check polling interval is hardcoded at 30 seconds (`setInterval(runCloseWatchCheck, 30_000)` at `dashboard.tsx:207`). It never adapts to backend health. When NSE is timing out or returning 403s:

- Scans take 10-15s instead of 3-5s, all returning stale data
- The next auto-check fires 30s later regardless — hitting an already-struggling NSE
- Dad sees broken cards, spam-clicks "Run Scan" (Idea 2 handles concurrent scans, but sequential scans still fire every 30s)
- No feedback loop exists between server health and client polling frequency

### Current Behavior

```
NSE healthy:
  Auto-check every 30s -> scan takes 3s -> 10/10 stocks live -> next check in 30s

NSE struggling:
  Auto-check every 30s -> scan takes 12s -> 7/10 stale -> next check in 30s
  Auto-check every 30s -> scan takes 15s -> 10/10 stale -> next check in 30s
  (client keeps hammering at the same rate)
```

The server already knows NSE is struggling — it tracks `staleCount`, `liveCount`, and scan duration in every response. It just doesn't communicate "slow down" to the client.

### Proposed Solution

Add a `nextPollMs` field to the scan API response. The client reads this and adjusts its auto-check interval dynamically.

### Design

**Server-side logic** (in `scan/route.ts`, after scan completes):

```
Compute nextPollMs based on scan health:

  All live, scan < 5s      -> nextPollMs: 30_000   (normal — 30s)
  Some stale (< 50%)       -> nextPollMs: 60_000   (back off — 1 min)
  Mostly stale (>= 50%)    -> nextPollMs: 120_000  (heavy backoff — 2 min)
  Scan error (500 response) -> nextPollMs: 180_000  (max backoff — 3 min)

Include in response:
{ results, alerts, scannedAt, marketOpen, cacheStats, nextPollMs }
```

**Client-side logic** (in `dashboard.tsx`, after auto-check response):

```
const nextPollMs = response.nextPollMs ?? 30_000;  // fallback to default

// If interval changed, reschedule
if (nextPollMs !== currentIntervalMs) {
  clearInterval(autoCheckTimerRef.current);
  autoCheckTimerRef.current = setInterval(runCloseWatchCheck, nextPollMs);
  currentIntervalMs = nextPollMs;
}
```

### Backoff Tiers

| Condition | `nextPollMs` | Rationale |
|-----------|-------------|-----------|
| All stocks live, scan fast | 30,000 (30s) | Normal operation — no reason to slow down |
| Some stale (< 50% of stocks) | 60,000 (1 min) | NSE partially responsive — ease off |
| Mostly stale (>= 50%) or scan > 10s | 120,000 (2 min) | NSE struggling — significant backoff |
| Scan error (entire scan failed) | 180,000 (3 min) | NSE down — max backoff, avoid pile-up |

**Recovery**: When NSE recovers (next scan returns all live), `nextPollMs` drops back to 30s immediately. No gradual ramp-up needed — the server re-evaluates every scan.

### Scope: Scan Route + Dashboard Auto-Check Only

This idea is scoped to:
- **Backend**: `POST /api/scan` response only
- **Frontend**: `dashboard.tsx` auto-check interval only

**Not in scope** (can be extended later):
- Nifty 50 table polling (`nifty50-table.tsx`)
- Nifty 50 rail polling (`nifty50-rail.tsx`)
- Ticker panel polling (`ticker-panel.tsx`)

These components poll different endpoints (`/api/nifty50`, `/api/ticker`) and serve cached data on failure anyway — lower stakes.

### Files to Modify

#### Backend

| File | Change |
|------|--------|
| `src/app/api/scan/route.ts` | Compute `nextPollMs` from `staleCount`/`liveCount`/scan duration; add to response |
| `src/lib/types.ts` | Add `nextPollMs` to `ScanResponse` type |

#### Frontend — handoff-ready for a UI developer

> **UI Developer scope**: Only `src/components/dashboard.tsx` changes. The scan API response will include `nextPollMs: number`. Your job is to use this value to reschedule the auto-check interval.

| File | Change |
|------|--------|
| `src/components/dashboard.tsx` | Read `nextPollMs` from scan response; reschedule `setInterval` when value changes |

### Edge Cases

- **Redis unavailable (filesystem fallback)**: `nextPollMs` still computed from scan results — works the same
- **Manual scan (not auto-check)**: Response includes `nextPollMs` but the client ignores it for manual scans (manual scans don't use the interval timer)
- **First scan of the session**: No previous `nextPollMs` — client starts with default 30s
- **Tab hidden (Idea 4)**: Interval is cleared entirely when tab is hidden. On visibility restore, the new interval uses the last-known `nextPollMs`
- **Lock held (Idea 2)**: When a debounce lock returns cached results, `nextPollMs` should reflect the cached scan's health (not recompute)

### Relationship to Other Ideas

- **Strengthens Idea 2 (Debounce Lock)**: Lock is a hard ceiling (one scan at a time). Backpressure is a soft throttle (space out sequential scans). Together: no concurrent scans AND slower sequential scans when NSE is struggling.
- **Strengthens Idea 4 (Visibility Pause)**: Visibility pause stops background polling entirely. Backpressure slows foreground polling. Different failure modes, both covered.
- **Independent of Ideas 1 and 3**: No shared code or conflicts.

### What This Does NOT Change

- Alert detection logic or thresholds
- Scan algorithms (breakout, MA touch, etc.)
- Manual scan behavior (only affects auto-check timer)
- Nifty 50 or ticker polling intervals (future scope)

---

## Idea 6: Circuit Breaker on NSE Calls

### Status: Future — real but narrow gap after Ideas 2 + 5

### Problem

If NSE's Cloudflare protection starts returning 403s or the API is in sustained outage, even the reduced polling from Ideas 2 + 5 still sends requests — one every 2-3 minutes. Over hours, this could risk an IP ban from Cloudflare.

### Why It's Narrow

With Ideas 2 + 4 + 5 combined:
- Idea 4 stops background tab polling entirely
- Idea 2 prevents concurrent scans
- Idea 5 backs off to 3 min max when NSE is struggling

The circuit breaker adds value in one specific scenario: **sustained outage where even 1 call per 3 minutes risks an IP ban from Cloudflare**. In normal intermittent failures, Ideas 2 + 5 are sufficient.

### What It Would Do

Track consecutive NSE failures in Redis. After N failures (e.g., 5), "open" the circuit for a cooldown period (e.g., 5 minutes). While open, all NSE calls return cached/stale data immediately without hitting NSE.

### Why It Lives in `nse-client.ts`, Not `scan/route.ts`

The circuit breaker protects **all** NSE calls globally — not just the scan route:
- `/api/scan` (watchlist scans)
- `/api/nifty50` (Nifty 50 snapshot)
- `/api/ticker` (index data)
- `/api/index` (Nifty 50 index value)
- Baseline computation (`getHistoricalData`)

Ideas 2 and 5 only protect the scan route. The circuit breaker wraps the `withRetry` function in `nse-client.ts` — one guard for everything.

### Design Sketch

```
Before any NSE call (inside withRetry):

1. Check Redis: GET nse:circuit-breaker
   - If value = "open" and TTL remaining -> return cached/throw immediately
   - If absent or expired -> proceed

2. Call NSE
   - Success -> INCR nse:circuit-ok (reset failure counter)
   - Failure -> INCR nse:circuit-fail

3. If nse:circuit-fail >= 5:
   SET nse:circuit-breaker "open" EX 300 (5-minute cooldown)
   Log to activity feed: "Circuit breaker opened — pausing NSE calls for 5 minutes"
```

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/nse-client.ts` | Add circuit breaker check inside `withRetry`; Redis-backed state |

### Relationship to Other Ideas

- **Extends Ideas 2 + 5**: Lock prevents concurrent scans, backpressure slows sequential scans, circuit breaker stops all NSE calls entirely during sustained outages. Three tiers of protection.
- **Independent of Ideas 1, 3, 4**: No shared code or conflicts.

### Why Future (Not Now)

- Ideas 2 + 5 handle 95% of the overload scenarios
- The Cloudflare IP ban risk is real but has never actually happened yet
- Adds complexity to `nse-client.ts` (a do-not-modify-lightly file)
- Better to observe how Ideas 2 + 5 perform in production first, then add this if needed

---

## Idea 7: Telegram / Push Notifications with Async Dispatch

### Status: Future — will implement (notification feature not yet built)

### Problem

Currently, all alert notifications are **browser-only** -- the client fires `new Notification()` after comparing scan results (`dashboard.tsx:523-566`). If dad doesn't have the browser tab open, he misses the alert entirely.

Goal: Send alerts via Telegram (and/or Web Push) so dad gets notified even when the app isn't open.

### Current Alert Flow

```
Scan route (server):
  detect breakout -> addAlert() to Redis -> addActivity() to Redis -> return response

Dashboard (client):
  receive response -> compare with previous alerts -> new Notification() in browser
```

No server-side dispatch exists. The server stores the alert, the client shows it. If the tab is closed, the notification is lost.

### Design Decision: How to Dispatch

When adding Telegram, the key question is whether notification dispatch blocks the scan response.

| Approach | Pros | Cons |
|----------|------|------|
| **A. Inline** -- call Telegram API inside `scan/route.ts` | Simple | Blocks scan response by 200-500ms per alert |
| **B. Queue + Dispatcher** -- push to `queue:alerts` Redis List, separate worker pops and sends | Fully decoupled, scan stays fast | Overengineered for single user; needs a dispatcher mechanism |
| **C. Client-triggered** -- scan returns new alerts, client calls `/api/notify` | Scan stays fast, simple, no queue | Requires tab to be open (but auto-check already requires this) |

**Recommended: Option C** for a single-user app. The auto-check already requires the tab to be open. When a scan returns new alerts, the client calls a `/api/notify` endpoint that sends the Telegram message. No queue, no worker, scan stays fast.

If auto-check moves to server-side cron in the future, upgrade to Option B.

### Implementation Sketch

**New endpoint**: `POST /api/notify`

```
Input: { alerts: Alert[] }
For each alert:
  -> POST https://api.telegram.org/bot<TOKEN>/sendMessage
     { chat_id: DAD_CHAT_ID, text: formatAlert(alert), parse_mode: "HTML" }
```

**Client change** (in `dashboard.tsx`):

```
After scan response, if newAlerts.length > 0:
  -> POST /api/notify with new alerts
  -> Fire and forget (don't block UI)
```

**Env vars needed**:
- `TELEGRAM_BOT_TOKEN` -- from BotFather
- `TELEGRAM_CHAT_ID` -- dad's chat ID

### Files to Modify

| File | Change |
|------|--------|
| `src/app/api/notify/route.ts` | **New file** -- Telegram dispatch endpoint |
| `src/components/dashboard.tsx` | Call `/api/notify` after scan returns new alerts |
| `.env.example` | Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |

### Relationship to Other Ideas

- **Independent of Ideas 1-6**: No shared code or conflicts
- **Idea 5 (Backpressure) interaction**: During NSE outages, fewer alerts fire -> fewer Telegram calls. Natural backpressure.
- **Idea 4 (Visibility Pause) interaction**: If tab is hidden, no auto-check runs -> no alerts detected -> no Telegram calls. If Telegram notifications are critical even when tab is closed, this motivates moving auto-check to a server-side cron (separate future idea).

### Why Future (Not Now)

- Requires Telegram bot setup (BotFather, chat ID)
- The browser notification system works for now since dad usually has the tab open
- Implementation is straightforward once the bot is created -- can be done in isolation

---

## Idea 8: Holiday-Aware Market Gating

### Status: Explored -- Ready for implementation

### Problem

`isMarketHours()` and `isExtendedHours()` in `market-hours.ts` only check weekends and time-of-day. On NSE holidays (Republic Day, Diwali, etc.) that fall on weekdays, the system:

- Thinks the market is open (it's a weekday between 09:15-15:30)
- Fires `getMarketStatus()` API calls every minute to check -- wastes ~420 API calls
- Attempts scans that return stale data
- Triggers stale suppression (so no false alerts), but wastes Vercel execution time and NSE API quota

### Current Behavior

```
Holiday (weekday), 10:00 IST:
  isMarketHours()    -> true   (it's a weekday, 10:00 is in range)
  isExtendedHours()  -> true
  getMarketStatus()  -> API call -> NSE returns "closed"
  scanStock()        -> attempts live fetch -> gets stale data -> suppressed

Repeats every 30s for the entire 09:00-16:00 window.
```

### Proposed Solution

Fetch the NSE holiday calendar once daily via `getHolidaysBySegment()` (already available in `stock-nse-india` library). Store in Redis. Check before any scan or polling decision.

### Design

**Holiday data source** -- `stock-nse-india` provides:

```typescript
interface Holiday {
  tradingDate: string;   // e.g., "26-Jan-2026"
  weekDay: string;       // e.g., "Monday"
  description: string;   // e.g., "Republic Day"
  Sr_no: number;
}

interface HolidaysBySegment {
  [segment: string]: Holiday[];  // "CM" = Capital Market
}
```

**Redis storage**:

```
Key:   nse:holidays:2026
Value: JSON array of date strings ["2026-01-26", "2026-03-14", ...]
TTL:   24 hours (refreshed daily)
```

**Fetch + cache logic** (in `nse-client.ts` or `market-hours.ts`):

```
async function isHoliday(): boolean {
  1. Check in-memory cache first (avoid Redis round-trip on every call)
  2. If miss, check Redis: GET nse:holidays:2026
  3. If miss, call getHolidaysBySegment() -> extract "CM" segment dates
     -> SET nse:holidays:2026 with 24h TTL
  4. Check if today's IST date is in the list
}
```

Two-tier cache: in-memory (free, per-instance) + Redis (shared, survives cold starts).

**Integration point** -- modify `isMarketHours()` and `isExtendedHours()`:

```
Before:  weekend check + time check
After:   weekend check + holiday check + time check
```

When `isHoliday()` returns true, the entire system goes quiet -- no scans, no polling, no NSE API calls.

### Why Redis (Not Just In-Memory)

- **Survives cold starts**: On serverless, each Lambda starts fresh. Without Redis, every cold start makes a `getHolidaysBySegment()` API call. With Redis, it's a fast key lookup.
- **Single source of truth**: If multiple Lambda instances are running, they all read the same holiday list from Redis instead of each fetching independently.
- **Low cost**: One Redis key per year. One write per day. Reads are cheap on Upstash.

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/market-hours.ts` | Add `isHoliday()` check; integrate into `isMarketHours()` and `isExtendedHours()` |
| `src/lib/nse-client.ts` | Add `fetchHolidayCalendar()` using `getHolidaysBySegment()` |

### Edge Cases

- **NSE holiday API unavailable**: Fall back to current behavior (no holiday check, proceed with `getMarketStatus()` which will return "closed" anyway)
- **Mid-year holiday additions**: NSE occasionally adds holidays. The 24h TTL ensures the list refreshes daily.
- **First request of the year**: No Redis key yet -- fetches from NSE, stores in Redis, subsequent requests are fast
- **Pre-market on holiday**: `isExtendedHours()` returns false at 08:00 regardless -- holiday check only matters during the 09:00-16:00 window

### What This Saves

On a holiday (assuming auto-check is active 09:00-16:00):
- ~420 `getMarketStatus()` API calls avoided
- ~840 scan-related NSE API calls avoided (2 calls per scan x 420 intervals)
- ~420 Vercel function invocations avoided
- NSE has ~15 holidays/year -> ~18,900 unnecessary API calls eliminated annually

### Relationship to Other Ideas

- **Strengthens Idea 5 (Backpressure)**: On holidays, no scans fire at all -- backpressure never needs to kick in
- **Strengthens Idea 4 (Visibility Pause)**: Holiday gating stops polling at the source; visibility pause stops it at the tab level. Belt and suspenders.
- **Independent of Ideas 1, 2, 3, 6, 7**: No shared code or conflicts

---

## Idea 9: (Slot reserved for next idea)

### Status: Not yet explored

---

## Inter-Dependency Analysis (Finalized)

### Shared File Map (Ready Ideas Only)

| File | Idea 1 | Idea 2 | Idea 4 | Idea 5 | Idea 8 |
|------|--------|--------|--------|--------|--------|
| `store.ts` | SET NX in `addAlert()` | `acquireLock()` helper | — | — | — |
| `scan/route.ts` | — | Lock at top of POST | — | `nextPollMs` in response | — |
| `types.ts` | — | — | — | `nextPollMs` in `ScanResponse` | — |
| `dashboard.tsx` | — | Handle `lockHeld` response (countdown UX) | `visibilitychange` listener | Read `nextPollMs`, reschedule interval | — |
| `market-hours.ts` | — | — | — | — | `isHoliday()` |
| `nse-client.ts` | — | — | — | — | `fetchHolidayCalendar()` |

### Key Overlaps

- **`dashboard.tsx`** is touched by Ideas 2, 4, and 5 -- all modify the auto-check useEffect. No conflicts, but implement in order: 4 -> 5 -> 2.
- **`scan/route.ts`** is touched by Ideas 2 and 5. Idea 2 adds lock at top, Idea 5 adds `nextPollMs` at bottom. No conflict -- implement 2 -> 5.
- **`store.ts`** is touched by Ideas 1 and 2. Different functions (`addAlert()` vs `acquireLock()`). No conflict.

### Dependency Table

| Idea | Depends On | Conflicts With | Shared Files |
|------|-----------|----------------|--------------|
| 1. Idempotent Writes | — | — | `store.ts` |
| 2. Debounce Lock | — | — | `scan/route.ts`, `store.ts`, `dashboard.tsx` |
| 3. Activity Streams | Ideas 1 & 2 proven first | — | `activity.ts` |
| 4. Visibility Pause | — | — | `dashboard.tsx` |
| 5. Backpressure | — | — | `scan/route.ts`, `types.ts`, `dashboard.tsx` |
| 6. Circuit Breaker | Ideas 2 + 5 proven first | — | `nse-client.ts` |
| 7. Telegram Notifications | — | — | `notify/route.ts` (new), `dashboard.tsx` |
| 8. Holiday Gating | — | — | `market-hours.ts`, `nse-client.ts` |

### Implementation Order (Decided)

```
Phase 1 — Independent, can be parallel:
  Idea 8: Holiday Gating        (market-hours.ts, nse-client.ts)
  Idea 1: Idempotent Writes     (store.ts)

Phase 2 — Builds on dashboard.tsx:
  Idea 4: Visibility Pause      (dashboard.tsx)
  Idea 2: Debounce Lock         (scan/route.ts, store.ts, dashboard.tsx)

Phase 3 — Builds on Idea 2's scan/route.ts changes:
  Idea 5: Backpressure          (scan/route.ts, types.ts, dashboard.tsx)

Future — after above are proven in production:
  Idea 3: Activity Streams      (activity.ts)
  Idea 6: Circuit Breaker       (nse-client.ts)
  Idea 7: Telegram Notifications (notify/route.ts, dashboard.tsx)
```

### Decisions Log

| Decision | Choice | Decided |
|----------|--------|---------|
| Idea 2 UX: what to show when scan is debounced | **Option C**: Loading state with countdown | 2026-03-07 |
