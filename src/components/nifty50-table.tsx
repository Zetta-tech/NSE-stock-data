"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { isMarketHours, isExtendedHours } from "@/lib/market-hours";
import type {
  Nifty50TableResponse,
  Nifty50StockRow,
  BreakoutDiscovery,
} from "@/lib/types";

const REFRESH_INTERVAL = 3 * 60_000;
const MARKET_CHECK_INTERVAL = 60_000;

type SortKey = "symbol" | "lastPrice" | "pChange" | "dayHigh" | "totalTradedVolume";
type SortDir = "asc" | "desc";

const LOADING_MESSAGES_INITIAL = [
  "Waking up the Nifty 50...",
  "Dialing Dalal Street...",
  "Convincing NSE to share secrets...",
  "Herding 50 stocks into a table...",
  "Asking the market what's up...",
];

const LOADING_MESSAGES_REFRESH = [
  "Checking who actually broke out and who just faked a rally...",
  "Separating real breakouts from bull traps...",
  "Asking 50 stocks if they're feeling adventurous...",
  "Refreshing... because markets don't wait for anyone",
  "Hunting for stocks that broke their 5-day ceiling...",
  "Rechecking the usual suspects...",
  "Counting volume bars and questioning life choices...",
  "Peeking at the orderbook while NSE isn't looking...",
  "Comparing today's drama to last week's...",
  "Running the breakout detector... beep boop...",
];

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function BreakStrength({ percent, type }: { percent: number; type: "high" | "volume" }) {
  const capped = Math.min(Math.abs(percent), 20);
  const width = Math.max((capped / 20) * 100, 8);
  const isStrong = Math.abs(percent) > 5;
  const color = type === "high"
    ? isStrong ? "bg-accent" : "bg-accent/50"
    : isStrong ? "bg-blue-400" : "bg-blue-400/50";

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 rounded-full bg-surface-overlay overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`font-mono text-[9px] font-semibold tabular-nums ${isStrong ? "text-accent" : "text-text-muted"}`}>
        +{percent.toFixed(1)}%
      </span>
    </div>
  );
}

