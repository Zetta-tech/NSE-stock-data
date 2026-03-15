"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import gsap from "gsap";
import { Activity } from "lucide-react";
import { Header } from "./header";
import { ScanButton } from "./scan-button";
import { StockCard } from "./stock-card";
import { TickerPanel } from "./ticker-panel";
import { Nifty50Rail } from "./nifty50-rail";
import { DiscoveryFeed } from "./discovery-feed";
import { AddStockModal } from "./add-stock-modal";
import { AlertsSection } from "./alerts-section";
import { AlertBuilder } from "./alert-builder";
import { isMarketHours } from "@/lib/market-hours";
import type { WatchlistStock, ScanResult, Alert, DiscoveryStock } from "@/lib/types";

export function Dashboard({
  initialWatchlist,
  initialAlerts,
  initialResults = [],
}: {
  initialWatchlist: WatchlistStock[];
  initialAlerts: Alert[];
  initialResults?: ScanResult[];
}) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [results, setResults] = useState<ScanResult[]>(initialResults);
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [scanning, setScanning] = useState(false);
  const [intraday, setIntraday] = useState(() => isMarketHours());
  const [modalOpen, setModalOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [autoCheckActive, setAutoCheckActive] = useState(false);
  const [lastAutoCheck, setLastAutoCheck] = useState<string | null>(null);
  const [discoveries, setDiscoveries] = useState<DiscoveryStock[]>([]);
  const [alertRefreshTrigger, setAlertRefreshTrigger] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);

  const prevTriggeredRef = useRef<Set<string>>(new Set());
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCheckRunningRef = useRef(false);
  const pollIntervalRef = useRef(30_000);
  const notifyCooldownRef = useRef<Map<string, number>>(new Map());
  const discoveryCooldownRef = useRef<Map<string, number>>(new Map());

  const closeWatchCount = watchlist.filter((s) => s.closeWatch).length;
  const userToggledOffRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Stagger entrance for main sections
      gsap.fromTo(
        ".dashboard-section",
        { y: prefersReducedMotion ? 0 : 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: "power3.out" }
      );

      // Cards entrance
      gsap.to(".stock-card-wrapper", {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: prefersReducedMotion ? 0.01 : 0.6,
        stagger: prefersReducedMotion ? 0 : 0.08,
        ease: "back.out(1.2)",
        delay: 0.3
      });
    }, containerRef);
    return () => ctx.revert();
  }, [watchlist.length]);

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

  const refreshAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/stocks");
      const data = await res.json();
      if (data.alerts) setAlerts(data.alerts);
    } catch { /* silent */ }
  }, []);

  const handleDiscoveries = useCallback(
    (stocks: DiscoveryStock[], newAlertCount: number) => {
      setDiscoveries(stocks);

      // Refresh alerts from the store if the nifty50 endpoint created new ones
      if (newAlertCount > 0) {
        refreshAlerts();
      }

      // Fire browser notifications for new breakout discoveries
      if (stocks.length > 0) {
        notifyDiscoveries(stocks, discoveryCooldownRef.current);
      }
    },
    [refreshAlerts],
  );

  useEffect(() => {
    return () => {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    };
  }, []);

  const startLockCountdown = useCallback((seconds: number) => {
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    setLockCountdown(seconds);
    lockTimerRef.current = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev <= 1) {
          if (lockTimerRef.current) {
            clearInterval(lockTimerRef.current);
            lockTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

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

      if (data.lockHeld) {
        startLockCountdown(data.lockExpiresIn ?? 30);
        setResults(data.results);
        setAlerts(data.alerts);
        return;
      }

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
  }, [intraday, startLockCountdown]);

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
      if (data.error) {
        if (data.nextPollMs && data.nextPollMs !== pollIntervalRef.current) {
          pollIntervalRef.current = data.nextPollMs;
          if (autoCheckTimerRef.current) {
            clearInterval(autoCheckTimerRef.current);
            autoCheckTimerRef.current = setInterval(runCloseWatchCheck, data.nextPollMs);
          }
        }
        return;
      }

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

      const serverPoll = data.nextPollMs as number | undefined;
      if (serverPoll && serverPoll !== pollIntervalRef.current) {
        pollIntervalRef.current = serverPoll;
        if (autoCheckTimerRef.current) {
          clearInterval(autoCheckTimerRef.current);
          autoCheckTimerRef.current = setInterval(runCloseWatchCheck, serverPoll);
        }
      }
    } catch {
    } finally {
      autoCheckRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const shouldRun = autoCheckActive && closeWatchCount > 0;

    const startPolling = () => {
      if (autoCheckTimerRef.current) return;
      runCloseWatchCheck();
      autoCheckTimerRef.current = setInterval(runCloseWatchCheck, pollIntervalRef.current);
    };

    const stopPolling = () => {
      if (autoCheckTimerRef.current) {
        clearInterval(autoCheckTimerRef.current);
        autoCheckTimerRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (!shouldRun) return;
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    if (shouldRun && !document.hidden) {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
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

  const addDiscoveryToWatchlist = useCallback(
    async (symbol: string, name: string) => {
      await addStock(symbol, name);
      // Remove from discoveries since it's now in the watchlist
      setDiscoveries((prev) => prev.filter((d) => d.symbol !== symbol));
    },
    [addStock],
  );

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

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0B0F14] text-[#E6EDF7] relative selection:bg-accent/30 selection:text-white pb-10">
      <div className="fixed inset-0 pointer-events-none opacity-5 mix-blend-overlay z-50 overflow-hidden" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} />
      <Header
        alerts={alerts}
        onMarkAllRead={markAllRead}
        onMarkRead={markRead}
        marketOpen={marketOpen}
      />

      <div className="w-full px-6 md:px-10 pt-6 dashboard-section flex flex-col gap-6 relative z-10 mx-auto max-w-[1800px]">
        <Nifty50Rail onDiscoveries={handleDiscoveries} />

        <TickerPanel
          hasCloseWatchStocks={closeWatchCount > 0}
          scanResults={results}
        />

        <div className="rounded-[2.5rem] border border-white/5 bg-[#101826]/80 backdrop-blur-3xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] overflow-hidden relative">
          <AlertBuilder onSubmitted={() => setAlertRefreshTrigger(prev => prev + 1)} />
        </div>
      </div>

      <main className="w-full py-10 dashboard-section relative z-10 mx-auto max-w-[1800px] overflow-x-auto">
        <div className="flex flex-col xl:grid xl:grid-cols-[minmax(330px,1fr)_minmax(1000px,2.5fr)_minmax(330px,1fr)] gap-8 2xl:gap-12 items-start xl:min-w-[1760px] px-6 md:px-10 pb-4">

          {/* Left Column: Alerts */}
          <div className="flex flex-col rounded-[2.5rem] w-full">
            <AlertsSection alerts={alerts} refreshTrigger={alertRefreshTrigger} />
          </div>

          {/* Center Column: Dashboard */}
          <div className="flex flex-col gap-8 w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-xl font-bold tracking-tight text-[#E6EDF7]">
                    Starred Stocks
                  </h2>
                  <span className="rounded-lg bg-[#121C2B] ring-1 ring-white/10 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#A8B3C7]">
                    {watchlist.length}
                  </span>
                  {closeWatchCount > 0 && (
                    <span className="flex items-center gap-1 rounded-lg bg-warn/10 ring-1 ring-warn/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-warn">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      {closeWatchCount}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  {lastScan && (
                    <p className="flex items-center gap-1.5 text-[10px] text-[#A8B3C7]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Last scan {new Date(lastScan).toLocaleTimeString("en-IN")}
                    </p>
                  )}
                  {autoCheckActive && lastAutoCheck && (
                    <p className="flex items-center gap-1.5 text-[10px] text-warn/80">
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
                    className={`action-icon-btn ${autoCheckActive
                      ? "ring-warn/30 bg-warn/10 text-warn hover:scale-[1.03] transition-transform duration-300"
                      : "ring-white/10 bg-[#121C2B] text-[#A8B3C7] hover:ring-warn/30 hover:text-warn hover:scale-[1.03] transition-transform duration-300"
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
                  className="action-icon-btn ring-white/10 bg-[#121C2B] text-[#A8B3C7] hover:ring-accent/40 hover:text-accent hover:scale-[1.03] transition-transform duration-300"
                  title="Add stock to watchlist"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <div className="hover:scale-[1.03] transition-transform duration-300">
                  <ScanButton
                    onScan={runScan}
                    loading={scanning}
                    intraday={intraday}
                    lockCountdown={lockCountdown}
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
            </div>

            {scanning && (
              <div className="overflow-hidden rounded-2xl p-0.5 bg-gradient-to-r from-accent/30 via-blue-500/30 to-accent/30">
                <div className="h-1 w-full animate-shimmer rounded-full bg-[#121C2B]" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {watchlist.map((stock, i) => {
                const result = results.find((r) => r.symbol === stock.symbol);
                return (
                  <div key={stock.symbol} className="stock-card-wrapper h-full opacity-0 translate-y-8 scale-[0.98]">
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
                      isExpanded={expandedSymbol === stock.symbol}
                      onToggleExpand={() =>
                        setExpandedSymbol((prev) => (prev === stock.symbol ? null : stock.symbol))
                      }
                    />
                  </div>
                );
              })}
            </div>

            {results.length > 0 && triggeredCount === 0 && (
              <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-[#101826] px-6 py-10 text-center shadow-xl">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-[#121C2B] ring-1 ring-white/10">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#A8B3C7]">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="font-display text-base font-semibold text-[#E6EDF7] tracking-tight">
                  No breakouts detected
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#A8B3C7]">
                  None of your watchlist stocks broke their 5-day high and volume
                  simultaneously. Check back later or add more stocks.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Discoveries */}
          <div className="flex flex-col rounded-[2.5rem] w-full">
            {discoveries.length > 0 ? (
              <DiscoveryFeed
                discoveries={discoveries}
                onAddToWatchlist={addDiscoveryToWatchlist}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center rounded-[2.5rem] border border-white/5 bg-[#101826]/40 backdrop-blur-xl">
                <Activity className="w-8 h-8 text-[#A8B3C7]/20 mb-4 animate-pulse" />
                <p className="text-sm text-[#A8B3C7]/60 font-medium tracking-wide">Scanning market...</p>
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

function reportAction(action: string, label: string, opts?: { detail?: Record<string, unknown>; changes?: { field: string; from?: string | number | boolean; to?: string | number | boolean }[] }) {
  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cat: "user", action, label, actor: "user", ...opts }),
  }).catch(() => { });
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
      body: `High \u20B9${stock.todayHigh.toLocaleString("en-IN")} (prev max \u20B9${stock.prevMaxHigh.toLocaleString("en-IN")})\nVol ${formatVol(stock.todayVolume)} (3\u00D7 avg ${formatVol(stock.prevMaxVolume * 3)})`,
      icon: "/favicon.ico",
    });
  }
}

function notifyDiscoveries(
  stocks: DiscoveryStock[],
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

  // Only notify for true breakouts (high + volume); high-only breaks stay
  // visible in the Nifty 50 discovery feed without triggering notifications.
  const trueBreakouts = stocks.filter((s) => s.fullBreakout);

  for (const stock of trueBreakouts) {
    const lastNotified = cooldownMap.get(stock.symbol) ?? 0;
    if (now - lastNotified < NOTIFY_COOLDOWN_MS) continue;

    cooldownMap.set(stock.symbol, now);
    new Notification(`N50 Discovery: ${stock.symbol}`, {
      body: `\u20B9${stock.lastPrice.toLocaleString("en-IN")} (${stock.pChange >= 0 ? "+" : ""}${stock.pChange.toFixed(2)}%)\nHigh +${stock.highBreakPercent.toFixed(1)}% \u00B7 Vol +${stock.volumeBreakPercent.toFixed(1)}%`,
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
