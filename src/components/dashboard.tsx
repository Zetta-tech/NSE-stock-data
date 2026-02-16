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
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Watchlist</h2>
            <div className="mt-1 flex items-center gap-4 text-xs text-text-muted">
              <span>{watchlist.length} stocks</span>
              {lastScan && (
                <>
                  <span className="h-1 w-1 rounded-full bg-surface-border" />
                  <span>
                    Last scan:{" "}
                    {new Date(lastScan).toLocaleTimeString("en-IN")}
                  </span>
                </>
              )}
              {scannedCount > 0 && (
                <>
                  <span className="h-1 w-1 rounded-full bg-surface-border" />
                  <span>
                    {triggeredCount}/{scannedCount} breakouts
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-surface-border px-3 py-2 text-xs text-text-secondary transition-all hover:border-accent/30 hover:text-accent"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
          <div className="mt-8 rounded-xl border border-surface-border bg-surface-raised px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-overlay">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-text-muted"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="text-sm font-medium text-text-secondary">
              No breakouts detected
            </p>
            <p className="mt-1 text-xs text-text-muted">
              None of your watchlist stocks broke their 5-day high and volume
              simultaneously.
            </p>
          </div>
        )}
      </main>

      <AddStockModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={addStock}
      />
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
      body: `High ₹${stock.todayHigh.toLocaleString("en-IN")} (prev max ₹${stock.prevMaxHigh.toLocaleString("en-IN")})\nVol ${formatVol(stock.todayVolume)} (prev max ${formatVol(stock.prevMaxVolume)})`,
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
