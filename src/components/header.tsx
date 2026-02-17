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
    <header className="sticky top-0 z-30 border-b border-surface-border/70 glass">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-[#0b0b0b] shadow-lg shadow-accent/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-text-primary">Nifty Breakout Scanner</h1>
            <p className="text-[11px] text-text-muted">Close Watch cockpit for breakout actions</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface-overlay px-3 py-2">
            <span className={`h-2 w-2 rounded-full ${marketOpen ? "bg-accent" : "bg-text-muted"}`} />
            <span className="text-xs font-semibold text-text-secondary">{marketOpen ? "Market Open" : "Market Closed"}</span>
          </div>
          <NotificationBell alerts={alerts} onMarkAllRead={onMarkAllRead} onMarkRead={onMarkRead} />
        </div>
      </div>
    </header>
  );
}