export function Nifty50Table() {
  const [data, setData] = useState<Nifty50TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketLive, setMarketLive] = useState(() => isMarketHours());
  const [sortKey, setSortKey] = useState<SortKey>("pChange");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [collapsed, setCollapsed] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);
  const loadingMsgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLoadingMessages = useCallback((isRefresh: boolean) => {
    const pool = isRefresh ? LOADING_MESSAGES_REFRESH : LOADING_MESSAGES_INITIAL;
    setLoadingMsg(pickRandom(pool));
    loadingMsgTimerRef.current = setInterval(() => {
      setLoadingMsg(pickRandom(LOADING_MESSAGES_REFRESH));
    }, 2500);
  }, []);

  const stopLoadingMessages = useCallback(() => {
    if (loadingMsgTimerRef.current) {
      clearInterval(loadingMsgTimerRef.current);
      loadingMsgTimerRef.current = null;
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    startLoadingMessages(hasFetchedRef.current);
    try {
      const res = await fetch("/api/nifty50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Nifty50TableResponse = await res.json();
      setData(json);
      setError(null);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
      stopLoadingMessages();
    }
  }, [startLoadingMessages, stopLoadingMessages]);

  useEffect(() => {
    const check = () => setMarketLive(isMarketHours());
    check();
    const interval = setInterval(check, MARKET_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
    if (marketLive) {
      timerRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [marketLive, fetchData]);

  useEffect(() => {
    return () => stopLoadingMessages();
  }, [stopLoadingMessages]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const sortedStocks = data
    ? [...data.snapshot.stocks].sort((a, b) => {
        let va: number | string;
        let vb: number | string;
        switch (sortKey) {
          case "symbol":
            va = a.symbol;
            vb = b.symbol;
            return sortDir === "asc"
              ? (va as string).localeCompare(vb as string)
              : (vb as string).localeCompare(va as string);
          case "lastPrice":
            va = a.lastPrice;
            vb = b.lastPrice;
            break;
          case "pChange":
            va = a.pChange;
            vb = b.pChange;
            break;
          case "dayHigh":
            va = a.dayHigh;
            vb = b.dayHigh;
            break;
          case "totalTradedVolume":
            va = a.totalTradedVolume;
            vb = b.totalTradedVolume;
            break;
          default:
            va = 0;
            vb = 0;
        }
        return sortDir === "asc"
          ? (va as number) - (vb as number)
          : (vb as number) - (va as number);
      })
    : [];

  const watchlistSet = new Set(data?.watchlistSymbols ?? []);
  const closeWatchSet = new Set(data?.closeWatchSymbols ?? []);
  const discoveryMap = new Map<string, BreakoutDiscovery>();
  for (const d of data?.discoveries ?? []) {
    discoveryMap.set(d.symbol, d);
  }

  const discoveries = data?.discoveries ?? [];
  const breakoutCount = discoveries.filter((d) => d.breakout).length;
  const highOnlyCount = discoveries.filter((d) => d.highBreak && !d.breakout).length;
  const volOnlyCount = discoveries.filter((d) => d.volumeBreak && !d.breakout).length;
  const possibleCount = discoveries.filter((d) => d.possibleBreakout).length;
  const baselineUnavailableCount = discoveries.filter((d) => d.baselineUnavailable).length;
  const isStale = data?.snapshot.stale ?? false;
  const fetchSuccess = data?.snapshot.fetchSuccess ?? true;

  const gainers = data ? data.snapshot.stocks.filter((s) => s.pChange > 0).length : 0;
  const losers = data ? data.snapshot.stocks.filter((s) => s.pChange < 0).length : 0;

  const lastUpdated = data?.snapshot.fetchedAt;

  return (
    <div className="animate-fade-in">
      <div className={`overflow-hidden rounded-2xl bg-surface-raised transition-all duration-300 ring-1 card-elevated ${
        breakoutCount > 0
          ? "ring-accent/20 shadow-[0_0_40px_-12px_rgba(0,230,138,0.08)]"
          : "ring-surface-border/50"
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border/60 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors duration-300 ring-1 ${
                breakoutCount > 0
                  ? "bg-accent/10 text-accent ring-accent/15"
                  : "bg-blue-500/8 text-blue-400 ring-blue-500/15"
              }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-sm font-bold tracking-tight">NIFTY 50</h2>
                <p className="text-[10px] text-text-muted">
                  {data ? (
                    <>
                      {data.snapshot.stocks.length} stocks
                      {data && (
                        <span className="ml-1.5 text-text-muted/70">
                          {gainers}
                          <span className="text-accent/70">&#9650;</span>
                          {" "}{losers}
                          <span className="text-danger/70">&#9660;</span>
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="animate-pulse">Loading...</span>
                  )}
                  {breakoutCount > 0 && (
                    <span className="ml-1.5 text-accent font-semibold">
                      {breakoutCount} breakout{breakoutCount > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isStale && (
                <span className="inline-flex items-center gap-1 rounded-md bg-warn/10 ring-1 ring-warn/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warn">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                  Stale
                </span>
              )}
              {!fetchSuccess && !isStale && (
                <span className="inline-flex items-center gap-1 rounded-md bg-danger-muted ring-1 ring-danger/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-danger">
                  Fetch Failed
                </span>
              )}
              {marketLive && fetchSuccess && !isStale && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent/70">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  Live
                </span>
              )}
              {!marketLive && hasFetchedRef.current && (
                <span className="text-[9px] text-text-muted/40 font-semibold uppercase tracking-wider">Market closed</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="font-mono text-[10px] tabular-nums text-text-muted" title={lastUpdated}>
                {new Date(lastUpdated).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </span>
            )}

            <button
              onClick={fetchData}
              disabled={loading}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ring-1 ${
                loading
                  ? "ring-surface-border bg-surface-overlay text-text-muted cursor-not-allowed"
                  : "ring-surface-border bg-surface-overlay text-text-secondary hover:ring-accent/25 hover:text-accent"
              }`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={loading ? "animate-spin" : ""}
              >
                <path d="M21.5 2v6h-6" />
                <path d="M2.5 22v-6h6" />
                <path d="M2.5 11.5a10 10 0 0 1 18.1-4.5" />
                <path d="M21.5 12.5a10 10 0 0 1-18.1 4.5" />
              </svg>
              {loading ? "Scanning..." : "Refresh"}
            </button>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex h-8 w-8 items-center justify-center rounded-xl ring-1 ring-surface-border bg-surface-overlay text-text-muted transition-all hover:text-text-secondary hover:ring-surface-border-bright"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading banner */}
        {loading && data && (
          <div className="flex items-center gap-3 border-b border-surface-border/40 bg-surface/60 px-5 py-2.5 animate-fade-in-fast">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[10px] text-text-muted italic">{loadingMsg}</span>
            </div>
          </div>
        )}

        {/* Discovery summary */}
        {!collapsed && data && !loading && (breakoutCount > 0 || highOnlyCount > 0 || volOnlyCount > 0 || possibleCount > 0 || baselineUnavailableCount > 0) && (
          <div className="flex items-center gap-3 border-b border-surface-border/40 bg-surface/40 px-5 py-2.5">
            {breakoutCount > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-accent">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {breakoutCount} breakout{breakoutCount > 1 ? "s" : ""} confirmed
              </span>
            )}
            {highOnlyCount > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-accent/60">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                {highOnlyCount} high break{highOnlyCount > 1 ? "s" : ""}
              </span>
            )}
            {volOnlyCount > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-blue-400/60">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="10" width="4" height="10" />
                </svg>
                {volOnlyCount} vol surge{volOnlyCount > 1 ? "s" : ""}
              </span>
            )}
            {possibleCount > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-warn">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                {possibleCount} possible (stale data)
              </span>
            )}
            {baselineUnavailableCount > 0 && (
              <span className="text-[10px] text-text-muted">
                {baselineUnavailableCount} no baseline
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] text-text-muted">
              Baselines: {data.baselineStatus.available}/{data.baselineStatus.available + data.baselineStatus.missing}
            </span>
          </div>
        )}

        {/* Error */}
        {error && !data && (
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-danger">{error}</p>
            <button onClick={fetchData} className="mt-2 text-xs text-accent hover:underline">
              Try again
            </button>
          </div>
        )}

        {/* Table */}
        {!collapsed && data && (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface-raised">
                <tr className="border-b border-surface-border/60 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                  <th className="px-4 py-2.5 w-10 font-semibold">#</th>
                  <SortHeader label="Symbol" sortKey="symbol" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="w-[160px]" />
                  <SortHeader label="LTP" sortKey="lastPrice" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="text-right w-[100px]" />
                  <SortHeader label="Chg %" sortKey="pChange" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="text-right w-[90px]" />
                  <SortHeader label="Day High" sortKey="dayHigh" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="text-right w-[100px]" />
                  <SortHeader label="Volume" sortKey="totalTradedVolume" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="text-right w-[100px]" />
                  <th className="px-4 py-2.5 text-center w-[130px] font-semibold">Signal</th>
                  <th className="px-4 py-2.5 text-center w-[80px] font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/30">
                {sortedStocks.map((stock, i) => (
                  <StockRow
                    key={stock.symbol}
                    stock={stock}
                    index={i + 1}
                    inWatchlist={watchlistSet.has(stock.symbol)}
                    inCloseWatch={closeWatchSet.has(stock.symbol)}
                    discovery={discoveryMap.get(stock.symbol) ?? null}
                    snapshotStale={isStale}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Loading skeleton */}
        {!data && loading && (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex items-center justify-center gap-1 mb-4">
              <span className="h-2 w-2 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "100ms" }} />
              <span className="h-2 w-2 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "200ms" }} />
              <span className="h-2 w-2 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="h-2 w-2 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "400ms" }} />
            </div>
            <p className="text-xs text-text-muted italic">{loadingMsg}</p>
            <div className="mx-auto mt-3 h-1 w-48 animate-shimmer rounded-full bg-surface-overlay" />
          </div>
        )}

        {/* Footer */}
        {!collapsed && data && (
          <div className="flex items-center justify-between border-t border-surface-border/40 px-5 py-2.5">
            <div className="flex items-center gap-4 text-[10px] text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-30 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Breakout
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent/60">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                High Break
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400/60">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="10" width="4" height="10" />
                </svg>
                Vol Surge
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-blue-400/25" />
                Watchlist
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-warn/25" />
                Close Watch
              </span>
            </div>
            {marketLive && (
              <span className="text-[10px] text-text-muted/40 font-medium">
                Auto-refreshes every 3 min
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === key;
  return (
    <th
      className={`px-4 py-2.5 cursor-pointer select-none transition-colors hover:text-text-secondary ${className}`}
      onClick={() => onClick(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className={`text-accent ${dir === "desc" ? "rotate-180" : ""}`}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        )}
      </span>
    </th>
  );
}

function StockRow({
  stock,
  index,
  inWatchlist,
  inCloseWatch,
  discovery,
  snapshotStale,
}: {
  stock: Nifty50StockRow;
  index: number;
  inWatchlist: boolean;
  inCloseWatch: boolean;
  discovery: BreakoutDiscovery | null;
  snapshotStale: boolean;
}) {
  const isBreakout = discovery?.breakout ?? false;
  const isPossible = discovery?.possibleBreakout ?? false;
  const baselineMissing = discovery?.baselineUnavailable ?? false;
  const highBreak = discovery?.highBreak ?? false;
  const volBreak = discovery?.volumeBreak ?? false;

  const rowBg = isBreakout
    ? "bg-accent/[0.03] hover:bg-accent/[0.06]"
    : isPossible
      ? "bg-warn/[0.02] hover:bg-warn/[0.04]"
      : (highBreak || volBreak) && !inWatchlist
        ? "bg-accent/[0.015] hover:bg-accent/[0.03]"
        : inCloseWatch
          ? "bg-warn/[0.015] hover:bg-warn/[0.03]"
          : inWatchlist
            ? "bg-blue-500/[0.015] hover:bg-blue-500/[0.03]"
            : "hover:bg-surface-overlay/15";

  return (
    <tr className={`transition-colors duration-150 ${rowBg}`}>
      <td className="px-4 py-2.5 font-mono text-[10px] tabular-nums text-text-muted">{index}</td>

      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {isBreakout ? (
            <span className="flex h-5 w-5 items-center justify-center rounded" title="Breakout detected">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(0,230,138,0.5)]" />
              </span>
            </span>
          ) : inCloseWatch ? (
            <span className="flex h-5 w-5 items-center justify-center rounded text-warn" title="Close Watch">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
          ) : inWatchlist ? (
            <span className="flex h-5 w-5 items-center justify-center rounded text-blue-400/50" title="In Watchlist">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
          ) : (highBreak || volBreak) ? (
            <span className="flex h-5 w-5 items-center justify-center rounded" title="Partial break">
              <span className="h-2 w-2 rounded-full bg-accent/30" />
            </span>
          ) : (
            <span className="w-5" />
          )}
          <div>
            <span className={`font-display text-xs font-bold tracking-tight ${isBreakout ? "text-accent" : ""}`}>
              {stock.symbol}
            </span>
            <p className="text-[10px] text-text-muted leading-tight truncate max-w-[120px]">{stock.name}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-2.5 text-right">
        <span className="font-mono text-xs font-semibold tabular-nums">
          {stock.lastPrice > 0 ? `\u20B9${stock.lastPrice.toLocaleString("en-IN")}` : "\u2014"}
        </span>
      </td>

      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {stock.pChange !== 0 && (
            <div className="h-1 w-8 rounded-full bg-surface-overlay overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${stock.pChange > 0 ? "bg-accent/40" : "bg-danger/40"}`}
                style={{ width: `${Math.min(Math.abs(stock.pChange) * 15, 100)}%` }}
              />
            </div>
          )}
          <span
            className={`font-mono text-xs font-semibold tabular-nums ${
              stock.pChange > 0 ? "text-accent" : stock.pChange < 0 ? "text-danger" : "text-text-muted"
            }`}
          >
            {stock.pChange > 0 ? "+" : ""}
            {stock.pChange.toFixed(2)}%
          </span>
        </div>
      </td>

      <td className="px-4 py-2.5 text-right">
        <span className={`font-mono text-xs tabular-nums ${highBreak && !inWatchlist ? "text-accent font-semibold" : "text-text-secondary"}`}>
          {stock.dayHigh > 0 ? `\u20B9${stock.dayHigh.toLocaleString("en-IN")}` : "\u2014"}
        </span>
      </td>

      <td className="px-4 py-2.5 text-right">
        <span className={`font-mono text-xs tabular-nums ${volBreak && !inWatchlist ? "text-accent font-semibold" : "text-text-secondary"}`}>
          {formatVol(stock.totalTradedVolume)}
        </span>
      </td>

      <td className="px-4 py-2.5 text-center">
        {inWatchlist ? (
          <span className="text-[9px] text-text-muted/40 font-semibold uppercase tracking-wider">Watchlist</span>
        ) : isBreakout ? (
          <div className="inline-flex flex-col items-center gap-0.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 ring-1 ring-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Breakout
            </span>
            <span className="font-mono text-[8px] text-accent/40 tabular-nums">
              H+{discovery?.highBreakPercent?.toFixed(1)}% V+{discovery?.volumeBreakPercent?.toFixed(1)}%
            </span>
          </div>
        ) : isPossible ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-warn/10 ring-1 ring-warn/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warn">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 9v4M12 17h.01" />
            </svg>
            Possible
          </span>
        ) : baselineMissing ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-overlay ring-1 ring-surface-border/50 px-1.5 py-0.5 text-[9px] font-medium text-text-muted">
            No baseline
          </span>
        ) : highBreak ? (
          <BreakStrength percent={discovery?.highBreakPercent ?? 0} type="high" />
        ) : volBreak ? (
          <BreakStrength percent={discovery?.volumeBreakPercent ?? 0} type="volume" />
        ) : (
          <span className="text-[9px] text-text-muted/20">&mdash;</span>
        )}
      </td>

      <td className="px-4 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          {snapshotStale && (
            <span className="h-1.5 w-1.5 rounded-full bg-warn" title="Data may be stale" />
          )}
          {inCloseWatch && (
            <span className="inline-flex rounded-md bg-warn/8 ring-1 ring-warn/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-warn/70">
              CW
            </span>
          )}
          {inWatchlist && !inCloseWatch && (
            <span className="inline-flex rounded-md bg-blue-500/8 ring-1 ring-blue-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-blue-400/70">
              WL
            </span>
          )}
          {!inWatchlist && !snapshotStale && (
            <span className="text-[9px] text-text-muted/20">&mdash;</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function formatVol(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  if (vol === 0) return "\u2014";
  return vol.toString();
}
