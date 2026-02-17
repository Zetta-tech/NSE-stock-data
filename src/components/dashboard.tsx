"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { Header } from "./header";
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

  const prevTriggeredRef = useRef<Set<string>>(new Set());
  const autoCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCheckRunningRef = useRef(false);
  const notifyCooldownRef = useRef<Map<string, number>>(new Map());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const closeWatchStocks = useMemo(
    () => watchlist.filter((stock) => stock.closeWatch),
    [watchlist]
  );
  const regularStocks = useMemo(
    () => watchlist.filter((stock) => !stock.closeWatch),
    [watchlist]
  );
  const closeWatchCount = closeWatchStocks.length;

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
          if (idx >= 0) updated[idx] = cwResult;
          else updated.push(cwResult);
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
        if (!r.triggered) continue;
        currentTriggered.add(r.symbol);
        if (!prevSet.has(r.symbol)) newlyTriggered.push(r);
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
  const staleCloseWatch = closeWatchStocks.filter((stock) => {
    const result = results.find((r) => r.symbol === stock.symbol);
    return result?.dataSource === "stale";
  }).length;
  const nextCheckSeconds = autoCheckActive
    ? Math.max(0, 30 - (Math.floor(nowTs / 1000) % 30))
    : null;

  return (
    <div className="min-h-screen">
      <Header
        alerts={alerts}
        onMarkAllRead={markAllRead}
        onMarkRead={markRead}
        marketOpen={marketOpen}
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-3xl border border-surface-border bg-surface-raised/70 p-5 md:p-6">
        <SystemStatus
          marketOpen={marketOpen}
          intraday={intraday}
          autoCheckActive={autoCheckActive}
          nextCheckSeconds={nextCheckSeconds}
          liveCount={liveCount}
          staleCount={staleCount}
          scannedCount={scannedCount}
        />

        {scannedCount > 0 && (
          <div className={`mb-8 mt-5 grid gap-3 animate-fade-in ${staleCount > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
            <StatCard label="Stocks Scanned" value={scannedCount.toString()} icon={<SearchIcon />} />
            <StatCard label="Breakouts Found" value={triggeredCount.toString()} accent={triggeredCount > 0} icon={<BoltIcon />} />
            <StatCard label="Total Alerts" value={alerts.length.toString()} icon={<BellIcon />} />
            {staleCount > 0 && <StatCard label="Stale Data" value={staleCount.toString()} warning icon={<WarnIcon />} />}
          </div>
        )}

        <TickerPanel hasCloseWatchStocks={closeWatchCount > 0} scanResults={results} />

        <div className="mt-2 flex flex-col gap-5 rounded-2xl border border-surface-border bg-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
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
              {lastScan && <p className="text-xs text-text-muted">Last scan {new Date(lastScan).toLocaleTimeString("en-IN")}</p>}
              {autoCheckActive && lastAutoCheck && (
                <p className="text-xs text-amber-400/80">Auto-check {new Date(lastAutoCheck).toLocaleTimeString("en-IN")}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-lg border border-dashed border-surface-border px-3.5 py-2.5 text-xs font-medium text-text-secondary transition-all hover:border-accent/30 hover:text-accent"
            >
              Add Stock
            </button>
            <button
              onClick={() => {
                const next = !intraday;
                setIntraday(next);
                reportAction(next ? "intraday-on" : "intraday-off", next ? "Switched to intraday mode" : "Switched to historical mode");
              }}
              className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium transition-all ${
                intraday
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-surface-border bg-surface-raised text-text-secondary hover:text-text-primary"
              }`}
            >
              {intraday ? "Intraday" : "Daily"}
            </button>

            {marketOpen ? (
              <button
                onClick={() => {
                  const next = !autoCheckActive;
                  setAutoCheckActive(next);
                  reportAction(next ? "autocheck-started" : "autocheck-stopped", next ? "Started auto-check" : "Stopped auto-check");
                }}
                disabled={closeWatchCount === 0}
                className={`min-w-[220px] rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                  autoCheckActive
                    ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
                    : "border-accent/35 bg-accent/15 text-accent"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div>{autoCheckActive ? "Auto-check ON" : "Start Auto-check"}</div>
                <div className="mt-1 text-xs font-medium text-current/80">
                  {closeWatchCount === 0 ? "Add a Close Watch stock first" : `Next scan in ${nextCheckSeconds}s`}
                </div>
              </button>
            ) : (
              <button
                onClick={runScan}
                disabled={scanning}
                className="min-w-[220px] rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-3 text-left text-sm font-semibold text-surface transition-all disabled:opacity-60"
              >
                <div>{scanning ? "Running Scan..." : "Run Manual Scan"}</div>
                <div className="mt-1 text-xs font-medium text-surface/80">Market closed · auto-check paused</div>
              </button>
            )}
          </div>
        </div>

        {staleCloseWatch > 0 && (
          <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-sm text-amber-200">
            Live data unavailable for {staleCloseWatch} Close Watch stock{staleCloseWatch > 1 ? "s" : ""} — alerts are paused for those symbols.
          </div>
        )}

        <section className="mt-6">
          <SectionTitle title="Close Watch" subtitle="Your priority symbols, always monitored first" count={closeWatchStocks.length} tone="watch" />
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
          <SectionTitle title="All Watchlist Stocks" subtitle="Secondary queue for broader monitoring" count={regularStocks.length} tone="default" />
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

function SystemStatus({
  marketOpen,
  intraday,
  autoCheckActive,
  nextCheckSeconds,
  liveCount,
  staleCount,
  scannedCount,
}: {
  marketOpen: boolean;
  intraday: boolean;
  autoCheckActive: boolean;
  nextCheckSeconds: number | null;
  liveCount: number;
  staleCount: number;
  scannedCount: number;
}) {
  const headline = marketOpen
    ? `Live • Auto-check ${autoCheckActive ? "ON" : "OFF"} • Next ${nextCheckSeconds}s`
    : "Market Closed • Manual scan mode";

  return (
    <details className="group mb-2 overflow-hidden rounded-2xl border border-surface-border bg-surface-overlay/70 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-text-muted">System Status</p>
            <p className="text-sm font-semibold text-text-primary">{headline}</p>
          </div>
          <span className="text-xs text-text-muted">Details</span>
        </div>
      </summary>
      <div className="grid gap-2 border-t border-surface-border px-4 py-3 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
        <p>Market: {marketOpen ? "Open" : "Closed"}</p>
        <p>Mode: {intraday ? "Intraday" : "Daily"}</p>
        <p>Auto-check: {autoCheckActive ? `On · ${nextCheckSeconds}s` : "Paused"}</p>
        <p>Data: {scannedCount === 0 ? "Awaiting first scan" : `${liveCount} live · ${staleCount} stale`}</p>
      </div>
    </details>
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

function toStockResult(symbol: string, name: string, results: ScanResult[]): ScanResult {
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
        <p className={`text-xl font-bold tabular-nums tracking-tight ${warning ? "text-warn" : accent ? "text-accent" : ""}`}>
          {value}
        </p>
        <p className="text-[11px] text-text-muted">{label}</p>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

function reportAction(action: string, label: string, detail?: Record<string, unknown>) {
  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cat: "user", action, label, detail }),
  }).catch(() => {});
}

const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000;

function notifyBreakout(triggered: ScanResult[], cooldownMap: Map<string, number>) {
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
