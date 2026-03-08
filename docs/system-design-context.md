# NSE Stock Scanner — System Design Context

## What it is
A personal, single-user stock breakout detection dashboard for the National Stock Exchange of India. It monitors a personal watchlist + all Nifty 50 constituents, detects unusual trading activity, and fires alerts via browser push notifications and a persistent in-app feed.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + React 18 |
| Styling | Tailwind CSS 3.4 + GSAP animations |
| Persistence | Upstash Redis (primary) + filesystem JSON (local fallback) |
| External data | `stock-nse-india` NPM package (wraps NSE India public API) |
| Auth | HMAC-SHA256 session cookies with epoch rotation |
| Validation | Zod on all API inputs |
| Testing | Vitest (node env) |
| Deployment | Vercel serverless (each API route = separate Lambda) |

---

## Three-Layer Architecture

```
src/components/   (client — "use client")
      ↓ fetch()
src/app/api/      (Next.js route handlers — HTTP coordination layer)
      ↓ import
src/lib/          (server-only business logic — import "server-only" guard)
      ↓
NSE India API  +  Upstash Redis
```

**`src/lib/`** is the core — server-only, no framework coupling. Key modules:

| Module | Responsibility |
|--------|---------------|
| `nse-client.ts` | NSE API wrapper with in-memory caching, retries, singleton pattern |
| `scanner.ts` | Breakout detection (`analyzeBreakout()`) |
| `baselines.ts` | 5-day rolling baselines (in-memory, per IST date) |
| `store.ts` | Watchlist/alert/scan result CRUD against Redis or filesystem |
| `activity.ts` | Audit trail ring buffer (max 200 events) |
| `market-hours.ts` | IST market hours gating logic |
| `lockdown.ts` | Security state (edge-compatible, session epoch) |

---

## Data Flow (Scan Path)

```
UI polls /api/state (every 30s during market hours)
User triggers /api/scan →
  scanMultipleStocks() (batches of 5, Promise.allSettled) →
    per stock: getHistoricalData() + getCurrentDayData() → NSE API
    analyzeBreakout() → ScanResult
    addAlert() → dedup check → Redis / filesystem
    addActivity() → audit trail
← dashboard receives new alerts, browser push notification fires
```

---

## Persistence Strategy

**Pattern**: Redis primary → filesystem JSON fallback (silent fail-over)

| Redis Key | Content |
|-----------|---------|
| `nse:watchlist` | `WatchlistStock[]` |
| `nse:alerts` | `Alert[]` |
| `nse:scanResults` | `ScanResult[]` |
| `nse:activity` | Ring buffer (max 200 events) |
| `nse:api-stats` | Hash of call counts / cache hits |
| `nse:security` | Epoch + lockdown flag |

Filesystem fallback lives in `data/*.json`. On Vercel (read-only FS), Redis is required.

---

## Caching Strategy

| Data | TTL | Scope |
|------|-----|-------|
| Historical prices | 1 day (IST date) | Per-instance in-memory Map |
| Nifty 50 snapshot | 3 minutes | Per-instance |
| Nifty 50 index value | 15 seconds | Per-instance |
| Market status | 1 minute | Per-instance |
| 5-day baselines | 1 day (IST date) | Per-instance |
| API stats | Flushed on each `/api/state` poll | Redis (cross-instance) |

Outside extended hours (before 09:00 / after 16:00 IST), all NSE API calls are skipped entirely.

---

## Alert System

**8 alert types**: `breakout`, `low-breakout`, `scan`, `week-high`, `ma200-touch`, `ma100-touch`, `ma50-touch`, `ma5-touch`

**Dedup key**: `symbol + alertType + date (YYYY-MM-DD)` — same combo on same calendar day is silently skipped.

**Stale suppression**: When live intraday fetch fails during market hours, `dataSource` is set to `"stale"`. All trigger conditions are forced to `false` to prevent false positives from stale data.

**Breakout condition**:
```
today.high > max(prev5d.high)  AND  today.volume >= avg(prev5d.volume) * 3
```

**MA-touch condition** (for MA5 / MA50 / MA100 / MA200):
```
touchPercent = ((currentClose - maN) / maN) * 100
triggered = Math.abs(touchPercent) <= 1%
```

---

## Auth Model

- **Two tiers**: Regular (`AUTH_USERNAME/PASSWORD`) and Admin (`ADMIN_USERNAME/PASSWORD` — can bypass lockdown)
- **Session**: HMAC-SHA256 cookie, 30-day expiry, validated in `src/middleware.ts` on every request
- **Epoch rotation**: Incrementing epoch in Redis invalidates all active sessions (used during lockdown)
- **Lockdown**: Admin-triggered mode that blocks regular users; edge-compatible implementation in `lockdown.ts`

---

## Deployment Considerations

- **Serverless**: Each API route is a separate Lambda on Vercel — no shared memory between invocations (cold start recreates NSE client instance)
- **Warm invocations** reuse the cached NSE client (in-memory caches persist within an instance's lifetime)
- **No filesystem writes on Vercel** — Redis mandatory in production
- **Market hours gating** reduces NSE API call volume significantly (no calls outside 09:00–16:00 IST)

---

## Scale / Constraints

- Single user (personal tool)
- Watchlist: unbounded but practically ~10–30 stocks
- Nifty 50: fixed 50 stocks, polled together
- NSE API: public, unauthenticated, rate-limit unknown — batched 5 at a time via `Promise.allSettled`
- No queue, no worker — scan is synchronous per HTTP request, can take 10–30s for large watchlists
