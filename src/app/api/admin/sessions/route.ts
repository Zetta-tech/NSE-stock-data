import { NextResponse } from "next/server";
import { getSecurityState, rotateSessionEpoch } from "@/lib/lockdown";
import { addActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/* ── Token generation (must match middleware + auth route) ──────────── */

async function sessionToken(epoch: number): Promise<string> {
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

// POST /api/admin/sessions/rotate — invalidate all sessions
export async function POST() {
  const newEpoch = await rotateSessionEpoch();

  await addActivity(
    "system",
    "sessions-rotated",
    "All sessions invalidated — re-login required",
    { actor: "dad", detail: { newEpoch } },
  );

  // Re-issue session cookie for the admin who triggered rotation
  const response = NextResponse.json({
    ok: true,
    message: "All sessions rotated. Other users must re-login.",
    epoch: newEpoch,
  });

  response.cookies.set("session", await sessionToken(newEpoch), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  // If lockdown is active, refresh bypass cookie for the admin
  const state = await getSecurityState();
  if (state.lockdown?.active) {
    response.cookies.set("lockdown-bypass", state.lockdown.bypassToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
  }

  return response;
}

// GET /api/admin/sessions — session info
export async function GET() {
  const state = await getSecurityState();
  return NextResponse.json({
    epoch: state.sessionEpoch,
    rotatedBefore: state.sessionEpoch > 0,
  });
}
