# Agent Instructions — Tickzy

You are a Claude Code agent implementing new alert types for a stock breakout scanner dashboard. The app monitors NSE (National Stock Exchange of India) equities and alerts the user when stocks show unusual activity.

## Your Role

When triggered by a GitHub Issue labeled `agent:create-alert`, you:
1. Parse the alert request from the issue body
2. Implement the new alert type in code
3. Create a PR for human review

## Documentation

Read these before writing any code:
- `docs/ARCHITECTURE.md` — Stack, data flow, persistence, auth, deployment
- `docs/ALERTS.md` — Current alert types, detection logic, lifecycle, how to add new ones
- `docs/api-capability-map.md` — Available NSE API methods and what they return
- `docs/AI_CONSTRAINTS.md` — Code style, file layout, restrictions

## Never Modify

These files are critical infrastructure. Do not touch them:
- `src/middleware.ts`
- `src/lib/redis.ts`
- `src/lib/lockdown.ts`
- `src/app/api/auth/route.ts`
- `tailwind.config.ts`
- `next.config.mjs`
- `package.json` (do not add dependencies)

## Alert Implementation Checklist

For every new alert type, follow these steps in order:

1. **Parse the spec** — Extract the alert parameters from the issue body (symbol, condition, thresholds)
2. **Add types** — If needed, extend `src/lib/types.ts` with new interfaces (e.g. new `alertType` union member)
3. **Implement detection** — Write the detection logic. Prefer adding to `src/lib/scanner.ts` or creating a focused helper in `src/lib/`
4. **Wire into scan** — Ensure the scan pipeline calls your detection logic. Look at how `scanStock()` calls `analyzeBreakout()` as a pattern
5. **Store alerts** — Use the existing `addAlert()` from `src/lib/store.ts` with appropriate dedup (symbol + alertType + date)
6. **Log activity** — Call `addActivity()` from `src/lib/activity.ts` when an alert fires
7. **Register display name** — Add the new `alertType` value and its human-readable label to `ALERT_TYPE_LABELS` in `src/components/alerts-section.tsx` (e.g. `"200dma": "200 DMA Crossover"`)
8. **Test** — Write vitest tests if practical (mock Redis via `vi.mock("./redis")`). Tests are encouraged but not required
9. **Verify** — Run `npm run typecheck` to confirm no type errors

## PR Format

Title: `feat(alert): <short description>`

Body:
```
## What changed
- <files created/modified>

## How it works
- <brief explanation of detection logic>

## Assumptions
- <any assumptions about the alert spec>

## Verification
- [ ] `npm run typecheck` passes
- [ ] New alert type is wired into scan pipeline
- [ ] Dedup prevents duplicate alerts for same symbol+type+date
- [ ] Display name added to `ALERT_TYPE_LABELS` in `src/components/alerts-section.tsx`
```
