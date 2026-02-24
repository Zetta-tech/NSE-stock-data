"use client";

import { useState } from "react";
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
  const [collapsed, setCollapsed] = useState(false);

  const unreadCount = recentAlerts.filter((a) => !a.read).length;

  if (recentAlerts.length === 0) return null;

  return (
    <div className="animate-slide-down">
      <div
        className="overflow-hidden rounded-2xl ring-1 ring-accent/15 card-elevated"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,230,138,0.015) 0%, var(--surface-raised) 40%, var(--surface-raised) 60%, rgba(0,180,214,0.01) 100%)",
          boxShadow:
            "0 0 0 1px rgba(0,230,138,0.06), 0 4px 24px -4px rgba(0,230,138,0.04), inset 0 1px 0 rgba(255,255,255,0.02)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-accent/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-accent"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xs font-bold uppercase tracking-wider text-accent">
                Breakout Alerts
              </h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-accent/10 ring-1 ring-accent/20 px-2 py-0.5 font-mono text-[9px] font-bold tabular-nums text-accent">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[9px] font-semibold text-text-muted/50 uppercase tracking-wider">
              Today
            </span>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex h-6 w-6 items-center justify-center rounded-lg ring-1 ring-accent/10 bg-accent/[0.04] text-accent/60 transition-all hover:text-accent hover:ring-accent/20"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Alert Cards — horizontal scroll */}
        {!collapsed && (
          <div className="overflow-x-auto scrollbar-thin px-3 py-3">
            <div className="flex gap-2.5" style={{ width: "max-content" }}>
              {recentAlerts.map((alert, i) => (
                <AlertCard key={alert.id} alert={alert} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert, index }: { alert: Alert; index: number }) {
  const isUnread = !alert.read;

  return (
    <div
      className={`group relative flex flex-col rounded-xl px-3.5 py-3 ring-1 ring-accent/12 bg-accent/[0.02] hover:ring-accent/25 hover:bg-accent/[0.04] transition-all duration-200 animate-fade-in ${
        isUnread ? "ring-accent/20" : ""
      }`}
      style={{
        minWidth: 164,
        width: 164,
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Unread pulse dot */}
      {isUnread && (
        <div className="absolute right-2 top-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(0,230,138,0.4)]" />
          </span>
        </div>
      )}

      {/* Symbol & Badge */}
      <div className="flex items-center gap-1.5">
        <span className="font-display text-[11px] font-bold tracking-tight text-accent">
          {alert.symbol}
        </span>
        <span className="rounded bg-accent/8 ring-1 ring-accent/15 px-1 py-px text-[7px] font-bold uppercase tracking-wider text-accent/70">
          Breakout
        </span>
      </div>

      {/* Price & Change */}
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-xs font-bold tabular-nums tracking-tight text-text-primary">
          {alert.todayClose > 0
            ? `\u20B9${alert.todayClose.toLocaleString("en-IN")}`
            : "\u2014"}
        </span>
        <span
          className={`font-mono text-[10px] font-semibold tabular-nums ${
            alert.todayChange >= 0 ? "text-accent" : "text-danger"
          }`}
        >
          {alert.todayChange >= 0 ? "+" : ""}
          {alert.todayChange.toFixed(2)}%
        </span>
      </div>

      {/* Break Stats */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-semibold text-text-muted w-2 text-right">H</span>
          <div className="h-[3px] w-10 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-accent animate-bar-fill"
              style={{ "--bar-width": `${Math.min(Math.max(Math.abs(alert.highBreakPercent) / 25 * 100, 10), 100)}%`, width: `${Math.min(Math.max(Math.abs(alert.highBreakPercent) / 25 * 100, 10), 100)}%` } as React.CSSProperties}
            />
          </div>
          <span className="font-mono text-[8px] font-bold tabular-nums text-accent">
            +{alert.highBreakPercent.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-semibold text-text-muted w-2 text-right">V</span>
          <div className="h-[3px] w-10 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400 animate-bar-fill"
              style={{ "--bar-width": `${Math.min(Math.max(Math.abs(alert.volumeBreakPercent) / 25 * 100, 10), 100)}%`, width: `${Math.min(Math.max(Math.abs(alert.volumeBreakPercent) / 25 * 100, 10), 100)}%` } as React.CSSProperties}
            />
          </div>
          <span className="font-mono text-[8px] font-bold tabular-nums text-blue-400">
            +{alert.volumeBreakPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <p className="mt-1.5 font-mono text-[9px] text-text-muted/60">
        {new Date(alert.triggeredAt).toLocaleString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
