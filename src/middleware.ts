import { NextRequest, NextResponse } from "next/server";
import {
  getSecurityState,
  isLockdownExpired,
  setSecurityState,
} from "@/lib/lockdown";

/* ── Token generation (must match auth route) ──────────────────────── */

async function computeToken(epoch: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.AUTH_SECRET ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${process.env.AUTH_PASSWORD ?? ""}:${epoch}`),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ── Middleware ─────────────────────────────────────────────────────── */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths — no auth required
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/lockdown")
  ) {
    return NextResponse.next();
  }

  // Read security state (lockdown + epoch)
  let state;
  try {
    state = await getSecurityState();
  } catch {
    // If Redis is unreachable, fail open with defaults
    state = { sessionEpoch: 0, lockdown: null };
  }

  // ── Lockdown enforcement ────────────────────────────────────────
  if (state.lockdown?.active) {
    if (isLockdownExpired(state.lockdown)) {
      // Auto-expire: clear lockdown
      state.lockdown = null;
      try {
        await setSecurityState(state);
      } catch {
        /* best effort */
      }
    } else {
      // Check bypass cookie
      const bypass = request.cookies.get("lockdown-bypass")?.value;
      if (bypass !== state.lockdown.bypassToken) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "App is in lockdown mode" },
            { status: 403 },
          );
        }
        return NextResponse.redirect(new URL("/lockdown", request.url));
      }
    }
  }

  // ── Session validation ──────────────────────────────────────────
  const session = request.cookies.get("session")?.value;
  if (session !== (await computeToken(state.sessionEpoch))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
