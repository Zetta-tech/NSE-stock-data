/**
 * Lockdown & session-epoch state — edge-compatible (no "server-only").
 *
 * Imported by both Next.js middleware (edge) and API routes (Node.js).
 * Uses Upstash Redis when available; falls back to in-memory state for
 * local dev (lost on restart, which is fine for development).
 */
import { Redis } from "@upstash/redis";

/* ── Edge-compatible Redis singleton ───────────────────────────────── */

let _redis: Redis | null | undefined;

function edgeRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

/* ── Types ──────────────────────────────────────────────────────────── */

export interface LockdownInfo {
  active: boolean;
  expiresAt: string; // ISO 8601
  activatedAt: string;
  bypassToken: string;
  durationMinutes: number;
}

export interface SecurityState {
  sessionEpoch: number;
  lockdown: LockdownInfo | null;
}

/* ── Constants & defaults ──────────────────────────────────────────── */

const SECURITY_KEY = "nse:security";
const DEFAULT_STATE: SecurityState = { sessionEpoch: 0, lockdown: null };

/* ── In-memory fallback (local dev) ────────────────────────────────── */

let memState: SecurityState = { ...DEFAULT_STATE };

/* ── Read / Write ──────────────────────────────────────────────────── */

export async function getSecurityState(): Promise<SecurityState> {
  const r = edgeRedis();
  if (r) {
    const data = await r.get<SecurityState>(SECURITY_KEY);
    return data ?? { ...DEFAULT_STATE };
  }
  return { ...memState };
}

export async function setSecurityState(state: SecurityState): Promise<void> {
  const r = edgeRedis();
  if (r) {
    await r.set(SECURITY_KEY, state);
    return;
  }
  memState = { ...state };
}

/* ── Lockdown helpers ──────────────────────────────────────────────── */

export async function activateLockdown(
  durationMinutes = 60,
): Promise<LockdownInfo> {
  const state = await getSecurityState();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60_000);

  const bypassToken = crypto.randomUUID();

  const lockdown: LockdownInfo = {
    active: true,
    expiresAt: expiresAt.toISOString(),
    activatedAt: now.toISOString(),
    bypassToken,
    durationMinutes,
  };

  state.lockdown = lockdown;
  await setSecurityState(state);
  return lockdown;
}

export async function deactivateLockdown(): Promise<void> {
  const state = await getSecurityState();
  state.lockdown = null;
  await setSecurityState(state);
}

export function isLockdownExpired(lockdown: LockdownInfo): boolean {
  return new Date(lockdown.expiresAt).getTime() <= Date.now();
}

/* ── Session epoch helpers ─────────────────────────────────────────── */

export async function rotateSessionEpoch(): Promise<number> {
  const state = await getSecurityState();
  state.sessionEpoch += 1;
  await setSecurityState(state);
  return state.sessionEpoch;
}
