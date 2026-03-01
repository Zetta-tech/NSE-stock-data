---
name: pr-publisher
description: PR title, body template, and formatting rules for agent-created pull requests
---

# PR Publisher

## PR Title Format

```
feat(alert): <short description of the alert type>
```

Examples:
- `feat(alert): add price drop percentage alert`
- `feat(alert): add volume spike custom threshold alert`
- `feat(alert): add price crosses above/below target alert`

## PR Body Template

```markdown
## What changed

- Created `src/lib/<new-file>.ts` — detection logic for <alert type>
- Modified `src/lib/types.ts` — added `"<alert-type>"` to alertType union
- Modified `src/lib/scanner.ts` — wired <alert type> into scan pipeline
- Created `src/lib/__tests__/<new-file>.test.ts` — unit tests (if added)

## How it works

<2-3 sentences explaining the detection logic, thresholds, and data sources used>

## Alert spec (from issue)

> <original alert request text>

## Assumptions

- <any assumptions made about ambiguous parts of the request>
- <data freshness / timing assumptions>
- <scope: watchlist only, Nifty 50, or specific symbols>

## Verification

- [ ] `npm run typecheck` passes
- [ ] New alert type added to `alertType` union in types.ts
- [ ] Detection logic respects stale data suppression
- [ ] Alert fires via `addAlert()` with proper dedup
- [ ] Activity logged via `addActivity()`
- [ ] No new dependencies added
- [ ] No modifications to protected files (middleware, redis, lockdown, auth)

## Closes

Closes #<issue-number>
```

## Rules

1. Always reference the issue number with `Closes #N` to auto-close it on merge
2. Keep the description factual — no marketing language
3. List every file created or modified
4. If tests were not added, note it in the body: "Tests: not added (detection logic is straightforward)"
5. Include the original alert request text as a quote block
