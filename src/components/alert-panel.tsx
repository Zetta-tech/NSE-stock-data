"use client";

import type { Alert } from "@/lib/types";

function getTodayIST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )
    .toISOString()
    .slice(0, 10);
}

export function AlertPanel({ alerts }: { alerts: Alert[] }) {
  const today = getTodayIST();
  const recentAlerts = alerts.filter(
    (a) => a.triggeredAt.slice(0, 10) === today
  );

  const unreadCount = recentAlerts.filter((a) => !a.read).length;

  return (
    <aside className="alert-sidebar flex flex-col rounded-2xl bg-surface-raised ring-1 ring-surface-border/50 card-elevated overflow-hidden">
      {/* Sidebar header */}
      <div className="flex items-center gap-2.5 border-b border-surface-border/40 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/8 ring-1 ring-accent/15">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <h2 className="font-display text-xs font-bold uppercase tracking-wider text-text-secondary">
          Alerts
        </h2>
        {unreadCount > 0 && (
          <span className="rounded-full bg-accent/10 ring-1 ring-accent/15 px-2 py-0.5 font-mono text-[9px] font-bold tabular-nums text-accent">
            {unreadCount}
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {recentAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-overlay ring-1 ring-surface-border/50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <p className="font-display text-xs font-semibold text-text-secondary">
              No recent alerts
            </p>
            <p className="mt-1 text-[10px] text-text-muted">
              Breakout alerts will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border/20">
            {recentAlerts.map((alert, i) => (
              <AlertRow key={alert.id} alert={alert} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Footer summary */}
      {recentAlerts.length > 0 && (
        <div className="border-t border-surface-border/30 px-4 py-2.5">
          <p className="text-[10px] text-text-muted text-center">
            {recentAlerts.length} alert{recentAlerts.length !== 1 ? "s" : ""} today
          </p>
        </div>
      )}
    </aside>
  );
}

function AlertRow({ alert, index }: { alert: Alert; index: number }) {
  const isUnread = !alert.read;

  return (
    <div
      className={`px-4 py-3 transition-colors duration-200 animate-fade-in ${
        isUnread ? "bg-accent/[0.03]" : ""
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start gap-2.5">
        {isUnread && (
          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent shadow-[0_0_6px_rgba(0,230,138,0.4)]" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-bold tracking-tight">
                {alert.symbol}
              </span>
              {alert.alertType === "high-break" ? (
                <span className="rounded-md bg-amber-500/8 ring-1 ring-amber-500/15 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-400">
                  HB
                </span>
              ) : (
                <span className="rounded-md bg-accent/8 ring-1 ring-accent/15 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-accent">
                  BO
                </span>
              )}
            </div>
          </div>

          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
            <div className="text-[10px] text-text-muted">
              <span className="text-text-secondary">H</span>{" "}
              <span className="font-mono text-accent tabular-nums text-[9px]">
                +{alert.highBreakPercent.toFixed(1)}%
              </span>
            </div>
            {alert.alertType !== "high-break" && (
              <div className="text-[10px] text-text-muted">
                <span className="text-text-secondary">V</span>{" "}
                <span className="font-mono text-accent tabular-nums text-[9px]">
                  +{alert.volumeBreakPercent.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          <p className="mt-1 font-mono text-[9px] text-text-muted/60">
            {new Date(alert.triggeredAt).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
