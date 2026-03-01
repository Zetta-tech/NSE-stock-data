# Architecture

## Stack

- **Framework**: Next.js 14 (App Router) + React 18
- **Styling**: Tailwind CSS 3.4 + GSAP animations
- **Persistence**: Upstash Redis (primary) + filesystem JSON fallback (local dev)
- **NSE Data**: `stock-nse-india` v1.3.0 NPM package
- **Auth**: HMAC-SHA256 session cookies
- **Validation**: Zod
- **Testing**: Vitest + Testing Library
- **Deployment**: Vercel (serverless)

## File Layout

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # Route handlers
│   │   ├── activity/       # Audit trail
│   │   ├── admin/          # Lockdown & session management
│   │   ├── auth/           # Login/logout
│   │   ├── alert-requests/ # AI alert builder (POST creates GitHub Issue)
│   │   ├── index/          # Nifty 50 index value
│   │   ├── nifty50/        # Nifty 50 table + discoveries
│   │   ├── scan/           # Breakout scanner
│   │   ├── search/         # Stock symbol search
│   │   ├── state/          # Dashboard state polling
│   │   ├── stocks/         # Watchlist CRUD
│   │   └── ticker/         # Live ticker quotes
│   ├── dev/                # Dev panel page
│   ├── lockdown/           # Lockdown page
│   ├── login/              # Login page
│   ├── globals.css         # Tailwind + custom tokens
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Dashboard page
├── components/             # React components ("use client")
│   ├── dashboard.tsx       # Main orchestrator (watchlist, scan, alerts)
│   ├── alert-builder.tsx   # Natural-language alert input
│   ├── alert-panel.tsx     # Alert list + notifications
│   ├── stock-card.tsx      # Individual stock card
│   ├── add-stock-modal.tsx # Stock search + add modal
│   ├── ticker-panel.tsx    # Scrolling ticker
│   ├── nifty50-rail.tsx    # Nifty 50 discovery rail
│   ├── discovery-feed.tsx  # Breakout discovery feed
│   ├── header.tsx          # App header
│   ├── scan-button.tsx     # Scan trigger button
│   └── admin-controls.tsx  # Admin panel
└── lib/                    # Server-only utilities
    ├── activity.ts         # Audit trail (ring buffer, max 200 events)
    ├── alert-requests.ts   # AI alert request storage (ring buffer, max 50)
    ├── api-stats.ts        # API call tracking + Redis persistence
    ├── baselines.ts        # 5-day rolling baselines (in-memory cache)
    ├── github.ts           # GitHub Issue creation (for alert builder)
    ├── lockdown.ts         # Lockdown + session epoch (edge-compatible)
    ├── logger.ts           # Structured logger
    ├── market-hours.ts     # IST market hours (09:15-15:30 live, 09:00-16:00 extended)
    ├── nse-client.ts       # NSE API wrapper (singleton, retry, caching)
    ├── redis.ts            # Upstash Redis singleton
    ├── scanner.ts          # Breakout detection logic
    ├── store.ts            # Watchlist, alerts, scan results persistence
    └── types.ts            # All TypeScript interfaces
```

## Data Flow

```
UI (dashboard.tsx)
  → fetch("/api/scan")
    → scanMultipleStocks() [scanner.ts]
      → getHistoricalData() [nse-client.ts] → NSE API
      → getCurrentDayData() [nse-client.ts] → NSE API
      → analyzeBreakout() → ScanResult
    → addAlert() [store.ts] → Redis / filesystem
    → addActivity() [activity.ts] → Redis / filesystem
  ← { results, alerts, scannedAt, marketOpen }
```

## Persistence Layer

All stores follow the same pattern: Redis primary, filesystem JSON fallback.

| Redis Key | Module | What it stores |
|-----------|--------|----------------|
| `nse:watchlist` | store.ts | WatchlistStock[] |
| `nse:alerts` | store.ts | Alert[] |
| `nse:scanResults` | store.ts | ScanResult[] |
| `nse:activity` | activity.ts | ActivityEvent[] (ring buffer, max 200) |
| `nse:scan-meta` | activity.ts | ScanMeta |
| `nse:nifty50Stats` | store.ts | Nifty50PersistentStats |
| `nse:api-stats` | api-stats.ts | Hash — apiCalls, cacheHits, method breakdowns |
| `nse:security` | lockdown.ts | SecurityState (epoch + lockdown) |
| `nse:alert-requests` | alert-requests.ts | AlertRequest[] (ring buffer, max 50) |

Filesystem fallback files (under `data/`):
- `data/state.json` — watchlist, alerts, scan results
- `data/activity.json` — activity events + scan meta
- `data/alert-requests.json` — alert requests

## Caching Strategy

| Data | TTL | Scope |
|------|-----|-------|
| Historical prices | 1 day (IST date) | Per-instance (in-memory Map) |
| Nifty 50 snapshot | 3 minutes | Per-instance |
| Nifty 50 index | 15 seconds | Per-instance |
| Market status | 1 minute | Per-instance |
| 5-day baselines | 1 day (IST date) | Per-instance |
| API stats | Flushed on each /api/state poll | Redis (cross-instance) |

Outside extended hours (before 09:00 or after 16:00 IST), NSE API calls are skipped entirely — cached data is served.

## Auth Model

Two credential tiers:
- **Regular** (`AUTH_USERNAME`/`AUTH_PASSWORD`): Full app access. Cannot bypass lockdown.
- **Admin** (`ADMIN_USERNAME`/`ADMIN_PASSWORD`): Full access + lockdown bypass.

Session flow:
1. POST `/api/auth` with `{ username, password }`
2. Server computes `HMAC-SHA256(AUTH_PASSWORD:epoch)` using `AUTH_SECRET`
3. Sets `session` cookie (httpOnly, 30-day expiry)
4. Middleware validates session cookie on every request (except `/login`, `/api/auth`, `/lockdown`)

Session epoch rotation invalidates all existing sessions (used during lockdown).

## Deployment

- Vercel serverless functions (each API route = separate Lambda)
- Cold starts create fresh `NseIndia` instances (new cookies/session)
- Warm invocations reuse existing instance
- Filesystem writes are NOT available on Vercel (read-only) — Redis is required in production
