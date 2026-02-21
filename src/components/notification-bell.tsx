"use client";

import { useState, useRef, useEffect } from "react";
import type { Alert } from "@/lib/types";

export function NotificationBell({
  alerts,
  onMarkAllRead,
  onMarkRead,
}: {
  alerts: Alert[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ring-1 ${
          open
            ? "ring-accent/25 bg-surface-overlay text-accent"
            : "ring-surface-border bg-surface-raised text-text-secondary hover:ring-accent/15 hover:bg-surface-overlay hover:text-text-primary"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <>
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-surface shadow-lg shadow-accent/25">
              {unread}
            </span>
            <span className="absolute -right-1 -top-1 h-[18px] w-[18px] rounded-full bg-accent animate-pulse-ring" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-40 w-[400px] overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-surface-border/60 shadow-2xl shadow-black/50 animate-scale-in card-elevated">
          <div className="flex items-center justify-between border-b border-surface-border/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold">Alerts</h3>
              {unread > 0 && (
                <span className="rounded-full bg-accent/10 ring-1 ring-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-accent">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={onMarkAllRead}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/8"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {alerts.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-overlay ring-1 ring-surface-border/50">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-text-secondary">No alerts yet</p>
                <p className="mt-1 text-xs text-text-muted">Run a scan to check for breakouts</p>
              </div>
            ) : (
              alerts.slice(0, 20).map((alert, i) => (
                <button
                  key={alert.id}
                  onClick={() => onMarkRead(alert.id)}
                  className={`w-full border-b border-surface-border/30 px-4 py-3 text-left transition-all duration-200 hover:bg-surface-overlay/40 ${
                    !alert.read ? "bg-accent/[0.03]" : ""
                  }`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {!alert.read && (
                        <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-accent shadow-[0_0_6px_rgba(0,230,138,0.4)]" />
                      )}
                      <div>
                        <span className="font-display text-sm font-bold">{alert.symbol}</span>
                        <span className="ml-2 text-xs text-text-muted">{alert.name}</span>
                      </div>
                    </div>
                    <span className="flex-shrink-0 rounded-md bg-accent/10 ring-1 ring-accent/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-accent">
                      BREAKOUT
                    </span>
                  </div>
                  <div className={`mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs ${!alert.read ? "ml-[18px]" : ""}`}>
                    <div className="text-text-secondary">
                      High: <span className="font-mono text-accent tabular-nums">&#x20B9;{alert.todayHigh.toLocaleString("en-IN")}</span>
                      <span className="text-text-muted"> vs &#x20B9;{alert.prevMaxHigh.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="text-text-secondary">
                      Vol: <span className="font-mono text-accent tabular-nums">{formatVolume(alert.todayVolume)}</span>
                      <span className="text-text-muted"> vs {formatVolume(alert.prevMaxVolume)}</span>
                    </div>
                  </div>
                  <div className={`mt-1.5 font-mono text-[10px] text-text-muted ${!alert.read ? "ml-[18px]" : ""}`}>
                    {new Date(alert.triggeredAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatVolume(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}
