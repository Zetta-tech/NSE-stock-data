"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "./header";
import { ScanButton } from "./scan-button";
import { StockCard } from "./stock-card";
import { AlertPanel } from "./alert-panel";
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
        notifyBreakout(data.results.filter((r: ScanResult) => r.triggered));
      }
    } catch {
      // scan failed silently — results stay as-is
    } finally {
      setScanning(false);
    }
  }, [intraday]);

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
  const scannedCount = results.length;

  return (
    <div className="min-h-screen">
      <Header
        alerts={alerts}
        onMarkAllRead={markAllRead}
        onMarkRead={markRead}
        marketOpen={marketOpen}
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {scannedCount > 0 && (
          <div className="mb-8 grid grid-cols-3 gap-3 animate-fade-in">
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
          </div>
        )}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Watchlist</h2>
              <span className="rounded-lg bg-surface-overlay px-2 py-0.5 text-xs font-medium tabular-nums text-text-muted">
                {watchlist.length}
              </span>
            </div>
            {lastScan && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Last scan {new Date(lastScan).toLocaleTimeString("en-IN")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
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
              onToggleIntraday={() => setIntraday(!intraday)}
            />
          </div>
        </div>

        {scanning && (
          <div className="mt-6 overflow-hidden rounded-xl">
            <div className="h-1 w-full animate-shimmer rounded-full bg-surface-overlay" />
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {watchlist.map((stock, i) => {
            const result = results.find((r) => r.symbol === stock.symbol);
            return (
              <div
                key={stock.symbol}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
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
                    }
                  }
                  onRemove={removeStock}
                />
              </div>
            );
          })}
        </div>

        <AlertPanel alerts={alerts} />

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

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
      accent
        ? "border-accent/20 bg-accent/[0.04]"
        : "border-surface-border bg-surface-raised"
    }`}>
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
        accent ? "bg-accent/15 text-accent" : "bg-surface-overlay text-text-muted"
      }`}>
        {icon}
      </div>
      <div>
        <p className={`text-xl font-bold tabular-nums tracking-tight ${accent ? "text-accent" : ""}`}>
          {value}
        </p>
        <p className="text-[11px] text-text-muted">{label}</p>
      </div>
    </div>
  );
}

function notifyBreakout(triggered: ScanResult[]) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  for (const stock of triggered) {
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
