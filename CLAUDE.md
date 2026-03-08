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
- `src/app/api/` — REST endpoints: `scan/`, `state/`, `stocks/`, `ticker/`, `nifty50/`, `activity/`, `auth/`, `search/`, `index/`, `admin/`, `alert-requests/`
- `src/components/` — Client React components (`"use client"` directive)
- `src/lib/` — Server-only utilities (every file starts with `import "server-only"`)
- `docs/` — Architecture docs (read-only reference: `ARCHITECTURE.md`, `ALERTS.md`, `AI_CONSTRAINTS.md`, `api-capability-map.md`)
- `data/` — Filesystem JSON fallback for local dev (state, activity, alert-requests)

### Data Flow

The dashboard (`dashboard.tsx`) polls `/api/state` for all UI state. Manual scans hit `/api/scan`, which runs `scanMultipleStocks()` → `analyzeBreakout()` per stock → fires alerts via `addAlert()` → logs via `addActivity()`.

### Persistence

All stores follow Redis primary + filesystem JSON fallback:
```
Redis key (nse:watchlist, nse:alerts, nse:scanResults, nse:activity, etc.)
  → falls back to data/*.json when Redis unavailable
```
In production (Vercel), filesystem is read-only — Redis is required.

### Alert System

8 alert types: `breakout`, `low-breakout`, `scan`, `week-high`, `ma200-touch`, `ma100-touch`, `ma50-touch`, `ma5-touch`.

- `breakout`: Price breaks 5-day high AND volume exceeds 3× 5-day avg volume (bullish).
- `low-breakout`: Price drops below 10-day low AND volume exceeds 10-day max volume (bearish). Uses `minLow10d` and `maxVolume10d` from baselines.

Dedup: `symbol + alertType + date (YYYY-MM-DD)` — same combo on same day = skip.

Stale suppression: When `dataSource === "stale"` (live fetch failed during market hours), breakout triggers are suppressed to prevent false positives.

### Market Hours (IST)

- 09:15–15:30: Live trading (real-time API calls)
- 09:00–16:00: Extended (API calls allowed)
- Outside: Cached data served, API calls skipped

### Auth

Two tiers: Regular (`AUTH_USERNAME/PASSWORD`) and Admin (`ADMIN_USERNAME/PASSWORD` — can bypass lockdown). Sessions use HMAC-SHA256 cookies with epoch rotation.

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

## Do Not Modify

- `src/middleware.ts` — Auth + lockdown validation
- `src/lib/redis.ts` — Redis singleton
- `src/lib/lockdown.ts` — Lockdown + session epoch
- `src/app/api/auth/route.ts` — Login endpoint
- `tailwind.config.ts`, `next.config.mjs`, `package.json`

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
- Mock Redis: `vi.mock("./redis", () => ({ getRedis: () => null }))`
- Test files: `src/lib/__tests__/*.test.ts` or co-located `*.test.ts`
- Tests encouraged but not required for PRs

## Environment Setup

Copy `.env.example` → `.env` and fill in credentials. Redis is optional locally (falls back to filesystem). See `.env.example` for all variables.

## Gotchas

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

## Installed Plugins

User-scoped plugins (from `claude-plugins-official` marketplace):
- `skill-creator` — `/skill-creator`: create, test, benchmark agent skills
- `frontend-design` — auto-triggers on UI/component tasks
- `commit-commands` — `/commit`: auto-generate commit messages; `/commit-push-pr`: commit + push + open PR
- `code-review` — `/code-review`: parallel-agent PR review with confidence scoring
- `claude-md-management` — `/revise-claude-md`: capture session learnings; `claude-md-improver`: audit CLAUDE.md quality
- `feature-dev` — `/feature-dev`: structured 7-phase feature development workflow
