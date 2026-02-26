import { NextRequest, NextResponse } from "next/server";
import {
  getSecurityState,
  activateLockdown,
  deactivateLockdown,
  isLockdownExpired,
} from "@/lib/lockdown";
import { addActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/admin/lockdown — get lockdown status
export async function GET() {
  const state = await getSecurityState();
  const lockdown = state.lockdown;

  if (lockdown && isLockdownExpired(lockdown)) {
    await deactivateLockdown();
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: !!lockdown?.active,
    ...(lockdown
      ? {
          expiresAt: lockdown.expiresAt,
          activatedAt: lockdown.activatedAt,
          durationMinutes: lockdown.durationMinutes,
          remainingMinutes: Math.max(
            0,
            Math.round(
              (new Date(lockdown.expiresAt).getTime() - Date.now()) / 60_000,
            ),
          ),
        }
      : {}),
  });
}

// POST /api/admin/lockdown — activate lockdown
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const durationMinutes = Math.min(
    Math.max(body.durationMinutes ?? 60, 1),
    1440,
  ); // 1 min – 24 hours

  const lockdown = await activateLockdown(durationMinutes);

  await addActivity(
    "system",
    "lockdown-activated",
    `Lockdown activated for ${durationMinutes}m`,
    {
      actor: "dad",
      detail: { durationMinutes, expiresAt: lockdown.expiresAt },
    },
  );

  const response = NextResponse.json({
    ok: true,
    active: true,
    expiresAt: lockdown.expiresAt,
    durationMinutes,
  });

  // Set bypass cookie for the admin activating lockdown
  response.cookies.set("lockdown-bypass", lockdown.bypassToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: durationMinutes * 60,
    path: "/",
  });

  return response;
}

// DELETE /api/admin/lockdown — deactivate lockdown
export async function DELETE() {
  await deactivateLockdown();

  await addActivity(
    "system",
    "lockdown-deactivated",
    "Lockdown deactivated",
    { actor: "dad" },
  );

  const response = NextResponse.json({ ok: true, active: false });
  response.cookies.delete("lockdown-bypass");
  return response;
}
