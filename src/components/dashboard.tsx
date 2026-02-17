"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { Header } from "./header";
import { ScanButton } from "./scan-button";
import { StockCard } from "./stock-card";
import { AlertPanel } from "./alert-panel";
import { TickerPanel } from "./ticker-panel";
import { AddStockModal } from "./add-stock-modal";
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
  const [nowTs, setNowTs] = useState(Date.now());

  // Track which symbols were triggered on the previous auto-check cycle
  // so we only alert on transitions (not-triggered → triggered).
  const prevTriggeredRef = useRef<Set<string>>(new Set());
  const autoCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCheckRunningRef = useRef(false);

  // 5-minute cooldown per symbol for browser notifications
  const notifyCooldownRef = useRef<Map<string, number>>(new Map());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const closeWatchCount = watchlist.filter((s) => s.closeWatch).length;
  const closeWatchStocks = useMemo(
    () => watchlist.filter((stock) => stock.closeWatch),
    [watchlist]
  );
  const regularStocks = useMemo(
    () => watchlist.filter((stock) => !stock.closeWatch),
    [watchlist]
  );

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
      // scan failed silently — results stay as-is
    } finally {
      setScanning(false);
    }
  }, [intraday]);

  // Close Watch auto-check: scan only starred stocks every 30s
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

      // Merge close-watch results into existing results
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

      // Alert dedup: only notify on transitions from not-triggered → triggered
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
      // auto-check failed silently
    } finally {
      autoCheckRunningRef.current = false;
    }
  }, []);

  // Start/stop auto-check based on conditions
  useEffect(() => {
    const shouldRun = autoCheckActive && closeWatchCount > 0;

    if (shouldRun) {
      // Run immediately on activation, then every 30s
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

  useEffect(() => {
    if (!autoCheckActive) return;
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [autoCheckActive]);

  useEffect(() => {
    const cards = Array.from(cardRefs.current.values());
    if (cards.length === 0) return;
    gsap.fromTo(
      cards,
      { y: 8, opacity: 0.65 },
      { y: 0, opacity: 1, duration: 0.35, ease: "power2.out", stagger: 0.02 }
    );
  }, [watchlist]);

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
  const liveCount = results.filter((r) => r.dataSource === "live").length;
  const scannedCount = results.length;
  const nextCheckSeconds = autoCheckActive ? Math.max(0, 30 - (Math.floor(nowTs / 1000) % 30)) : null;

  return (
    <div className="min-h-screen">
      <Header
        alerts={alerts}
        onMarkAllRead={markAllRead}
        onMarkRead={markRead}
        marketOpen={marketOpen}
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-7 grid gap-3 rounded-2xl border border-surface-border bg-surface-raised/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusStripPill label="Market" value={marketOpen ? "Open" : "Closed"} tone={marketOpen ? "live" : "muted"} />
          <StatusStripPill label="Mode" value={intraday ? "Intraday" : "Daily"} tone={intraday ? "live" : "muted"} />
          <StatusStripPill
            label="Auto-check"
            value={autoCheckActive ? `Active · ${nextCheckSeconds}s` : "Paused"}
            tone={autoCheckActive ? "watch" : "muted"}
          />
          <StatusStripPill
            label="Data Feed"
            value={scannedCount === 0 ? "Awaiting first scan" : `${liveCount} live · ${staleCount} stale`}
            tone={staleCount > 0 ? "warn" : "live"}
          />
        </div>

        {scannedCount > 0 && (
          <div className={`mb-8 grid gap-3 animate-fade-in ${staleCount > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
            <StatCard
              label="Stocks Scanned"
              value={scannedCount.toString()}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              }
            />
            <StatCard
              label="Breakouts Found"
              value={triggeredCount.toString()}
              accent={triggeredCount > 0}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              }
            />
            <StatCard
              label="Total Alerts"
              value={alerts.length.toString()}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              }
            />
            {staleCount > 0 && (
              <StatCard
                label="Stale Data"
                value={staleCount.toString()}
                warning
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Watchlist</h2>
              <span className="rounded-lg bg-surface-overlay px-2 py-0.5 text-xs font-medium tabular-nums text-text-muted">
                {watchlist.length}
              </span>
              {closeWatchCount > 0 && (
                <span className="flex items-center gap-1 rounded-lg bg-amber-400/10 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {closeWatchCount}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              {lastScan && (
                <p className="flex items-center gap-1.5 text-xs text-text-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Last scan {new Date(lastScan).toLocaleTimeString("en-IN")}
                </p>
              )}
              {autoCheckActive && lastAutoCheck && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400/70">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                  </span>
                  Auto-check {new Date(lastAutoCheck).toLocaleTimeString("en-IN")}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {closeWatchCount > 0 && (
              <button
                onClick={() => {
                  const next = !autoCheckActive;
                  setAutoCheckActive(next);
                  reportAction(
                    next ? "autocheck-started" : "autocheck-stopped",
                    next ? "Started auto-check (30s interval)" : "Stopped auto-check"
                  );
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-xs font-medium transition-all duration-200 ${
                  autoCheckActive
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                    : "border-surface-border bg-surface-raised text-text-secondary hover:border-amber-400/30 hover:text-amber-400"
                }`}
                title={autoCheckActive ? "Stop auto-checking starred stocks" : "Auto-check starred stocks every 30s"}
              >
                {autoCheckActive ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                )}
                {autoCheckActive ? "Watching" : "Auto Watch"}
              </button>
            )}
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-surface-border px-3.5 py-2.5 text-xs font-medium text-text-secondary transition-all duration-200 hover:border-accent/30 hover:bg-accent/[0.04] hover:text-accent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Stock
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
                  next ? "Switched to intraday mode" : "Switched to historical mode"
                );
              }}
            />
          </div>
        </div>

        {scanning && (
          <div className="mt-6 overflow-hidden rounded-xl">
            <div className="h-1 w-full animate-shimmer rounded-full bg-surface-overlay" />
          </div>
        )}

        <section className="mt-6">
          <SectionTitle
            title="Close Watch"
            subtitle="Your priority symbols, always monitored first"
            count={closeWatchStocks.length}
            tone="watch"
          />
          {closeWatchStocks.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {closeWatchStocks.map((stock) => (
                <div
                  key={stock.symbol}
                  ref={(el) => {
                    if (el) cardRefs.current.set(stock.symbol, el);
                    else cardRefs.current.delete(stock.symbol);
                  }}
                >
                  <StockCard
                    result={toStockResult(stock.symbol, stock.name, results)}
                    onRemove={removeStock}
                    closeWatch={stock.closeWatch}
                    onToggleCloseWatch={toggleCloseWatch}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-amber-400/30 bg-amber-400/[0.04] px-5 py-6 text-sm text-amber-300/80">
              Star stocks to pin them here for constant close-watch visibility.
            </div>
          )}
        </section>

        <AlertPanel alerts={alerts} />

        <section className="mt-10">
          <SectionTitle
            title="All Watchlist Stocks"
            subtitle="Secondary queue for broader monitoring"
            count={regularStocks.length}
            tone="default"
          />
          {regularStocks.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {regularStocks.map((stock) => (
                <div
                  key={stock.symbol}
                  ref={(el) => {
                    if (el) cardRefs.current.set(stock.symbol, el);
                    else cardRefs.current.delete(stock.symbol);
                  }}
                >
                  <StockCard
                    result={toStockResult(stock.symbol, stock.name, results)}
                    onRemove={removeStock}
                    closeWatch={stock.closeWatch}
                    onToggleCloseWatch={toggleCloseWatch}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-surface-border bg-surface-raised px-5 py-6 text-sm text-text-muted">
              All stocks are currently in Close Watch.
            </div>
          )}
        </section>

        {results.length > 0 && triggeredCount === 0 && (
          <div className="mt-10 overflow-hidden rounded-2xl border border-surface-border bg-surface-raised px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-overlay ring-1 ring-surface-border">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="text-base font-semibold text-text-secondary">
              No breakouts detected
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
              None of your watchlist stocks broke their 5-day high and volume
              simultaneously. Check back later or add more stocks.
            </p>
          </div>
        )}
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


function SectionTitle({
  title,
  subtitle,
  count,
  tone,
}: {
  title: string;
  subtitle: string;
  count: number;
  tone: "watch" | "default";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h3>
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
              tone === "watch"
                ? "bg-amber-400/15 text-amber-300"
                : "bg-surface-overlay text-text-secondary"
            }`}
          >
            {count}
          </span>
        </div>
        <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
      </div>
      <div className="h-px flex-1 self-center bg-surface-border/50" />
    </div>
  );
}

function StatusStripPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "live" | "warn" | "watch" | "muted";
}) {
  const toneClass =
    tone === "live"
      ? "border-accent/30 bg-accent/[0.06] text-accent"
      : tone === "warn"
        ? "border-warn/30 bg-warn/[0.08] text-warn"
        : tone === "watch"
          ? "border-amber-400/30 bg-amber-400/[0.08] text-amber-300"
          : "border-surface-border bg-surface-overlay/40 text-text-secondary";

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function toStockResult(
  symbol: string,
  name: string,
  results: ScanResult[]
): ScanResult {
  return (
    results.find((item) => item.symbol === symbol) || {
      symbol,
      name,
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
    <div className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
      warning
        ? "border-warn/20 bg-warn/[0.04]"
        : accent
          ? "border-accent/20 bg-accent/[0.04]"
          : "border-surface-border bg-surface-raised"
    }`}>
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
        warning
          ? "bg-warn/15 text-warn"
          : accent
            ? "bg-accent/15 text-accent"
            : "bg-surface-overlay text-text-muted"
      }`}>
        {icon}
      </div>
      <div>
        <p className={`text-xl font-bold tabular-nums tracking-tight ${
          warning ? "text-warn" : accent ? "text-accent" : ""
        }`}>
          {value}
        </p>
        <p className="text-[11px] text-text-muted">{label}</p>
      </div>
    </div>
  );
}

/* Fire-and-forget activity reporter for client-side user actions */
function reportAction(action: string, label: string, detail?: Record<string, unknown>) {
  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cat: "user", action, label, detail }),
  }).catch(() => {});
}

const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

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
