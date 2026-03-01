---
name: repo-orientation
description: Understand the NSE stock scanner repo structure, alert system, and key patterns before making changes
---

# Repo Orientation

## What This App Does

A single-user stock breakout scanner for the NSE (National Stock Exchange of India). It monitors a watchlist of stocks + all Nifty 50 constituents, detects breakout patterns, and alerts the user via browser notifications.

## Key Directories

- `src/lib/` — Server-only business logic. Every file starts with `import "server-only"`.
- `src/components/` — Client-side React components. Each has `"use client"` at the top.
- `src/app/api/` — Next.js route handlers (serverless functions on Vercel).
- `docs/` — Architecture docs, alert system docs, API capability map.

## Alert System

Alerts live in Redis key `nse:alerts` (type `Alert[]` from `src/lib/types.ts`).

Current alert types:
- `breakout` — High > 5-day max AND volume >= 3x 5-day average
- `scan` — Same logic applied during watchlist scans

Detection: `src/lib/scanner.ts` → `analyzeBreakout()`
Baselines: `src/lib/baselines.ts` → `getBaseline()` (5-day rolling, cached by IST date)
Storage: `src/lib/store.ts` → `addAlert()` (deduplicates by symbol + alertType + date)

## Market Hours (IST)

- **Live trading**: 09:15–15:30 (use real-time API data)
- **Extended**: 09:00–16:00 (API calls allowed, closing session)
- **After hours**: 16:00–09:00 (serve cached data, skip API calls)
- **Weekends**: No API calls, serve last known data

See `src/lib/market-hours.ts` for `isMarketHours()` and `isExtendedHours()`.

## Stale Data Suppression

When `dataSource === "stale"` (live fetch failed during market hours), breakout triggers are suppressed to avoid false alerts. This is critical — new alert types MUST respect this pattern.

## Redis Keys

| Key | Purpose |
|-----|---------|
| `nse:watchlist` | User's tracked stocks |
| `nse:alerts` | Fired alerts (all types) |
| `nse:scanResults` | Latest scan results |
| `nse:activity` | Audit trail (max 200 events) |
| `nse:scan-meta` | Last scan metadata |
| `nse:nifty50Stats` | Nifty 50 snapshot stats |
| `nse:api-stats` | API call counters (hash) |
| `nse:security` | Lockdown + session epoch |
| `nse:alert-requests` | AI alert builder requests (max 50) |

## Persistence Pattern

Every store module uses the same pattern:
1. Try Redis via `getRedis()` from `src/lib/redis.ts`
2. If Redis is null (local dev), fall back to filesystem JSON under `data/`
3. In-memory cache prevents redundant reads

See `src/lib/activity.ts` as the canonical example.
