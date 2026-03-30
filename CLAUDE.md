# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NSE Stock Scanner — a single-user stock breakout detection dashboard for the National Stock Exchange of India. Monitors a personal watchlist and Nifty 50 constituents, detects unusual trading activity (breakouts, moving average touches, price milestones), and alerts via browser notifications and a persistent alert feed.

**Stack**: Next.js 14 (App Router) + React 18 + Tailwind CSS 3.4 + GSAP + Upstash Redis + `stock-nse-india` NPM package + Vitest + Vercel deployment.

## Commands

```bash
npm run dev          # Dev server (port 3000, requires .env)
npm run build        # Production build (do NOT use to check errors — use typecheck instead)
npm run typecheck    # tsc --noEmit (must pass before any PR)
npm run lint         # ESLint
npm test             # Vitest suite (single run)
npm run test:watch   # Vitest watch mode
```

**Important**: Do not run `npm run build` to check for errors — it breaks the local dev server. Use `npm run typecheck` instead.

## Architecture

### File Layout

- `src/app/` — Next.js App Router pages and API route handlers
- `src/app/api/` — REST endpoints: `scan/`, `state/`, `stocks/`, `ticker/`, `nifty50/`, `activity/`, `auth/`, `register/`, `search/`, `index/`, `admin/`, `alert-requests/`, `logs/`
- `src/components/` — Client React components (`"use client"` directive)
- `src/lib/` — Server-only utilities (every file starts with `import "server-only"`)
- `docs/` — Architecture docs (read-only reference: `ARCHITECTURE.md`, `ALERTS.md`, `AI_CONSTRAINTS.md`, `api-capability-map.md`)
- `data/` — Filesystem JSON fallback for local dev (state, activity, alert-requests)

### Data Flow

The dashboard (`dashboard.tsx`) polls `/api/state` for all UI state. Manual scans hit `/api/scan`, which runs `scanMultipleStocks()` → `analyzeBreakout()` per stock → fires alerts via `addAlert()` → logs via `addActivity()`.

### AI Alert Builder

`src/components/alert-builder.tsx` lets users describe an alert in plain English (e.g. "Alert me when any stock crosses its 52-week high on heavy volume"). The component POSTs to `/api/alert-requests`, which stores the request in Redis (`nse:alert-requests`) / `data/alert-requests.json` fallback. A Claude Code GitHub Actions workflow picks up the request, implements the alert logic, and opens a pull request. The feature is fully implemented and deployed.

### Persistence

All stores follow Redis primary + filesystem JSON fallback:
```
Redis key (nse:watchlist, nse:alerts, nse:scanResults, nse:activity, etc.)
  → falls back to data/*.json when Redis unavailable
```
In production (Vercel), filesystem is read-only — Redis is required.

### Scan Lock

A 30-second distributed lock (`acquireScanLock`, `releaseScanLock`, `getScanLockTTL` from `src/lib/store.ts`) prevents concurrent scans across Lambda instances. Two lock types: `"manual"` (user-triggered) and `"auto"` (close-watch). On lock contention, cached results are returned with `lockHeld: true`.

### NSE Client

`src/lib/nse-client.ts` maintains a per-Lambda singleton (`getNse()` / `resetNse()`) that reuses session cookies across calls. `withRetry()` wraps calls to reset and retry once on failure (handles stale cookies). Pattern: `await withRetry(() => getNse().method(...), "label")`.

Baselines (5-day high, 10-day low, volumes) are computed once per symbol per IST calendar date and cached in-memory. `getBaseline(symbol)` / `getBaselines(symbols[])` handle batching (batch size 5). Historical data cache is keyed by `symbol + days` — same symbol with a different `days` parameter is a separate cache entry.

### Alert System

8 alert types: `breakout`, `low-breakout`, `scan`, `week-high`, `ma200-touch`, `ma100-touch`, `ma50-touch`, `ma5-touch`.

- `breakout`: Price breaks 5-day high AND volume exceeds 3× 5-day avg volume (bullish).
- `low-breakout`: Price drops below 10-day low AND volume exceeds 10-day max volume (bearish). Uses `minLow10d` and `maxVolume10d` from baselines.

Dedup (two-tier): Primary is a Redis NX lock keyed `alert-lock:{symbol}:{alertType}:{date}:{30min-window}` (TTL 30 min) — prevents duplicates across Lambda instances. Falls back to in-memory dedup if Redis unavailable.

Stale suppression: When `dataSource === "stale"` (live fetch failed during market hours), breakout triggers are suppressed to prevent false positives.

