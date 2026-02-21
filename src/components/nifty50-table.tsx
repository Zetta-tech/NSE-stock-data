"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { isMarketHours, isExtendedHours } from "@/lib/market-hours";
import type {
  Nifty50TableResponse,
  Nifty50StockRow,
  BreakoutDiscovery,
} from "@/lib/types";

const REFRESH_INTERVAL = 3 * 60_000; // 3 minutes during market hours
const MARKET_CHECK_INTERVAL = 60_000;

type SortKey = "symbol" | "lastPrice" | "pChange" | "dayHigh" | "totalTradedVolume";
type SortDir = "asc" | "desc";

export function Nifty50Table() {
  const [data, setData] = useState<Nifty50TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketLive, setMarketLive] = useState(() => isMarketHours());
  const [sortKey, setSortKey] = useState<SortKey>("pChange");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [collapsed, setCollapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
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
    }
  }, []);

  // Check market hours periodically
  useEffect(() => {
    const check = () => setMarketLive(isMarketHours());
    check();
    const interval = setInterval(check, MARKET_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh during market hours
  useEffect(() => {
    // Always fetch once on mount
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  // Build sorted stock list
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

  // Lookup maps
  const watchlistSet = new Set(data?.watchlistSymbols ?? []);
  const closeWatchSet = new Set(data?.closeWatchSymbols ?? []);
  const discoveryMap = new Map<string, BreakoutDiscovery>();
  for (const d of data?.discoveries ?? []) {
    discoveryMap.set(d.symbol, d);
  }

  const breakoutCount = (data?.discoveries ?? []).filter((d) => d.breakout).length;
  const possibleCount = (data?.discoveries ?? []).filter((d) => d.possibleBreakout).length;
  const baselineUnavailableCount = (data?.discoveries ?? []).filter((d) => d.baselineUnavailable).length;
  const isStale = data?.snapshot.stale ?? false;
  const fetchSuccess = data?.snapshot.fetchSuccess ?? true;

  const lastUpdated = data?.snapshot.fetchedAt;
  const timeSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000)
    : null;

  return (
    <div className="animate-fade-in">
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight">NIFTY 50</h2>
                <p className="text-[10px] text-text-muted">
                  {data ? `${data.snapshot.stocks.length} stocks` : "Loading..."}
                  {breakoutCount > 0 && (
                    <span className="ml-1.5 text-accent font-semibold">
                      {breakoutCount} breakout{breakoutCount > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-1.5">
              {isStale && (
                <span className="inline-flex items-center gap-1 rounded-md bg-warn/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warn">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                  Stale
                </span>
              )}
              {!fetchSuccess && !isStale && (
                <span className="inline-flex items-center gap-1 rounded-md bg-danger-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-danger">
                  Fetch Failed
                </span>
              )}
              {marketLive && fetchSuccess && !isStale && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent/70">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  Live
                </span>
              )}
              {!marketLive && hasFetchedRef.current && (
                <span className="text-[9px] text-text-muted/50 font-medium">Market closed</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Last updated timestamp */}
            {lastUpdated && (
              <span className="text-[10px] tabular-nums text-text-muted" title={lastUpdated}>
                {new Date(lastUpdated).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </span>
            )}

            {/* Manual refresh */}
            <button
              onClick={fetchData}
              disabled={loading}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                loading
                  ? "border-surface-border bg-surface-overlay text-text-muted cursor-not-allowed"
                  : "border-surface-border bg-surface-overlay text-text-secondary hover:border-accent/30 hover:text-accent"
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
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface-overlay text-text-muted transition-all hover:text-text-secondary"
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

        {/* Discovery summary bar */}
        {!collapsed && data && (breakoutCount > 0 || possibleCount > 0 || baselineUnavailableCount > 0) && (
          <div className="flex items-center gap-3 border-b border-surface-border bg-surface/60 px-5 py-2">
            {breakoutCount > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                {breakoutCount} new breakout{breakoutCount > 1 ? "s" : ""} discovered
              </span>
            )}
            {possibleCount > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-warn">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                {possibleCount} possible (data stale)
              </span>
            )}
            {baselineUnavailableCount > 0 && (
              <span className="text-[10px] text-text-muted">
                {baselineUnavailableCount} missing baselines
              </span>
            )}
            <span className="ml-auto text-[10px] text-text-muted">
              Baselines: {data.baselineStatus.available}/{data.baselineStatus.available + data.baselineStatus.missing}
            </span>
          </div>
        )}

        {/* Error state */}
        {error && !data && (
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-danger">{error}</p>
            <button onClick={fetchData} className="mt-2 text-xs text-accent hover:underline">
              Try again
            </button>
          </div>
        )}

        {/* Table body */}
        {!collapsed && data && (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface-raised">
                <tr className="border-b border-surface-border text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                  <th className="px-4 py-2.5 w-10">#</th>
                  <SortHeader label="Symbol" sortKey="symbol" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="w-[160px]" />
                  <SortHeader label="LTP" sortKey="lastPrice" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="text-right w-[100px]" />
                  <SortHeader label="Chg %" sortKey="pChange" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="text-right w-[90px]" />
                  <SortHeader label="Day High" sortKey="dayHigh" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="text-right w-[100px]" />
                  <SortHeader label="Volume" sortKey="totalTradedVolume" currentKey={sortKey} dir={sortDir} onClick={handleSort} className="text-right w-[100px]" />
                  <th className="px-4 py-2.5 text-center w-[100px]">Signal</th>
                  <th className="px-4 py-2.5 text-center w-[80px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/40">
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
          <div className="px-5 py-12 text-center">
            <div className="mx-auto h-1 w-48 animate-shimmer rounded-full bg-surface-overlay" />
            <p className="mt-3 text-xs text-text-muted">Loading NIFTY 50 data...</p>
          </div>
        )}

        {/* Footer */}
        {!collapsed && data && (
          <div className="flex items-center justify-between border-t border-surface-border px-5 py-2">
            <div className="flex items-center gap-4 text-[10px] text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-blue-400/30" />
                In Watchlist
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-amber-400/30" />
                Close Watch
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Breakout
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-warn">
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                Possible / Stale
              </span>
            </div>
            {marketLive && (
              <span className="text-[10px] text-text-muted/50">
                Auto-refreshes every 3 min
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sort Header Helper ─────────────────────────────────────────────── */

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
            className={dir === "desc" ? "rotate-180" : ""}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        )}
      </span>
    </th>
  );
}

/* ── Stock Row ──────────────────────────────────────────────────────── */

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
    ? "bg-accent/[0.03]"
    : isPossible
      ? "bg-warn/[0.02]"
      : inCloseWatch
        ? "bg-amber-400/[0.02]"
        : inWatchlist
          ? "bg-blue-500/[0.02]"
          : "hover:bg-surface-overlay/20";

  return (
    <tr className={`transition-colors ${rowBg}`}>
      {/* Index */}
      <td className="px-4 py-2.5 text-[10px] tabular-nums text-text-muted">{index}</td>

      {/* Symbol + name */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* Watchlist / close-watch indicator */}
          {inCloseWatch ? (
            <span className="flex h-5 w-5 items-center justify-center rounded text-amber-400" title="Close Watch">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
          ) : inWatchlist ? (
            <span className="flex h-5 w-5 items-center justify-center rounded text-blue-400/60" title="In Watchlist">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
          ) : (
            <span className="w-5" />
          )}
          <div>
            <span className="text-xs font-semibold tracking-tight">{stock.symbol}</span>
            <p className="text-[10px] text-text-muted leading-tight truncate max-w-[120px]">{stock.name}</p>
          </div>
        </div>
      </td>

      {/* LTP */}
      <td className="px-4 py-2.5 text-right">
        <span className="text-xs font-semibold tabular-nums">
          {stock.lastPrice > 0 ? `₹${stock.lastPrice.toLocaleString("en-IN")}` : "—"}
        </span>
      </td>

      {/* Change % */}
      <td className="px-4 py-2.5 text-right">
        <span
          className={`text-xs font-semibold tabular-nums ${
            stock.pChange > 0 ? "text-accent" : stock.pChange < 0 ? "text-danger" : "text-text-muted"
          }`}
        >
          {stock.pChange > 0 ? "+" : ""}
          {stock.pChange.toFixed(2)}%
        </span>
      </td>

      {/* Day High */}
      <td className="px-4 py-2.5 text-right">
        <span className={`text-xs tabular-nums ${highBreak && !inWatchlist ? "text-accent font-semibold" : "text-text-secondary"}`}>
          {stock.dayHigh > 0 ? `₹${stock.dayHigh.toLocaleString("en-IN")}` : "—"}
        </span>
      </td>

      {/* Volume */}
      <td className="px-4 py-2.5 text-right">
        <span className={`text-xs tabular-nums ${volBreak && !inWatchlist ? "text-accent font-semibold" : "text-text-secondary"}`}>
          {formatVol(stock.totalTradedVolume)}
        </span>
      </td>

      {/* Signal */}
      <td className="px-4 py-2.5 text-center">
        {inWatchlist ? (
          <span className="text-[9px] text-text-muted/50 font-medium">Watchlist</span>
        ) : isBreakout ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
            <span className="h-1 w-1 rounded-full bg-accent animate-pulse" />
            Breakout
          </span>
        ) : isPossible ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-warn/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warn">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 9v4M12 17h.01" />
            </svg>
            Possible
          </span>
        ) : baselineMissing ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-overlay px-1.5 py-0.5 text-[9px] font-medium text-text-muted">
            No baseline
          </span>
        ) : highBreak ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium text-accent/70">
            High +{discovery?.highBreakPercent?.toFixed(1)}%
          </span>
        ) : volBreak ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium text-accent/70">
            Vol +{discovery?.volumeBreakPercent?.toFixed(1)}%
          </span>
        ) : (
          <span className="text-[9px] text-text-muted/30">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          {snapshotStale && (
            <span className="h-1.5 w-1.5 rounded-full bg-warn" title="Data may be stale" />
          )}
          {inCloseWatch && (
            <span className="inline-flex rounded bg-amber-400/10 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-400/70">
              CW
            </span>
          )}
          {inWatchlist && !inCloseWatch && (
            <span className="inline-flex rounded bg-blue-500/10 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-blue-400/70">
              WL
            </span>
          )}
          {!inWatchlist && !snapshotStale && (
            <span className="text-[9px] text-text-muted/30">—</span>
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
  if (vol === 0) return "—";
  return vol.toString();
}
