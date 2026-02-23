"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { isMarketHours } from "@/lib/market-hours";
import type {
  Nifty50TableResponse,
  Nifty50StockRow,
  BreakoutDiscovery,
  DiscoveryStock,
} from "@/lib/types";

const REFRESH_INTERVAL = 3 * 60_000;
const MARKET_CHECK_INTERVAL = 60_000;
const TILE_WIDTH = 148;
const PIXELS_PER_SECOND = 35;

export function Nifty50Rail({
  onDiscoveries,
}: {
  onDiscoveries?: (stocks: DiscoveryStock[], newAlertCount: number) => void;
}) {
  const [data, setData] = useState<Nifty50TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [marketLive, setMarketLive] = useState(() => isMarketHours());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/nifty50");
      if (!res.ok) return;
      const json: Nifty50TableResponse = await res.json();
      setData(json);

      // Build enriched breakout discoveries for the dashboard
      if (onDiscoveries) {
        const stockMap = new Map(json.snapshot.stocks.map((s) => [s.symbol, s]));
        const breakouts: DiscoveryStock[] = (json.discoveries ?? [])
          .filter((d) => d.breakout)
          .map((d) => {
            const stock = stockMap.get(d.symbol);
            return {
              symbol: d.symbol,
              name: d.name,
              lastPrice: stock?.lastPrice ?? 0,
              change: stock?.change ?? 0,
              pChange: stock?.pChange ?? 0,
              dayHigh: stock?.dayHigh ?? 0,
              totalTradedVolume: stock?.totalTradedVolume ?? 0,
              highBreakPercent: d.highBreakPercent,
              volumeBreakPercent: d.volumeBreakPercent,
            };
          });
        onDiscoveries(breakouts, json.newAlertCount ?? 0);
      }
    } catch {
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [onDiscoveries]);

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

  const discoveryMap = useMemo(() => {
    const map = new Map<string, BreakoutDiscovery>();
    for (const d of data?.discoveries ?? []) {
      map.set(d.symbol, d);
    }
    return map;
  }, [data?.discoveries]);

  const sorted = useMemo(() => {
    const stocks = data?.snapshot.stocks ?? [];
    return [...stocks].sort((a, b) => {
      const da = discoveryMap.get(a.symbol);
      const db = discoveryMap.get(b.symbol);
      const aBreak = da?.breakout ? 1 : 0;
      const bBreak = db?.breakout ? 1 : 0;
      if (aBreak !== bBreak) return bBreak - aBreak;
      return b.pChange - a.pChange;
    });
  }, [data?.snapshot.stocks, discoveryMap]);

  const marqueeDuration = useMemo(() => {
    const totalWidth = sorted.length * TILE_WIDTH;
    return Math.max(totalWidth / PIXELS_PER_SECOND, 30);
  }, [sorted.length]);

  if (!data && loading) {
    return (
      <div className="rail-container">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-xs text-text-muted">Loading NIFTY 50...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rail-container">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border/30">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/15">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <span className="font-display text-xs font-bold tracking-tight text-text-secondary">
            NIFTY 50
          </span>
          {marketLive && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-accent/60">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-accent/40">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex h-6 w-6 items-center justify-center rounded-lg ring-1 ring-surface-border/50 bg-surface-overlay/30 text-text-muted transition-all hover:text-text-secondary hover:ring-surface-border-bright disabled:opacity-40"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? "animate-spin" : ""}>
              <path d="M21.5 2v6h-6" />
              <path d="M2.5 22v-6h6" />
              <path d="M2.5 11.5a10 10 0 0 1 18.1-4.5" />
              <path d="M21.5 12.5a10 10 0 0 1-18.1 4.5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="rail-fade-left" />
        <div className="rail-fade-right" />

        <div className="overflow-hidden py-3 px-1">
          <div
            className="rail-marquee-track gap-2"
            style={{ "--marquee-duration": `${marqueeDuration}s` } as React.CSSProperties}
          >
            {sorted.map((stock) => (
              <RailTile
                key={`a-${stock.symbol}`}
                stock={stock}
                discovery={discoveryMap.get(stock.symbol)}
              />
            ))}
            {sorted.map((stock) => (
              <RailTile
                key={`b-${stock.symbol}`}
                stock={stock}
                discovery={discoveryMap.get(stock.symbol)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RailTile({
  stock,
  discovery,
}: {
  stock: Nifty50StockRow;
  discovery?: BreakoutDiscovery;
}) {
  const isUp = stock.pChange >= 0;
  const isBreakout = discovery?.breakout ?? false;
  const highBreak = discovery?.highBreak ?? false;
  const volBreak = discovery?.volumeBreak ?? false;

  return (
    <div
      className={`rail-tile group relative rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 ring-1 ${
        isBreakout
          ? "ring-accent/20 bg-accent/[0.04] hover:ring-accent/30 hover:bg-accent/[0.07]"
          : "ring-surface-border/40 bg-surface-overlay/40 hover:ring-surface-border-bright/60 hover:bg-surface-overlay/70"
      }`}
    >
      {isBreakout && (
        <div className="absolute right-1.5 top-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className={`font-display text-[11px] font-bold tracking-tight ${
          isBreakout ? "text-accent" : "text-text-secondary"
        }`}>
          {stock.symbol}
        </span>
        {(highBreak || volBreak) && !isBreakout && (
          <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent/50">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        )}
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-xs font-bold tabular-nums tracking-tight text-text-primary">
          {stock.lastPrice > 0
            ? `\u20B9${stock.lastPrice.toLocaleString("en-IN")}`
            : "\u2014"}
        </span>
      </div>

      <div className={`mt-0.5 flex items-center gap-1 ${isUp ? "text-accent" : "text-danger"}`}>
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={isUp ? "" : "rotate-180"}
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
        <span className="font-mono text-[10px] font-semibold tabular-nums">
          {isUp ? "+" : ""}
          {stock.pChange.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
