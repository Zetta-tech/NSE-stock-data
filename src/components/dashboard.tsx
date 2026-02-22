"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "./header";
import { ScanButton } from "./scan-button";
import { StockCard } from "./stock-card";
import { AlertPanel } from "./alert-panel";
import { TickerPanel } from "./ticker-panel";
import { Nifty50Rail } from "./nifty50-rail";
import { AddStockModal } from "./add-stock-modal";
import { isMarketHours } from "@/lib/market-hours";
import type { WatchlistStock, ScanResult, Alert } from "@/lib/types";

export function Dashboard({
  initialWatchlist,
  initialAlerts,
}: {
  initialWatchlist: WatchlistStock[];
  initialAlerts: Alert[];
}) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [scanning, setScanning] = useState(false);
  const [intraday, setIntraday] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [autoCheckActive, setAutoCheckActive] = useState(false);
  const [lastAutoCheck, setLastAutoCheck] = useState<string | null>(null);

  const prevTriggeredRef = useRef<Set<string>>(new Set());
  const autoCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCheckRunningRef = useRef(false);
  const notifyCooldownRef = useRef<Map<string, number>>(new Map());

  const closeWatchCount = watchlist.filter((s) => s.closeWatch).length;
  const userToggledOffRef = useRef(false);

  useEffect(() => {
    const check = () => {
      const live = isMarketHours();
      if (live && closeWatchCount > 0 && !autoCheckActive && !userToggledOffRef.current) {
        setAutoCheckActive(true);
        reportAction("autocheck-started", "Auto-watch started (market open)", {
          changes: [{ field: "autoCheck", from: false, to: true }],
        });
      } else if (!live && autoCheckActive && !userToggledOffRef.current) {
        setAutoCheckActive(false);
        reportAction("autocheck-stopped", "Auto-watch paused (market closed)", {
          changes: [{ field: "autoCheck", from: true, to: false }],
        });
      }
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [closeWatchCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intraday }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results);
      setAlerts(data.alerts);
      setMarketOpen(data.marketOpen);
      setLastScan(data.scannedAt);

      if (data.alerts.some((a: Alert) => !a.read)) {
        notifyBreakout(
          data.results.filter((r: ScanResult) => r.triggered),
          notifyCooldownRef.current
        );
      }
    } catch {
    } finally {
      setScanning(false);
    }
  }, [intraday]);

  const runCloseWatchCheck = useCallback(async () => {
    if (autoCheckRunningRef.current) return;
    autoCheckRunningRef.current = true;
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intraday: true, closeWatchOnly: true }),
      });
      const data = await res.json();
      if (data.error) return;

      setResults((prev) => {
        const updated = [...prev];
        for (const cwResult of data.results as ScanResult[]) {
          const idx = updated.findIndex((r) => r.symbol === cwResult.symbol);
          if (idx >= 0) {
            updated[idx] = cwResult;
          } else {
            updated.push(cwResult);
          }
        }
        return updated;
      });

      setAlerts(data.alerts);
      setMarketOpen(data.marketOpen);
      setLastAutoCheck(data.scannedAt);

      const prevSet = prevTriggeredRef.current;
      const currentTriggered = new Set<string>();
      const newlyTriggered: ScanResult[] = [];

      for (const r of data.results as ScanResult[]) {
        if (r.triggered) {
          currentTriggered.add(r.symbol);
          if (!prevSet.has(r.symbol)) {
            newlyTriggered.push(r);
          }
        }
      }

      prevTriggeredRef.current = currentTriggered;

      if (newlyTriggered.length > 0) {
        notifyBreakout(newlyTriggered, notifyCooldownRef.current);
      }
    } catch {
    } finally {
      autoCheckRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const shouldRun = autoCheckActive && closeWatchCount > 0;

    if (shouldRun) {
      runCloseWatchCheck();
      autoCheckTimerRef.current = setInterval(runCloseWatchCheck, 30_000);
    }

    return () => {
      if (autoCheckTimerRef.current) {
        clearInterval(autoCheckTimerRef.current);
        autoCheckTimerRef.current = null;
      }
    };
  }, [autoCheckActive, closeWatchCount, runCloseWatchCheck]);

  const toggleCloseWatch = useCallback(async (symbol: string) => {
    const res = await fetch("/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggleCloseWatch", symbol }),
    });
    const data = await res.json();
    if (data.watchlist) setWatchlist(data.watchlist);
  }, []);

  const addStock = useCallback(async (symbol: string, name: string) => {
    const res = await fetch("/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", symbol, name }),
    });
    const data = await res.json();
    if (data.watchlist) setWatchlist(data.watchlist);
  }, []);

  const removeStock = useCallback(async (symbol: string) => {
    const res = await fetch("/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", symbol }),
    });
    const data = await res.json();
    if (data.watchlist) setWatchlist(data.watchlist);
    setResults((prev) => prev.filter((r) => r.symbol !== symbol));
  }, []);

  const markAllRead = useCallback(async () => {
    const res = await fetch("/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead" }),
    });
    const data = await res.json();
    if (data.alerts) setAlerts(data.alerts);
  }, []);

  const markRead = useCallback(async (id: string) => {
    const res = await fetch("/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", alertId: id }),
    });
    const data = await res.json();
    if (data.alerts) setAlerts(data.alerts);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  const triggeredCount = results.filter((r) => r.triggered).length;
  const staleCount = results.filter((r) => r.dataSource === "stale").length;
  const scannedCount = results.length;

  return (
    <div className="min-h-screen">
      <Header
        alerts={alerts}
        onMarkAllRead={markAllRead}
        onMarkRead={markRead}
        marketOpen={marketOpen}
      />

      <div className="mx-auto max-w-[1440px] px-5 pt-6">
        <Nifty50Rail />
      </div>

      <main className="mx-auto max-w-[1440px] px-5 py-8">
        <div className="dashboard-layout gap-6">
          <div className="dashboard-sidebar">
            <AlertPanel alerts={alerts} />
          </div>

          <div className="dashboard-main">
            {scannedCount > 0 && (
              <div className={`mb-8 grid gap-3.5 animate-fade-in ${staleCount > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
                <StatCard
                  label="Scanned"
                  value={scannedCount.toString()}
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  }
                />
                <StatCard
                  label="Breakouts"
                  value={triggeredCount.toString()}
                  accent={triggeredCount > 0}
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  }
                />
                <StatCard
                  label="Alerts"
                  value={alerts.length.toString()}
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  }
                />
                {staleCount > 0 && (
                  <StatCard
                    label="Stale"
                    value={staleCount.toString()}
                    warning
                    icon={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      </svg>
                    }
                  />
                )}
              </div>
            )}

            <TickerPanel
              hasCloseWatchStocks={closeWatchCount > 0}
              scanResults={results}
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-xl font-bold tracking-tight">
                    Starred Stocks
                  </h2>
                  <span className="rounded-lg bg-surface-overlay ring-1 ring-surface-border/50 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-text-muted">
                    {watchlist.length}
                  </span>
                  {closeWatchCount > 0 && (
                    <span className="flex items-center gap-1 rounded-lg bg-warn/8 ring-1 ring-warn/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-warn">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      {closeWatchCount}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  {lastScan && (
                    <p className="flex items-center gap-1.5 text-[10px] text-text-muted">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Last scan {new Date(lastScan).toLocaleTimeString("en-IN")}
                    </p>
                  )}
                  {autoCheckActive && lastAutoCheck && (
                    <p className="flex items-center gap-1.5 text-[10px] text-warn/70">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warn opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warn" />
                      </span>
                      Auto-check {new Date(lastAutoCheck).toLocaleTimeString("en-IN")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {closeWatchCount > 0 && (
                  <button
                    onClick={() => {
                      const next = !autoCheckActive;
                      setAutoCheckActive(next);
                      userToggledOffRef.current = !next;
                      reportAction(
                        next ? "autocheck-started" : "autocheck-stopped",
                        next ? "Started auto-check (30s interval)" : "Stopped auto-check",
                        { changes: [{ field: "autoCheck", from: !next, to: next }] }
                      );
                    }}
                    className={`action-icon-btn ${
                      autoCheckActive
                        ? "ring-warn/25 bg-warn/8 text-warn"
                        : "ring-surface-border bg-surface-raised text-text-secondary hover:ring-warn/25 hover:text-warn"
                    }`}
                    title={autoCheckActive ? "Stop auto-checking starred stocks" : "Auto-check starred stocks every 30s"}
                  >
                    {autoCheckActive ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setModalOpen(true)}
                  className="action-icon-btn ring-surface-border/60 bg-surface-raised text-text-secondary hover:ring-accent/25 hover:text-accent"
                  title="Add stock to watchlist"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <ScanButton
                  onScan={runScan}
                  loading={scanning}
                  intraday={intraday}
                  onToggleIntraday={() => {
                    const next = !intraday;
                    setIntraday(next);
                    reportAction(
                      next ? "intraday-on" : "intraday-off",
                      next ? "Switched to intraday mode" : "Switched to historical mode",
                      { changes: [{ field: "intraday", from: !next, to: next }] }
                    );
                  }}
                />
              </div>
            </div>

            {scanning && (
              <div className="mt-5 overflow-hidden rounded-xl">
                <div className="h-1 w-full animate-shimmer rounded-full bg-surface-overlay" />
              </div>
            )}

            <div className="stock-grid mt-6">
              {watchlist.map((stock, i) => {
                const result = results.find((r) => r.symbol === stock.symbol);
                return (
                  <div key={stock.symbol} style={{ animationDelay: `${i * 50}ms` }} className="animate-fade-in">
                    <StockCard
                      result={
                        result || {
                          symbol: stock.symbol,
                          name: stock.name,
                          triggered: false,
                          todayHigh: 0,
                          todayVolume: 0,
                          prevMaxHigh: 0,
                          prevMaxVolume: 0,
                          highBreakPercent: 0,
                          volumeBreakPercent: 0,
                          todayClose: 0,
                          todayChange: 0,
                          scannedAt: "",
                          dataSource: "historical",
                        }
                      }
                      onRemove={removeStock}
                      closeWatch={stock.closeWatch}
                      onToggleCloseWatch={toggleCloseWatch}
                    />
                  </div>
                );
              })}
            </div>

            {results.length > 0 && triggeredCount === 0 && (
              <div className="mt-10 overflow-hidden rounded-2xl border border-surface-border bg-surface-raised card-elevated px-6 py-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-overlay ring-1 ring-surface-border">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="font-display text-sm font-semibold text-text-secondary">
                  No breakouts detected
                </p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-text-muted">
                  None of your watchlist stocks broke their 5-day high and volume
                  simultaneously. Check back later or add more stocks.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <AddStockModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={addStock}
        currentSymbols={watchlist.map((s) => s.symbol)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  warning,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden flex items-center gap-3.5 rounded-xl p-4 transition-all duration-300 ring-1 ${
      warning
        ? "ring-warn/15 bg-warn/[0.03]"
        : accent
          ? "ring-accent/15 bg-accent/[0.03]"
          : "ring-surface-border/50 bg-surface-raised"
    } card-elevated`}>
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
        warning
          ? "bg-warn/10 text-warn"
          : accent
            ? "bg-accent/10 text-accent"
            : "bg-surface-overlay text-text-muted"
      }`}>
        {icon}
      </div>
      <div>
        <p className={`font-display text-xl font-bold tabular-nums tracking-tight ${
          warning ? "text-warn" : accent ? "text-accent" : ""
        }`}>
          {value}
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">{label}</p>
      </div>
    </div>
  );
}

function reportAction(action: string, label: string, opts?: { detail?: Record<string, unknown>; changes?: { field: string; from?: string | number | boolean; to?: string | number | boolean }[] }) {
  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cat: "user", action, label, actor: "dad", ...opts }),
  }).catch(() => {});
}

const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000;

function notifyBreakout(
  triggered: ScanResult[],
  cooldownMap: Map<string, number>
) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const now = Date.now();

  for (const stock of triggered) {
    const lastNotified = cooldownMap.get(stock.symbol) ?? 0;
    if (now - lastNotified < NOTIFY_COOLDOWN_MS) continue;

    cooldownMap.set(stock.symbol, now);
    new Notification(`Breakout: ${stock.symbol}`, {
      body: `High \u20B9${stock.todayHigh.toLocaleString("en-IN")} (prev max \u20B9${stock.prevMaxHigh.toLocaleString("en-IN")})\nVol ${formatVol(stock.todayVolume)} (prev max ${formatVol(stock.prevMaxVolume)})`,
      icon: "/favicon.ico",
    });
  }
}

function formatVol(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}
