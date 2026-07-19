import { NextRequest, NextResponse } from "next/server";
import {
  getSecurityState,
  isLockdownExpired,
  setSecurityState,
} from "@/lib/lockdown";
import {
  getMaintenanceDisposition,
  MAINTENANCE_MESSAGE,
  MAINTENANCE_PATH,
  MAINTENANCE_RETRY_AFTER_SECONDS,
} from "@/maintenance";

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const maintenanceDisposition = getMaintenanceDisposition(pathname);

  if (maintenanceDisposition !== null) {
    if (maintenanceDisposition === "allow-maintenance-page") {
      return NextResponse.next();
    }

    if (maintenanceDisposition === "service-unavailable") {
      return NextResponse.json(
        { error: MAINTENANCE_MESSAGE },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "Retry-After": String(MAINTENANCE_RETRY_AFTER_SECONDS),
          },
        },
      );
    }

    const maintenanceResponse = NextResponse.redirect(
      new URL(MAINTENANCE_PATH, request.url),
    );
    maintenanceResponse.headers.set("Cache-Control", "no-store, max-age=0");
    maintenanceResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
    return maintenanceResponse;
  }

  // Public paths — no auth required
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/register") ||
    pathname.startsWith("/lockdown")
  ) {
    return NextResponse.next();
  }

  // Read security state (lockdown + epoch)
  let state;
  try {
    state = await getSecurityState();
  } catch {
    // SECURITY: Fail CLOSED — deny access when security state is unverifiable.
    // Fail-open with epoch 0 would let revoked sessions pass validation.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:gif|png|jpg|jpeg|svg|ico|webp|mp4|webm)$).*)"],
};
