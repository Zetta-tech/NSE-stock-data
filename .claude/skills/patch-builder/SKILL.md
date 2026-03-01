---
name: patch-builder
description: Implementation rules and file creation checklist for building new alert types
---

# Patch Builder

## Implementation Checklist

For every new alert type, create/modify files in this order:

### 1. Types (`src/lib/types.ts`)
- Add new alert type to `alertType` union: `alertType?: "breakout" | "scan" | "your-type"`
- Add any new interfaces if the alert needs custom data fields

### 2. Detection Logic (`src/lib/scanner.ts` or new file)
- Prefer extending `scanner.ts` if the logic is similar to breakout detection
- Create a new file in `src/lib/` only if the logic is fundamentally different
- New files MUST start with `import "server-only"`
- Follow the `analyzeBreakout()` pattern: pure function, takes data + returns result

### 3. Wire Into Scan Pipeline
- If the alert runs during watchlist scans: modify `scanStock()` in scanner.ts
- If the alert is independent: create a new function and call it from the relevant API route
- For Nifty 50 alerts: hook into `src/app/api/nifty50/route.ts`

### 4. Store Alert
- Use `addAlert()` from `src/lib/store.ts`
- The `Alert` interface requires: `id`, `symbol`, `name`, `alertType`, `triggeredAt`, `read: false`
- Generate ID: `` `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` ``
- Dedup is automatic (symbol + alertType + date)

### 5. Log Activity
- Call `addActivity()` from `src/lib/activity.ts`
- Category: `"system"` for automated alerts
- Include relevant data in `detail` parameter

### 6. Tests (Optional)
- Create test file: `src/lib/__tests__/your-alert.test.ts`
- Mock Redis: `vi.mock("../redis", () => ({ getRedis: () => null }))`
- Test the detection function with known inputs/outputs

## Code Patterns to Follow

### Detection Function
```ts
function analyzeYourAlert(
  today: { /* relevant fields */ },
  historical: DayData[]
): { triggered: boolean; /* metrics */ } {
  // Pure computation, no side effects
  return { triggered: /* condition */, /* ... */ };
}
```

### Stale Suppression
```ts
const triggered = dataSource === "stale" ? false : analysis.triggered;
```

### Error Handling
```ts
try {
  // detection logic
} catch (error) {
  // Return safe default (triggered: false), don't throw
  return { triggered: false, /* zero values */ };
}
```

## File Naming

- Detection logic: `src/lib/your-alert-name.ts` (kebab-case, server-only)
- Tests: `src/lib/__tests__/your-alert-name.test.ts`
- No new components needed — alerts display in existing AlertPanel

## Don'ts

- Don't modify `src/middleware.ts`, `src/lib/redis.ts`, `src/lib/lockdown.ts`
- Don't add NPM dependencies
- Don't add comments or docstrings
- Don't refactor existing code
- Don't modify UI components unless the alert needs a new display format
