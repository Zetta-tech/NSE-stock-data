"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { isMarketHours } from "@/lib/market-hours";
import type {
  Nifty50TableResponse,
  Nifty50StockRow,
  BreakoutDiscovery,
} from "@/lib/types";

const REFRESH_INTERVAL = 3 * 60_000;
const MARKET_CHECK_INTERVAL = 60_000;

export function Nifty50Rail() {
  const [data, setData] = useState<Nifty50TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [marketLive, setMarketLive] = useState(() => isMarketHours());
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/nifty50");
      if (!res.ok) return;
      const json: Nifty50TableResponse = await res.json();
      setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

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

  const discoveryMap = new Map<string, BreakoutDiscovery>();
  for (const d of data?.discoveries ?? []) {
    discoveryMap.set(d.symbol, d);
  }

  const stocks = data?.snapshot.stocks ?? [];
  // Sort: breakouts first, then by change% desc
  const sorted = [...stocks].sort((a, b) => {
    const da = discoveryMap.get(a.symbol);
    const db = discoveryMap.get(b.symbol);
    const aBreak = da?.breakout ? 1 : 0;
    const bBreak = db?.breakout ? 1 : 0;
    if (aBreak !== bBreak) return bBreak - aBreak;
    return b.pChange - a.pChange;
  });

  if (!data && loading) {
    return (
      <div className="rail-container">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex gap-0.5">
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
      {/* Rail header */}
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

      {/* Horizontal scrolling rail */}
      <div
        ref={scrollRef}
        className="rail-scroll flex gap-1.5 overflow-x-auto px-3 py-3 scrollbar-thin"
      >
        {sorted.map((stock) => {
          const discovery = discoveryMap.get(stock.symbol);
          const isBreakout = discovery?.breakout ?? false;
          const highBreak = discovery?.highBreak ?? false;
          const volBreak = discovery?.volumeBreak ?? false;
          const isSelected = selectedSymbol === stock.symbol;

          return (
            <RailTile
              key={stock.symbol}
              stock={stock}
              isBreakout={isBreakout}
              highBreak={highBreak}
              volBreak={volBreak}
              isSelected={isSelected}
              onClick={() =>
                setSelectedSymbol(
                  isSelected ? null : stock.symbol
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function RailTile({
  stock,
  isBreakout,
  highBreak,
  volBreak,
  isSelected,
  onClick,
}: {
  stock: Nifty50StockRow;
  isBreakout: boolean;
  highBreak: boolean;
  volBreak: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isUp = stock.pChange >= 0;

  return (
    <button
      onClick={onClick}
      className={`rail-tile group relative flex-shrink-0 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 ring-1 ${
        isSelected
          ? "ring-accent/40 bg-accent/[0.08] shadow-lg shadow-accent/10 scale-[1.02]"
          : isBreakout
            ? "ring-accent/20 bg-accent/[0.04] hover:ring-accent/30 hover:bg-accent/[0.07]"
            : "ring-surface-border/40 bg-surface-overlay/40 hover:ring-surface-border-bright/60 hover:bg-surface-overlay/70"
      }`}
    >
      {/* Breakout indicator */}
      {isBreakout && (
        <div className="absolute right-1.5 top-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
        </div>
      )}

      {/* Top edge highlight for selected */}
      {isSelected && (
        <div className="absolute inset-x-0 top-0 h-[1.5px] rounded-t-xl bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      )}

      <div className="flex items-center gap-2">
        <span className={`font-display text-[11px] font-bold tracking-tight ${
          isBreakout ? "text-accent" : isSelected ? "text-text-primary" : "text-text-secondary"
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
    </button>
  );
}
