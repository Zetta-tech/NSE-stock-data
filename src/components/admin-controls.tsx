"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface LockdownStatus {
  active: boolean;
  expiresAt?: string;
  remainingMinutes?: number;
  durationMinutes?: number;
}

export function AdminControls() {
  const [open, setOpen] = useState(false);
  const [lockdown, setLockdown] = useState<LockdownStatus>({ active: false });
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(60);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/lockdown");
      if (res.ok) setLockdown(await res.json());
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    if (open) fetchStatus();
  }, [open, fetchStatus]);

  // Refresh lockdown status while panel is open
  useEffect(() => {
    if (!open || !lockdown.active) return;
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [open, lockdown.active, fetchStatus]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-all ${
          lockdown.active
            ? "ring-danger/40 bg-danger/10 text-danger"
            : "ring-surface-border/40 bg-surface-overlay/20 text-text-secondary hover:text-text-primary"
        }`}
        title="Security Controls"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-surface-border/40 bg-surface-raised p-4 shadow-xl z-50 animate-scale-in">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            Security Controls
          </h3>

          {/* ── Lockdown Section ────────────────────────────────────── */}
          <div className="mb-3 rounded-xl bg-surface-overlay/40 p-3 ring-1 ring-surface-border/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-secondary">
                Lockdown Mode
              </span>
              {lockdown.active && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-danger animate-pulse">
                  Active
                </span>
              )}
            </div>

            {lockdown.active ? (
              <div>
                <p className="text-[11px] text-text-muted mb-2">
                  Expires in {lockdown.remainingMinutes ?? "?"}m
                </p>
                <button
                  onClick={deactivateLockdown}
                  disabled={loading}
                  className="w-full rounded-lg bg-surface-overlay/50 px-3 py-1.5 text-xs font-semibold text-text-secondary ring-1 ring-surface-border/40 transition-all hover:bg-surface-overlay/70 disabled:opacity-50"
                >
                  Deactivate Lockdown
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-2">
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-lg bg-surface px-2 py-1.5 text-xs text-text-primary ring-1 ring-surface-border/40 outline-none"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={180}>3 hours</option>
                    <option value={360}>6 hours</option>
                    <option value={720}>12 hours</option>
                    <option value={1440}>24 hours</option>
                  </select>
                </div>
                <button
                  onClick={activateLockdown}
                  disabled={loading}
                  className="w-full rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger ring-1 ring-danger/20 transition-all hover:bg-danger/20 disabled:opacity-50"
                >
                  Activate Lockdown
                </button>
              </div>
            )}
          </div>

          {/* ── Session Rotation Section ────────────────────────────── */}
          <div className="rounded-xl bg-surface-overlay/40 p-3 ring-1 ring-surface-border/30">
            <span className="text-xs font-semibold text-text-secondary block mb-1">
              Session Rotation
            </span>
            <p className="text-[11px] text-text-muted mb-2">
              Invalidate all sessions. Everyone except you must re-login.
            </p>
            <button
              onClick={rotateSessions}
              disabled={loading}
              className="w-full rounded-lg bg-warn/10 px-3 py-1.5 text-xs font-semibold text-warn ring-1 ring-warn/20 transition-all hover:bg-warn/20 disabled:opacity-50"
            >
              Rotate All Sessions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
