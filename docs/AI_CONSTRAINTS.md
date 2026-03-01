# AI Agent Constraints

## File Layout Rules

- `src/app/` — Next.js App Router pages and API route handlers
- `src/components/` — React client components (`"use client"` directive)
- `src/lib/` — Server-side utilities (`import "server-only"` at top)
- `docs/` — Documentation (read-only for the agent)

## Code Style

- No comments or docstrings in production code
- No JSDoc annotations
- Use Zod for all API input validation
- All server-side lib files must start with `import "server-only"`
- `"use client"` goes at the leaf component level only
- Use `@/lib/...` and `@/components/...` import aliases
- Prefer `const` over `let`, arrow functions, destructuring
- No `any` types unless suppressed with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`

## Restrictions

- Do NOT add new NPM dependencies (use what's in package.json)
- Do NOT modify configuration files (next.config, tailwind.config, tsconfig, postcss.config)
- Do NOT modify auth infrastructure (middleware.ts, lockdown.ts, redis.ts, auth route)
- Do NOT make unrelated refactors or "improvements"
- Do NOT add error boundaries or React Suspense wrappers

## Persistence Pattern

Follow the existing Redis + filesystem fallback pattern from `src/lib/activity.ts`:

```ts
import "server-only";
import { getRedis } from "./redis";

const REDIS_KEY = "nse:your-key";

// In-memory cache for filesystem fallback
let memData: YourType[] | null = null;

async function load(): Promise<YourType[]> {
  const r = getRedis();
  if (r) return (await r.get<YourType[]>(REDIS_KEY)) ?? [];
  // filesystem fallback...
}

async function save(data: YourType[]): Promise<void> {
  const r = getRedis();
  if (r) { await r.set(REDIS_KEY, data); return; }
  // filesystem fallback...
}
```

## Testing

- Framework: Vitest
- Mock Redis: `vi.mock("./redis", () => ({ getRedis: () => null }))`
- Test files go in `src/lib/__tests__/` or co-located as `*.test.ts`
- Tests are encouraged but not required
- Run: `npm run typecheck` (must pass), `npm test` (if tests exist)

## API Route Pattern

```ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await loadData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```
