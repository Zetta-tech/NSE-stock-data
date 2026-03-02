"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Alert, AlertRequest } from "@/lib/types";
import { AlertBuilder } from "./alert-builder";

/* ── Per-type visual config ─────────────────────────────────────────── */

interface AlertTypeStyle {
  label: string;
  badge: string;
  ring: string;
  bg: string;
  dot: string;
  text: string;
  badgeBg: string;
  badgeRing: string;
  badgeText: string;
  hoverRing: string;
  hoverBg: string;
  hoverShadow: string;
  chipRing: string;
  chipBg: string;
}

const ALERT_STYLES: Record<string, AlertTypeStyle> = {
  breakout: {
    label: "True Breakout",
    badge: "BREAKOUT",
    ring: "ring-accent/12",
    bg: "bg-accent/[0.02]",
    dot: "bg-accent",
    text: "text-accent",
    badgeBg: "bg-accent/8",
    badgeRing: "ring-accent/15",
    badgeText: "text-accent/70",
    hoverRing: "hover:ring-accent/25",
    hoverBg: "hover:bg-accent/[0.04]",
    hoverShadow: "hover:shadow-[rgba(0,230,138,0.1)]",
    chipRing: "ring-accent/15",
    chipBg: "bg-accent/[0.04]",
  },
  "low-breakout": {
    label: "Low Breakout",
    badge: "LOW BREAK",
    ring: "ring-amber-500/12",
    bg: "bg-amber-500/[0.02]",
    dot: "bg-amber-400",
    text: "text-amber-400",
    badgeBg: "bg-amber-500/8",
    badgeRing: "ring-amber-500/15",
    badgeText: "text-amber-400/70",
    hoverRing: "hover:ring-amber-500/25",
    hoverBg: "hover:bg-amber-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(245,158,11,0.1)]",
    chipRing: "ring-amber-500/15",
    chipBg: "bg-amber-500/[0.04]",
  },
  "week-high": {
    label: "52 Week High",
    badge: "52W HIGH",
    ring: "ring-purple-500/12",
    bg: "bg-purple-500/[0.02]",
    dot: "bg-purple-400",
    text: "text-purple-400",
    badgeBg: "bg-purple-500/8",
    badgeRing: "ring-purple-500/15",
    badgeText: "text-purple-400/70",
    hoverRing: "hover:ring-purple-500/25",
    hoverBg: "hover:bg-purple-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(168,85,247,0.1)]",
    chipRing: "ring-purple-500/15",
    chipBg: "bg-purple-500/[0.04]",
  },
  "ma200-touch": {
    label: "200 DMA Touch",
    badge: "200 DMA",
    ring: "ring-sky-500/12",
    bg: "bg-sky-500/[0.02]",
    dot: "bg-sky-400",
    text: "text-sky-400",
    badgeBg: "bg-sky-500/8",
    badgeRing: "ring-sky-500/15",
    badgeText: "text-sky-400/70",
    hoverRing: "hover:ring-sky-500/25",
    hoverBg: "hover:bg-sky-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(14,165,233,0.1)]",
    chipRing: "ring-sky-500/15",
    chipBg: "bg-sky-500/[0.04]",
  },
  "ma100-touch": {
    label: "100 DMA Touch",
    badge: "100 DMA",
    ring: "ring-teal-500/12",
    bg: "bg-teal-500/[0.02]",
    dot: "bg-teal-400",
    text: "text-teal-400",
    badgeBg: "bg-teal-500/8",
    badgeRing: "ring-teal-500/15",
    badgeText: "text-teal-400/70",
    hoverRing: "hover:ring-teal-500/25",
    hoverBg: "hover:bg-teal-500/[0.04]",
    hoverShadow: "hover:shadow-[rgba(20,184,166,0.1)]",
    chipRing: "ring-teal-500/15",
    chipBg: "bg-teal-500/[0.04]",
  },
};

const DEFAULT_STYLE = ALERT_STYLES.breakout;

function getStyle(alertType?: string): AlertTypeStyle {
  if (!alertType || alertType === "scan") return DEFAULT_STYLE;
  return ALERT_STYLES[alertType] ?? DEFAULT_STYLE;
}

function getTodayIST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )
    .toISOString()
    .slice(0, 10);
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function stripPrefix(text: string): string {
  return text.replace(/^Create Alert:\s*/i, "");
}

