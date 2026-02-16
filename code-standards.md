---
description: Code Standards for the Frontend
globs: '*'
alwaysApply: true
---

# Code Standards for the Rezzy Frontend

## General

- Use **npm** for package management.
- Do **not** write comments or docstrings for functions and classes.
- Do **not** write comments unless absolutely necessary to explain something non-obvious.
- Do **not** create markdown files to explain your changes unless explicitly asked.
- Do **not** run `npm run build` to check for errors since it breaks the local development server. Use the compiler (type checker / linter) instead.

## Client vs Server Components

- Place `"use client"` as **low as possible** in the component tree (leaf components only).
- When interactivity is needed, create a **new small client component** instead of converting an entire component.
- Always add `"use client"` explicitly to **all client components**, even if the parent is already a client component.
- You **can** pass server components as children/props to client components; they remain server components. Client/server is determined by **imports**, not nesting.
- Do **not** use React state or hooks in server components:
  - `useState`, `useReducer`, `useContext`, `useEffect`, etc. are client-only.
- Do **not** use `"use server"` at the top of regular server components.
  - Everything is server by default.
  - Use `"use server"` **only** for Server Actions.
- Use the `server-only` package for server utilities so they **cannot** be imported into client components.
- Client components run on both server (SSR/SSG) **and** client (hydration).
  - Logs from client components can appear in both the terminal and the browser console.

## Security & Secrets

- Only pass **minimal, non-sensitive data** from server components to client components.
- Never hardcode secrets anywhere in the frontend.
- Do **not** put sensitive values in `NEXT_PUBLIC_*` env variables. Treat all `NEXT_PUBLIC_*` as public.
- Use `server-only` for modules that must never be bundled client-side.

## Browser APIs

- Guard all browser-only APIs:
  - Check `typeof window !== "undefined"` before using `window`, `document`, etc.
  - Use `useEffect` for browser-only code in client components.
  - Use dynamic imports with `ssr: false` if a library requires the browser at import time.

## Rendering, Hydration & Suspense

- Avoid hydration errors:
  - Ensure server-rendered HTML matches client output.
  - Avoid non-deterministic values during initial render (e.g., `Date.now()`, `Math.random()` without guards).
- Always handle loading states:
  - Use `loading.tsx` for route-level loading.
  - Use `<Suspense>` for async child components.
- Use **granular** Suspense:
  - Wrap only slow parts of the UI, not entire pages.
  - Place `<Suspense>` **above** the async component, not inside it.
  - Use `key` on Suspense boundaries when you need them to re-render on dependency changes.

## Static vs Dynamic Rendering

- Prefer **static rendering** by default.
- Be aware of what makes a component **dynamic**:
  - Using `searchParams` in server components.
  - Using `cookies()` or `headers()`.
  - Doing auth checks directly inside components instead of middleware.
- Avoid accidental dynamic rendering:
  - Push auth checks to middleware where possible.
  - Use `useSearchParams()` in client components if you only need to read query params on the client.

## Routing & Params

- For route parameters:
  - Use `params` for dynamic segments (e.g., `[id]`).
  - Use `searchParams` in **server components** only when necessary and with awareness that it makes the route dynamic.
  - Prefer `useSearchParams()` in **client components** for simple query string reads to avoid server-side dynamic rendering.

## Data Fetching, Mutations & Server Actions

### Fetching Patterns

- **GET requests**:
  - Prefer calling them directly in **server components** with `fetch`.
  - Use them for reading data (no side effects).
- **Mutations (POST/PUT/PATCH/DELETE)**:
  - Prefer **Server Actions** for UI-specific mutations.
  - Use route handlers only when you need a **public API** or integration surface (webhooks, external services, other backends).

### When to Use Server Actions

Use Server Actions (`"use server"`) when **all** of these apply:

- You are performing a **mutation**:
  - Creating, updating, or deleting records.
  - Triggering side effects (sending emails, starting jobs, etc.).
- The logic is **UI-specific**, not a general-purpose public API.
- You want Server Action features:
  - Automatic form handling.
  - Integration with `useTransition` for pending states in client components.
  - Easy cache invalidation via `revalidatePath()` / `revalidateTag()` after a mutation.

Server Actions **are not** a general “run any GET on the server” abstraction:

- Under the hood, they are essentially **POST** calls.
- They are not ideal for reusable, cross-client APIs.
- Do **not** create Server Actions whose primary purpose is to perform **GET-only** reads.

### Server Actions Usage Rules

- Call Server Actions from:
  - Server components (directly).
  - Client components using `useTransition` or form submissions.

- Always:
  - Validate inputs (e.g., with Zod).
  - Check authentication/authorization in **every** Server Action.

### For “Button → Backend Route → GET Data” Patterns

- **Do not** use Server Actions just because the logic runs on the server.
- Use one of these instead:
  - Call a **Route Handler** via `fetch` from the client.
  - Call the existing **FastAPI** backend directly from the client if exposing that URL is acceptable.

- Reserve Server Actions for **mutations** + UI-specific logic, not simple GET reads.

## Caching & Revalidation

- Rely on Next.js built-in **fetch caching** for GET requests in server components.
- After mutations (via Server Actions or APIs), **manually** invalidate cache:
  - Use `revalidatePath("/some-path")` to refresh specific routes.
  - Use `revalidateTag("some-tag")` if using tagged revalidation.

- Avoid waterfall fetches:
  - Use `Promise.all()` to perform independent requests in parallel.
