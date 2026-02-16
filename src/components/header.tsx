"use client";

import { NotificationBell } from "./notification-bell";
import type { Alert } from "@/lib/types";

export function Header({
  alerts,
  onMarkAllRead,
  onMarkRead,
  marketOpen,
}: {
  alerts: Alert[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  marketOpen: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-border/60 glass">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 ring-1 ring-accent/20">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-accent"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <div className="absolute -inset-1 rounded-xl bg-accent/10 blur-md animate-glow-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Nifty <span className="text-gradient">Breakout</span> Scanner
            </h1>
            <p className="text-[11px] text-text-muted">
              5-day high &amp; volume breakout detection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5 rounded-lg border border-surface-border/60 bg-surface-overlay/40 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${
                  marketOpen ? "bg-accent animate-ping opacity-75" : ""
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  marketOpen ? "bg-accent" : "bg-text-muted"
                }`}
              />
            </span>
            <span className="text-xs font-medium text-text-secondary">
              {marketOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>
          <NotificationBell
            alerts={alerts}
            onMarkAllRead={onMarkAllRead}
            onMarkRead={onMarkRead}
          />
        </div>
      </div>
    </header>
  );
}
