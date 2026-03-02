"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Alert, AlertRequest } from "@/lib/types";
import { AlertBuilder } from "./alert-builder";

const ALERT_TYPE_LABELS: Record<string, string> = {
  breakout: "True Breakout",
  "low-breakout": "Low Breakout",
  "week-high": "52 Week High",
  "ma200-touch": "200 DMA Touch",
  "ma100-touch": "100 DMA Touch",
  "ma5-touch": "5 DMA Touch",
};

function stripPrefix(text: string): string {
  return text.replace(/^Create Alert:\s*/i, "");
}

function deriveAlertName(text: string): string {
  const raw = stripPrefix(text).trim();
  const capped = raw.charAt(0).toUpperCase() + raw.slice(1);
  return capped.length > 30 ? capped.slice(0, 27) + "..." : capped;
}

export function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const [alertRequests, setAlertRequests] = useState<AlertRequest[]>([]);

  const inProgressRequests = alertRequests.filter(
    (r) => r.status !== "implemented" && r.status !== "rejected"
  );

  const activeAlertTypes = useMemo(() => {
    const included = new Set<string>();
    const types: { id: string; name: string }[] = [];

    for (const [id, name] of Object.entries(ALERT_TYPE_LABELS)) {
      included.add(id);
      types.push({ id, name });
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

        {/* Alert type chips — always visible */}
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {activeAlertTypes.map((type) => (
            <div
              key={type.id}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 ring-1 ring-accent/15 bg-accent/[0.04]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_4px_rgba(0,230,138,0.4)]" />
              <span className="text-[11px] font-medium text-text-primary/90">{type.name}</span>
            </div>
          ))}

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