MA touch alerts (`ma5-touch`, `ma50-touch`, `ma100-touch`, `ma200-touch`) each live in their own `src/lib/ma{N}-alert.ts` file. All follow the same shape: touch threshold is 1%, stale suppression applied, returns `null` if data insufficient. Use these as the template when adding a new MA alert type.

### Market Hours (IST)

- 09:15–15:30: Live trading (real-time API calls)
- 09:00–16:00: Extended (API calls allowed)
- Outside: Cached data served, API calls skipped

### Auth

Two tiers: Regular (`AUTH_USERNAME/PASSWORD`) and Admin (`ADMIN_USERNAME/PASSWORD` — can bypass lockdown). Sessions use signed cookies with server-side epoch invalidation.

## Code Conventions

- No comments or docstrings in production code
- No new NPM dependencies
- Use `const` + arrow functions + destructuring
- Import aliases: `@/lib/...`, `@/components/...`
- All `src/lib/` files must start with `import "server-only"`
- `"use client"` at leaf component level only (always explicit, even if parent is client)
- Use Zod for all API input validation
- No `any` types
- API routes use `export const dynamic = "force-dynamic"` and return `NextResponse.json()`
- Batch NSE API calls with `Promise.allSettled()` (batch size 5)

## Core Infrastructure

Changes to these files require full regression testing — they underpin auth, session management, and the build pipeline:

- `src/middleware.ts` — Auth + lockdown validation
- `src/lib/redis.ts` — Redis singleton
- `src/lib/lockdown.ts` — Lockdown + session epoch
- `src/app/api/auth/route.ts` — Login endpoint
- `tailwind.config.ts`, `next.config.mjs`, `package.json`
- `tsconfig.json`, `postcss.config.mjs`

## Adding a New Alert Type

1. Extend `alertType` union in `src/lib/types.ts`
2. Implement detection in `src/lib/scanner.ts` or new `src/lib/your-alert.ts` — respect stale suppression
3. Wire into scan pipeline (call from `scanStock()` or the relevant API route)
4. Store via `addAlert()` from `src/lib/store.ts`
5. Log via `addActivity()` from `src/lib/activity.ts`
6. Register display config in `ALERT_STYLES` in `src/components/alerts-section.tsx`
7. Run `npm run typecheck` to verify

See `docs/ALERTS.md` and `AGENTS.md` for full details.

## Testing

- Framework: Vitest (node environment, `@` alias resolved, `server-only` stubbed)
- Test files: `src/lib/__tests__/*.test.ts` or co-located `*.test.ts`
- Tests encouraged but not required for PRs

To mock Redis with an in-memory store (preferred over returning `null`):
```ts
const { redisMap } = vi.hoisted(() => ({ redisMap: new Map<string, unknown>() }));
vi.mock("./redis", () => ({
  getRedis: () => ({
    get: async <T,>(key: string) => (redisMap.get(key) as T | undefined) ?? null,
    set: async (key: string, value: unknown) => { redisMap.set(key, value); return "OK"; },
  }),
}));
```
Use `vi.mock("./redis", () => ({ getRedis: () => null }))` only when you want the filesystem fallback path tested.

## Environment Setup

Copy `.env.example` → `.env` and fill in credentials. Redis is optional locally (falls back to filesystem). See `.env.example` for all variables.

## Gotchas

- Client components run during SSR — guard browser APIs with `typeof window !== "undefined"` and use `useEffect` for browser-only code
- `src/lib/market-hours.ts` is shared by both server (`src/lib/`) and client (`src/components/`) code — do NOT add async functions, Redis imports, or `import "server-only"` to it
- `src/lib/nse-client.ts` lacks `import "server-only"` but is only imported from server code — safe to use `getRedis()` there
- tsconfig does not enable `downlevelIteration` — use `Array.from(set)` instead of `[...set]` for Set/Map iteration
- `stock-nse-india` method names: always verify against `node_modules/stock-nse-india/build/index.d.ts` (e.g., `getTradingHolidays()` not `getHolidaysBySegment()`)
- When modifying `isExtendedHours()` guards in `nse-client.ts`, preserve the seed-fetch fallback that allows one initial fetch when no cache exists

## Key Reference Files

- `docs/system-design-ideas.md` — System design ideas (explored, ready, future), inter-dependency analysis, implementation order
- `docs/ARCHITECTURE.md` — System design, persistence, caching, auth
- `docs/ALERTS.md` — Alert types, detection logic, lifecycle
- `docs/AI_CONSTRAINTS.md` — Code style and restrictions for agents
- `AGENTS.md` — Step-by-step checklist for implementing new alert types
- `code-standards.md` — Client/server component rules, data fetching patterns
- `Frontend-aesthetics.md` — UI design guidelines (typography, color, motion)
