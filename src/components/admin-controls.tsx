"use client";

import { useState, useCallback, useEffect } from "react";

interface LockdownStatus {
  active: boolean;
  expiresAt?: string;
  remainingMinutes?: number;
  durationMinutes?: number;
}

export function AdminControls({ variant = "inline" }: { variant?: "inline" }) {
  const [lockdown, setLockdown] = useState<LockdownStatus>({ active: false });
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(60);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/lockdown");
      if (res.ok) setLockdown(await res.json());
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Refresh lockdown status periodically when active
  useEffect(() => {
    if (!lockdown.active) return;
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [lockdown.active, fetchStatus]);

  const activateLockdown = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/lockdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: duration }),
      });
      if (res.ok) setLockdown(await res.json());
    } catch {
      /* silent */
    }
    setLoading(false);
  };

  const deactivateLockdown = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/lockdown", { method: "DELETE" });
      if (res.ok) setLockdown({ active: false });
    } catch {
      /* silent */
    }
    setLoading(false);
  };

  const rotateSessions = async () => {
    setLoading(true);
    try {
      await fetch("/api/admin/sessions/rotate", { method: "POST" });
    } catch {
      /* silent */
    }
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      {/* ── Lockdown Section ────────────────────────────────────── */}
      <div className="rounded-lg border border-surface-border/60 bg-surface-raised/50 px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={lockdown.active ? "text-red-400" : "text-text-muted"}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-[10px] font-semibold text-text-secondary">
              Lockdown
            </span>
          </div>
          {lockdown.active && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 animate-pulse">
              Active
            </span>
          )}
        </div>

        {lockdown.active ? (
          <div>
            <p className="text-[10px] text-text-muted mb-2">
              Expires in {lockdown.remainingMinutes ?? "?"}m
            </p>
            <button
              onClick={deactivateLockdown}
              disabled={loading}
              className="w-full rounded-md bg-surface-overlay/50 px-2.5 py-1.5 text-[10px] font-semibold text-text-secondary ring-1 ring-surface-border/40 transition-all hover:bg-surface-overlay/70 disabled:opacity-50"
            >
              Deactivate
            </button>
          </div>
        ) : (
          <div>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-md bg-surface px-2 py-1 text-[10px] text-text-primary ring-1 ring-surface-border/40 outline-none mb-2"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={180}>3 hours</option>
              <option value={360}>6 hours</option>
              <option value={720}>12 hours</option>
              <option value={1440}>24 hours</option>
            </select>
            <button
              onClick={activateLockdown}
              disabled={loading}
              className="w-full rounded-md bg-red-500/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-red-400 border border-red-500/20 transition-all hover:bg-red-500/15 disabled:opacity-50"
            >
              Activate Lockdown
            </button>
          </div>
        )}
      </div>

      {/* ── Session Rotation Section ────────────────────────────── */}
      <div className="rounded-lg border border-surface-border/60 bg-surface-raised/50 px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-text-muted"
          >
            <path d="M21.5 2v6h-6" />
            <path d="M2.5 22v-6h6" />
            <path d="M2.5 11.5a10 10 0 0 1 18.1-4.5" />
            <path d="M21.5 12.5a10 10 0 0 1-18.1 4.5" />
          </svg>
          <span className="text-[10px] font-semibold text-text-secondary">
            Session Rotation
          </span>
        </div>
        <p className="text-[9px] text-text-muted mb-2">
          Invalidate all sessions. Everyone except you must re-login.
        </p>
        <button
          onClick={rotateSessions}
          disabled={loading}
          className="w-full rounded-md bg-amber-500/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20 transition-all hover:bg-amber-500/15 disabled:opacity-50"
        >
          Rotate All Sessions
        </button>
      </div>
    </div>
  );
}
