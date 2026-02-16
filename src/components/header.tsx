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
    <header className="border-b border-surface-border bg-surface-raised/60 backdrop-blur-md sticky top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted">
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
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Nifty Breakout Scanner
            </h1>
            <p className="text-xs text-text-muted">
              5-day high &amp; volume breakout detection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                marketOpen ? "bg-accent animate-pulse" : "bg-text-muted"
              }`}
            />
            <span className="text-xs text-text-secondary">
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
