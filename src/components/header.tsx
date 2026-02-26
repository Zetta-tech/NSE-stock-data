"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NotificationBell } from "./notification-bell";
import { AdminControls } from "./admin-controls";
import { isExtendedHours } from "@/lib/market-hours";
import type { Alert, NiftyIndex } from "@/lib/types";

const NIFTY_POLL_LIVE = 15_000;

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
  const hasFetchedOnceRef = useRef(false);

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
        hasFetchedOnceRef.current = true;
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchIndex();
    if (!isExtendedHours()) return;
    const interval = setInterval(() => {
      if (isExtendedHours()) fetchIndex();
    }, NIFTY_POLL_LIVE);
    return () => clearInterval(interval);
  }, [fetchIndex]);

  const isUp = nifty ? nifty.change >= 0 : true;
  const isLive = isExtendedHours();

  return (
    <header className="sticky top-0 z-30 glass">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-accent/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-surface-border/50 to-transparent" />

      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-accent/[0.08] ring-1 ring-accent/15">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-accent"
              >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <div className="absolute -inset-1 rounded-xl bg-accent/5 blur-lg animate-glow-pulse" />
            </div>
            <div>
              <h1 className="font-display text-base font-bold tracking-tight leading-tight">
                Nifty <span className="text-gradient">Breakout</span> Scanner
              </h1>
              <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-text-muted">
                5-day high &amp; volume detection
              </p>
            </div>
          </div>

          <div className="hidden md:block h-8 w-px bg-surface-border/30" />

          {nifty && (
            <div
              className={`hidden md:flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-300 ring-1 ${
                flash === "up"
                  ? "ring-accent/30 bg-accent/[0.06]"
                  : flash === "down"
                    ? "ring-danger/30 bg-danger/[0.06]"
                    : "ring-surface-border/40 bg-surface-overlay/20"
              }`}
              title={`Open: ${nifty.open.toLocaleString("en-IN")} · High: ${nifty.high.toLocaleString("en-IN")} · Low: ${nifty.low.toLocaleString("en-IN")} · Prev Close: ${nifty.previousClose.toLocaleString("en-IN")}`}
            >
              <span className="font-display text-[9px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Nifty 50
              </span>
              <span className="font-mono text-sm font-bold tabular-nums tracking-tight text-text-primary">
                {nifty.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </span>
              <div className="h-3.5 w-px bg-surface-border/40" />
              <div className={`flex items-center gap-1 ${isUp ? "text-accent" : "text-danger"}`}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`transition-transform duration-300 ${isUp ? "" : "rotate-180"}`}>
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                <span className="font-mono text-xs font-semibold tabular-nums">
                  {nifty.change >= 0 ? "+" : ""}{nifty.change.toFixed(2)}
                </span>
                <span className="font-mono text-[10px] font-medium tabular-nums opacity-50">
                  ({nifty.changePercent >= 0 ? "+" : ""}{nifty.changePercent.toFixed(2)}%)
                </span>
              </div>
              {!isLive && (
                <span className="text-[8px] font-semibold uppercase tracking-wider text-text-muted/30">Close</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl ring-1 ring-surface-border/40 bg-surface-overlay/20 px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${
                  marketOpen ? "bg-accent animate-ping opacity-75" : ""
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full transition-colors duration-500 ${
                  marketOpen ? "bg-accent shadow-[0_0_6px_rgba(0,230,138,0.5)]" : "bg-text-muted"
                }`}
              />
            </span>
            <span className="text-xs font-semibold text-text-secondary">
              {marketOpen ? "Open" : "Closed"}
            </span>
          </div>
          <AdminControls />
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
