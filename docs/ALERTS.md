# Alert System

## Current Alert Types

### `breakout` (Nifty 50 Discovery)
Triggered when a Nifty 50 stock's current-day high exceeds its 5-day max high AND current-day volume exceeds 3x its 5-day average volume.

Detection: `src/lib/scanner.ts` → `analyzeBreakout()`
```
triggered = (today.high > max(prev5d.high)) AND (today.volume >= avg(prev5d.volume) * 3)
```

### `scan` (Watchlist Scan)
Same breakout logic applied to the user's personal watchlist stocks during manual or auto scans.

## Detection Logic Deep Dive

### `analyzeBreakout()` (scanner.ts)

Inputs:
- `today`: `{ high, volume, close, change }` — from live intraday or latest historical
- `previousDays`: `DayData[]` — the 5 most recent completed trading days

Outputs:
- `triggered`: boolean
- `highBreakPercent`: how far above 5-day max high
- `volumeBreakPercent`: how far above 3x threshold
- `todayClose`, `todayChange`: current price info

### Baseline Computation (baselines.ts)

`getBaseline(symbol)` computes per-symbol, per-day:
- `maxHigh5d`: max high across last 5 trading days
- `maxVolume5d`: average volume across last 5 trading days (used as denominator for 3x check)

Cached in-memory by IST date. Recomputes on cold start (once per day per symbol).

### Data Sources

| Source | When Used | Description |
|--------|-----------|-------------|
| `live` | Market open + intraday fetch succeeds | Real-time high/volume from `getEquityDetails` + `getEquityTradeInfo` |
| `historical` | Market closed, or intraday not requested | Last day from `getEquityHistoricalData` |
| `stale` | Market open but intraday fetch fails | Historical data used as fallback — triggers are SUPPRESSED |

**Stale suppression**: When `dataSource === "stale"`, `triggered` is forced to `false`. This prevents false alerts when live data is unavailable during trading hours.

## Alert Lifecycle

```
Scan triggered (manual or auto)
  → scanStock() / scanMultipleStocks()
    → analyzeBreakout() → ScanResult { triggered: true }
      → addAlert() [store.ts]
        → Dedup check: symbol + alertType + date (YYYY-MM-DD)
        → If new: push to nse:alerts, return true
        → If duplicate: skip, return false
      → addActivity() → log to audit trail
  → Dashboard receives alerts via /api/state polling
    → AlertPanel shows notification badge
    → Browser push notification (if permission granted)
```

## Dedup Strategy

`addAlert()` in `store.ts` (line 178-192) prevents duplicates:
```
existing = alerts.find(a =>
  a.symbol === alert.symbol &&
  a.alertType === alert.alertType &&
  a.triggeredAt.slice(0, 10) === alert.triggeredAt.slice(0, 10)
)
```
Same symbol + same alert type + same calendar date = duplicate → skipped.

## How to Add a New Alert Type

1. **Extend the `Alert` interface** in `src/lib/types.ts`:
   - Add the new type to `alertType?: "breakout" | "scan" | "your-new-type"`

2. **Write detection logic** in `src/lib/scanner.ts` (or a new file in `src/lib/`):
   - Function takes today's data + historical and returns whether alert should fire
   - Respect stale data suppression: if `dataSource === "stale"`, do NOT trigger

3. **Wire into scan pipeline**:
   - If it runs during regular watchlist scans: modify `scanStock()`
   - If it runs independently: create a new function and call it from the relevant API route

4. **Fire the alert**:
   ```ts
   import { addAlert } from "./store";
   const isNew = await addAlert({
     id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
     symbol,
     name,
     alertType: "your-new-type",
     // ... relevant data fields
     triggeredAt: new Date().toISOString(),
     read: false,
   });
   ```

5. **Log activity**:
   ```ts
   import { addActivity } from "./activity";
   if (isNew) {
     await addActivity("system", "alert-fired", `${symbol}: your alert description`, {
       detail: { symbol, alertType: "your-new-type", /* ... */ },
     });
   }
   ```

6. **Register display name** in `src/components/alerts-section.tsx`:
   - Add to the `ALERT_TYPE_LABELS` map: `"your-new-type": "Your Alert Name"`
   - This makes the alert type appear in the dashboard's Alert Types popover

7. **Test** (optional but encouraged):
   ```ts
   // src/lib/__tests__/your-alert.test.ts
   import { vi } from "vitest";
   vi.mock("./redis", () => ({ getRedis: () => null }));
   // ... test detection logic with mock data
   ```

---

## AI Alert Builder

Users can request new alert types in plain English from the dashboard. The system creates a GitHub Issue, which triggers a Claude Code agent to implement the alert automatically.

### User Flow

1. User types a request in the Alert Builder UI (e.g. *"Notify me when RELIANCE crosses its 52-week high on heavy volume"*)
2. `POST /api/alert-requests` creates a GitHub Issue labeled `agent:create-alert`
3. The `agent-create-alert.yml` GitHub Actions workflow fires — Claude Code reads `AGENTS.md` and implements the alert in a PR
4. The `alert-request-sync.yml` workflow updates the request status as the issue/PR progresses
5. Once merged and deployed, the new alert type chip appears automatically in the dashboard

### Status Lifecycle

```
pending → issue_created → pr_created → implemented
                                      → rejected
```

### API

| Endpoint | Method | Description |
|---|---|---|
| `/api/alert-requests` | `GET` | List all requests |
| `/api/alert-requests` | `POST` | Submit new request — body `{ text: string }` (15–500 chars, must start with `"Create Alert:"`) |
| `/api/alert-requests/[id]` | `PATCH` | Update status — used by the sync workflow |

### Storage

- Redis key: `nse:alert-requests` (ring buffer, max 50)
- Filesystem fallback: `data/alert-requests.json`
- Functions: `getAlertRequests()`, `addAlertRequest()`, `updateAlertRequestStatus()` — all in `src/lib/alert-requests.ts`

### Requirements

- `GITHUB_TOKEN` env var must be set (with `issues: write` permission) for issue creation
- The repo must have the `agent:create-alert` label created in GitHub Issues
- `CLAUDE_CODE_OAUTH_TOKEN` secret must be set in GitHub Actions for the agent workflow

### Dashboard Integration

Once a request reaches `implemented` status, its `alertType` value is added to the `ALERT_TYPE_LABELS` map in `src/components/alerts-section.tsx` as part of the implementing PR. This makes the new type appear in the Alert Types popover automatically.
