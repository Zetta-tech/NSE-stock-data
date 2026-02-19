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
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
          open
            ? "border-accent/30 bg-surface-overlay text-accent"
            : "border-surface-border bg-surface-raised text-text-secondary hover:border-accent/20 hover:bg-surface-overlay hover:text-text-primary"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <>
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-surface shadow-lg shadow-accent/30">
              {unread}
            </span>
            <span className="absolute -right-1 -top-1 h-[18px] w-[18px] rounded-full bg-accent animate-pulse-ring" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-40 w-[400px] overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-2xl shadow-black/40 animate-scale-in">
          <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Alerts</h3>
              {unread > 0 && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-accent">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={onMarkAllRead}
                className="rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {alerts.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-overlay">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <p className="text-sm text-text-secondary">No alerts yet</p>
                <p className="mt-1 text-xs text-text-muted">Run a scan to check for breakouts</p>
              </div>
            ) : (
              alerts.slice(0, 20).map((alert, i) => {
                const isLowBreak = alert.alertType === "low-break";
                return (
                  <button
                    key={alert.id}
                    onClick={() => onMarkRead(alert.id)}
                    className={`w-full border-b border-surface-border/40 px-4 py-3 text-left transition-all duration-200 hover:bg-surface-overlay/60 ${
                      !alert.read
                        ? isLowBreak ? "bg-red-500/[0.04]" : "bg-accent/[0.04]"
                        : ""
                    }`}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {!alert.read && (
                          <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full shadow-sm ${
                            isLowBreak ? "bg-red-400 shadow-red-400/40" : "bg-accent shadow-accent/40"
                          }`} />
                        )}
                        <div>
                          <span className="text-sm font-semibold">{alert.symbol}</span>
                          <span className="ml-2 text-xs text-text-muted">{alert.name}</span>
                        </div>
                      </div>
                      {isLowBreak ? (
                        <span className="flex items-center gap-1 flex-shrink-0 rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-red-400">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          LOW BREAK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 flex-shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                          BREAKOUT
                        </span>
                      )}
                    </div>

                    {isLowBreak ? (
                      <div className={`mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs ${!alert.read ? "ml-[18px]" : ""}`}>
                        <div className="text-text-secondary">
                          LTP: <span className="text-red-400 tabular-nums">&#x20B9;{alert.todayClose.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="text-text-secondary">
                          10d Low: <span className="text-text-muted tabular-nums">&#x20B9;{alert.prev10DayLow.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="text-text-secondary col-span-2">
                          Break: <span className="text-red-400 tabular-nums">-{alert.lowBreakPercent.toFixed(1)}%</span>
                          <span className="text-text-muted ml-2">Day: </span>
                          <span className={`tabular-nums ${alert.todayChange >= 0 ? "text-accent" : "text-red-400"}`}>
                            {alert.todayChange >= 0 ? "+" : ""}{alert.todayChange.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className={`mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs ${!alert.read ? "ml-[18px]" : ""}`}>
                        <div className="text-text-secondary">
                          High: <span className="text-accent tabular-nums">&#x20B9;{alert.todayHigh.toLocaleString("en-IN")}</span>
                          <span className="text-text-muted"> vs &#x20B9;{alert.prevMaxHigh.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="text-text-secondary">
                          Vol: <span className="text-accent tabular-nums">{formatVolume(alert.todayVolume)}</span>
                          <span className="text-text-muted"> vs {formatVolume(alert.prevMaxVolume)}</span>
                        </div>
                      </div>
                    )}

                    <div className={`mt-1.5 text-[10px] text-text-muted ${!alert.read ? "ml-[18px]" : ""}`}>
                      {new Date(alert.triggeredAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </button>
                );
              })
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