function deriveAlertName(text: string): string {
  const raw = stripPrefix(text).trim();
  const capped = raw.charAt(0).toUpperCase() + raw.slice(1);
  return capped.length > 30 ? capped.slice(0, 27) + "..." : capped;
}

/* ── Main Component ─────────────────────────────────────────────────── */

export function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const [alertRequests, setAlertRequests] = useState<AlertRequest[]>([]);

  const inProgressRequests = alertRequests.filter(
    (r) => r.status !== "implemented" && r.status !== "rejected"
  );

  const activeAlertTypes = useMemo(() => {
    const included = new Set<string>();
    const types: { id: string; name: string }[] = [];

    for (const id of Object.keys(ALERT_STYLES)) {
      included.add(id);
      types.push({ id, name: ALERT_STYLES[id].label });
    }

    for (const alert of alerts) {
      const t = alert.alertType;
      if (!t || t === "scan" || included.has(t)) continue;
      included.add(t);
      const name = t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      types.push({ id: t, name });
    }

    return types;
  }, [alerts]);

  const todayAlerts = useMemo(() => {
    const today = getTodayIST();
    return alerts
      .filter((a) => a.triggeredAt.slice(0, 10) === today)
      .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
  }, [alerts]);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/alert-requests");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAlertRequests(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleRequestSubmitted = useCallback(() => {
    setTimeout(fetchRequests, 500);
  }, [fetchRequests]);

  return (
    <div className="animate-fade-in">
      <div
        className="rounded-2xl ring-1 ring-surface-border/50 card-elevated"
        style={{
          background: "linear-gradient(180deg, rgba(14, 16, 23, 1) 0%, rgba(11, 13, 18, 1) 100%)",
        }}
      >
        {/* Accent top edge */}
        <div
          className="h-[1px] rounded-t-2xl"
          style={{
            background: "linear-gradient(90deg, transparent 10%, rgba(0, 230, 138, 0.15) 50%, transparent 90%)",
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 pt-3.5 pb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <h2 className="font-display text-sm font-bold tracking-tight">Alert Types</h2>
          <span className="ml-auto font-mono text-[10px] font-bold tabular-nums text-accent/50">
            {activeAlertTypes.length + inProgressRequests.length}
          </span>
        </div>

        {/* Alert type chips — color-coded per type */}
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {activeAlertTypes.map((type) => {
            const s = ALERT_STYLES[type.id] ?? DEFAULT_STYLE;
            return (
              <div
                key={type.id}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 ring-1 ${s.chipRing} ${s.chipBg}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                <span className="text-[11px] font-medium text-text-primary/90">{type.name}</span>
              </div>
            );
          })}

          {inProgressRequests.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 ring-1 ring-amber-500/15 bg-amber-500/[0.04]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70 animate-pulse" />
              <span className="text-[11px] font-medium text-text-primary/70">{deriveAlertName(req.text)}</span>
              <span className="text-[8px] font-bold uppercase tracking-wider text-amber-400/50">building</span>
            </div>
          ))}
        </div>

        {/* Fired alerts feed — today's alerts as horizontal cards */}
        {todayAlerts.length > 0 && (
          <>
            <div className="mx-5 border-t border-surface-border/20" />
            <div className="flex items-center justify-between px-5 pt-2.5 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
                  Today
                </span>
                <span className="rounded-md bg-surface-overlay ring-1 ring-surface-border/50 px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-text-muted">
                  {todayAlerts.length}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-thin px-3 pb-3">
              <div className="flex gap-2.5" style={{ width: "max-content" }}>
                {todayAlerts.map((alert, i) => (
                  <FiredAlertCard key={alert.id} alert={alert} index={i} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Separator */}
        <div className="mx-5 border-t border-surface-border/30" />

        {/* Alert Builder */}
        <div className="px-5 pt-3 pb-4">
          <AlertBuilder onSubmitted={handleRequestSubmitted} />
        </div>
      </div>
    </div>
  );
}

/* ── Fired Alert Card ───────────────────────────────────────────────── */

function FiredAlertCard({ alert, index }: { alert: Alert; index: number }) {
  const s = getStyle(alert.alertType);
  const isUnread = !alert.read;

  return (
    <div
      className={`group relative flex flex-col rounded-[1.5rem] pl-5 pr-4 py-3.5 ring-1 ${s.ring} ${s.bg} ${s.hoverRing} ${s.hoverBg} transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:shadow-lg ${s.hoverShadow} animate-fade-in`}
      style={{ minWidth: 180, width: 180, animationDelay: `${index * 60}ms` }}
    >
      {/* Left color stripe */}
      <div className={`absolute left-0 top-4 bottom-4 w-[2px] rounded-full ${s.dot} opacity-40`} />

      {/* Unread pulse dot */}
      {isUnread && (
        <div className="absolute right-2.5 top-2.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-50`} />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
          </span>
        </div>
      )}

      {/* Symbol & Type Badge */}
      <div className="flex items-center gap-1.5">
        <span className={`font-display text-xs font-bold tracking-tight ${s.text}`}>
          {alert.symbol}
        </span>
        <span className={`rounded ${s.badgeBg} ring-1 ${s.badgeRing} px-1 py-px text-[8px] font-bold uppercase tracking-widest ${s.badgeText}`}>
          {s.badge}
        </span>
      </div>

      {/* Price & Change */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-sm font-bold tabular-nums tracking-tight text-text-primary">
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

      {/* Type-Specific Metrics */}
      <div className="mt-2 space-y-1">
        <AlertMetrics alert={alert} s={s} />
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

/* ── Type-specific metrics ──────────────────────────────────────────── */

function AlertMetrics({ alert, s }: { alert: Alert; s: AlertTypeStyle }) {
  const t = alert.alertType;

  // Breakout / Low-breakout / scan / undefined → H and V bars
  if (!t || t === "scan" || t === "breakout" || t === "low-breakout") {
    const barColor = t === "low-breakout" ? "bg-amber-400" : "bg-accent";
    const barPct = (v: number) => Math.min(Math.max(Math.abs(v) / 25 * 100, 10), 100);
    return (
      <>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold text-text-muted w-2 text-right">H</span>
          <div className="h-[3px] w-12 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor} animate-bar-fill`}
              style={{ "--bar-width": `${barPct(alert.highBreakPercent)}%`, width: `${barPct(alert.highBreakPercent)}%` } as React.CSSProperties}
            />
          </div>
          <span className={`font-mono text-[9px] font-bold tabular-nums ${s.text}`}>
            +{alert.highBreakPercent.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold text-text-muted w-2 text-right">V</span>
          <div className="h-[3px] w-12 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-400 animate-bar-fill"
              style={{ "--bar-width": `${barPct(alert.volumeBreakPercent)}%`, width: `${barPct(alert.volumeBreakPercent)}%` } as React.CSSProperties}
            />
          </div>
          <span className="font-mono text-[9px] font-bold tabular-nums text-blue-400">
            +{alert.volumeBreakPercent.toFixed(1)}%
          </span>
        </div>
      </>
    );
  }

  // 52 Week High
  if (t === "week-high") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">52W</span>
        <span className={`font-mono text-[10px] font-bold tabular-nums ${s.text}`}>
          {"\u20B9"}{(alert.yearHigh ?? alert.todayHigh).toLocaleString("en-IN")}
        </span>
      </div>
    );
  }

  // 200 DMA Touch
  if (t === "ma200-touch") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">DMA</span>
          <span className={`font-mono text-[10px] font-bold tabular-nums ${s.text}`}>
            {"\u20B9"}{(alert.ma200 ?? 0).toLocaleString("en-IN")}
          </span>
        </div>
        {alert.ma200TouchPercent != null && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-text-muted">Gap</span>
            <span className={`font-mono text-[9px] font-bold tabular-nums ${s.text}`}>
              {alert.ma200TouchPercent >= 0 ? "+" : ""}{alert.ma200TouchPercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  // 100 DMA Touch
  if (t === "ma100-touch") {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">DMA</span>
          <span className={`font-mono text-[10px] font-bold tabular-nums ${s.text}`}>
            {"\u20B9"}{(alert.ma100 ?? 0).toLocaleString("en-IN")}
          </span>
        </div>
        {alert.ma100TouchPercent != null && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-text-muted">Gap</span>
            <span className={`font-mono text-[9px] font-bold tabular-nums ${s.text}`}>
              {alert.ma100TouchPercent >= 0 ? "+" : ""}{alert.ma100TouchPercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
