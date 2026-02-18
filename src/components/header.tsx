"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NotificationBell } from "./notification-bell";
import type { Alert, NiftyIndex } from "@/lib/types";

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
  const [nifty, setNifty] = useState<NiftyIndex | null>(null);
  const prevValueRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  const fetchIndex = useCallback(async () => {
    try {
      const res = await fetch("/api/index");
      if (!res.ok) return;
      const data: NiftyIndex = await res.json();
      if (data.value) {
        if (prevValueRef.current !== null && prevValueRef.current !== data.value) {
          setFlash(data.value > prevValueRef.current ? "up" : "down");
          setTimeout(() => setFlash(null), 1200);
        }
        prevValueRef.current = data.value;
        setNifty(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchIndex();
    const interval = setInterval(fetchIndex, 15_000);
    return () => clearInterval(interval);
  }, [fetchIndex]);

  const isUp = nifty ? nifty.change >= 0 : true;

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

        <div className="flex items-center gap-3">
          {/* Nifty 50 Index */}
          {nifty && (
            <div
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-1.5 transition-all duration-300 ${
                flash === "up"
                  ? "border-accent/40 bg-accent/[0.08]"
                  : flash === "down"
                    ? "border-danger/40 bg-danger/[0.08]"
                    : "border-surface-border/60 bg-surface-overlay/40"
              }`}
              title={`Open: ${nifty.open.toLocaleString("en-IN")} · High: ${nifty.high.toLocaleString("en-IN")} · Low: ${nifty.low.toLocaleString("en-IN")} · Prev Close: ${nifty.previousClose.toLocaleString("en-IN")}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Nifty 50
                </span>
                <span className="text-sm font-bold tabular-nums tracking-tight text-text-primary">
                  {nifty.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className={`flex items-center gap-1 ${isUp ? "text-accent" : "text-danger"}`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={isUp ? "" : "rotate-180"}>
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                <span className="text-xs font-semibold tabular-nums">
                  {nifty.change >= 0 ? "+" : ""}{nifty.change.toFixed(2)}
                </span>
                <span className="text-[10px] font-medium tabular-nums opacity-70">
                  ({nifty.changePercent >= 0 ? "+" : ""}{nifty.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}

          {/* Market Status */}
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
