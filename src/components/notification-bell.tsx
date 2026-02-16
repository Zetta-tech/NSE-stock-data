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
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-surface-raised transition-colors hover:border-accent/30 hover:bg-surface-overlay"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-text-secondary"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <>
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-surface">
              {unread}
            </span>
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-accent animate-pulse-ring" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-96 rounded-xl border border-surface-border bg-surface-raised shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
            <h3 className="text-sm font-semibold">Alerts</h3>
            {unread > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-accent hover:text-accent-hover transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                No alerts yet. Run a scan to check for breakouts.
              </div>
            ) : (
              alerts.slice(0, 20).map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => onMarkRead(alert.id)}
                  className={`w-full border-b border-surface-border/50 px-4 py-3 text-left transition-colors hover:bg-surface-overlay ${
                    !alert.read ? "bg-accent-muted/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!alert.read && (
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                      )}
                      <div>
                        <span className="text-sm font-medium">
                          {alert.symbol}
                        </span>
                        <span className="ml-2 text-xs text-text-muted">
                          {alert.name}
                        </span>
                      </div>
                    </div>
                    <span className="flex-shrink-0 rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      BREAKOUT
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs text-text-secondary">
                    <div>
                      High: ₹{alert.todayHigh.toLocaleString("en-IN")} vs ₹
                      {alert.prevMaxHigh.toLocaleString("en-IN")}
                    </div>
                    <div>
                      Vol:{" "}
                      {formatVolume(alert.todayVolume)} vs{" "}
                      {formatVolume(alert.prevMaxVolume)}
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] text-text-muted">
                    {new Date(alert.triggeredAt).toLocaleString("en-IN")}
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
