"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { isMarketHours } from "@/lib/market-hours";
import type { TickerQuote, ScanResult } from "@/lib/types";

const TICKER_INTERVAL = 10_000; // 10s
const MARKET_CHECK_INTERVAL = 60_000; // re-check market status every 60s

export function TickerPanel({
  hasCloseWatchStocks,
  scanResults,
}: {
  hasCloseWatchStocks: boolean;
  scanResults: ScanResult[];
}) {
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [marketLive, setMarketLive] = useState(() => isMarketHours());
  const prevPricesRef = useRef<Map<string, number>>(new Map());
  const [flashing, setFlashing] = useState<Map<string, "up" | "down">>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);
  // Track if user manually paused during market hours
  const userPausedRef = useRef(false);

  const fetchTicker = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch("/api/ticker");
      const data = await res.json();
      if (data.error || !data.quotes) return;

      const newQuotes = data.quotes as TickerQuote[];

      // Detect price changes for flash effect
      const newFlashes = new Map<string, "up" | "down">();
      const prevPrices = prevPricesRef.current;
      for (const q of newQuotes) {
        const prev = prevPrices.get(q.symbol);
        if (prev !== undefined && prev !== q.price) {
          newFlashes.set(q.symbol, q.price > prev ? "up" : "down");
        }
      }

      // Update previous prices
      const nextPrices = new Map<string, number>();
      for (const q of newQuotes) {
        nextPrices.set(q.symbol, q.price);
      }
      prevPricesRef.current = nextPrices;

      setQuotes(newQuotes);
      setLastFetch(data.fetchedAt);

      if (newFlashes.size > 0) {
        setFlashing(newFlashes);
        setTimeout(() => setFlashing(new Map()), 1200);
      }
    } catch {
      // silent
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Periodically check if market has opened/closed
  useEffect(() => {
    const check = () => {
      const live = isMarketHours();
      setMarketLive(live);
    };
    check();
    const interval = setInterval(check, MARKET_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Auto-start when close-watch stocks appear during market hours
  // Auto-pause when market closes (unless last-known quotes are shown)
  useEffect(() => {
    if (hasCloseWatchStocks && marketLive && !userPausedRef.current) {
      setActive(true);
    } else if (!marketLive && active) {
      setActive(false);
    } else if (!hasCloseWatchStocks) {
      setActive(false);
      setQuotes([]);
    }
  }, [hasCloseWatchStocks, marketLive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manage polling timer
  useEffect(() => {
    if (active && hasCloseWatchStocks) {
      fetchTicker();
      timerRef.current = setInterval(fetchTicker, TICKER_INTERVAL);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, hasCloseWatchStocks, fetchTicker]);

  if (!hasCloseWatchStocks) return null;

  // Build triggered lookup from scan results
  const triggeredSet = new Set(
    scanResults.filter((r) => r.triggered).map((r) => r.symbol)
  );

  const handleToggle = () => {
    const next = !active;
    if (!next) {
      userPausedRef.current = true;
    } else {
      userPausedRef.current = false;
    }
    setActive(next);
  };

  return (
    <div className="mb-8 animate-fade-in">
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              {active ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
              ) : (
                <span className="inline-flex h-2 w-2 rounded-full bg-text-muted/40" />
              )}
              <span className="text-sm font-semibold tracking-tight">
                Live Ticker
              </span>
            </div>
            {active && lastFetch && (
              <span className="text-[11px] tabular-nums text-text-muted">
                {new Date(lastFetch).toLocaleTimeString("en-IN")}
              </span>
            )}
            {!marketLive && !active && (
              <span className="text-[10px] text-text-muted/60 font-medium ml-1">
                Market closed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!marketLive && !active && quotes.length === 0 && (
              <span className="text-[10px] text-text-muted/50">
                Resumes at 09:15 IST
              </span>
            )}
            <button
              onClick={handleToggle}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                active
                  ? "bg-accent/10 text-accent hover:bg-accent/15"
                  : "bg-surface-overlay text-text-secondary hover:text-text-primary"
              }`}
            >
              {active ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start
                </>
              )}
            </button>
          </div>
        </div>

        {/* Ticker body */}
        {active ? (
          quotes.length > 0 ? (
            <div className="flex gap-0 overflow-x-auto scrollbar-thin">
              {quotes.map((q, i) => {
                const isTriggered = triggeredSet.has(q.symbol);
                const flash = flashing.get(q.symbol);
                return (
                  <div
                    key={q.symbol}
                    className={`relative flex min-w-[180px] flex-1 flex-col gap-1 px-5 py-4 transition-colors duration-300 ${
                      i > 0 ? "border-l border-surface-border" : ""
                    } ${
                      flash === "up"
                        ? "ticker-flash-up"
                        : flash === "down"
                          ? "ticker-flash-down"
                          : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tracking-tight">
                        {q.symbol}
                      </span>
                      {isTriggered && (
                        <span className="flex items-center gap-0.5 rounded bg-accent/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                          <span className="h-1 w-1 rounded-full bg-accent animate-pulse" />
                          BO
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold tabular-nums tracking-tight">
                        &#x20B9;{q.price.toLocaleString("en-IN")}
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          q.change >= 0 ? "text-accent" : "text-danger"
                        }`}
                      >
                        {q.change >= 0 ? "+" : ""}
                        {q.change.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-text-muted">
                      <span>
                        H &#x20B9;{q.high.toLocaleString("en-IN")}
                      </span>
                      <span>
                        V {formatVol(q.volume)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-xs text-text-muted">
              Fetching live quotes...
            </div>
          )
        ) : !marketLive && quotes.length > 0 ? (
          /* After hours: show last-known quotes dimmed */
          <div>
            <div className="flex gap-0 overflow-x-auto scrollbar-thin opacity-50">
              {quotes.map((q, i) => (
                <div key={q.symbol} className={`relative flex min-w-[180px] flex-1 flex-col gap-1 px-5 py-4 ${i > 0 ? "border-l border-surface-border" : ""}`}>
                  <span className="text-xs font-bold tracking-tight">{q.symbol}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold tabular-nums tracking-tight">&#x20B9;{q.price.toLocaleString("en-IN")}</span>
                    <span className={`text-xs font-semibold tabular-nums ${q.change >= 0 ? "text-accent" : "text-danger"}`}>{q.change >= 0 ? "+" : ""}{q.change.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted">
                    <span>H &#x20B9;{q.high.toLocaleString("en-IN")}</span>
                    <span>V {formatVol(q.volume)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-2 border-t border-surface-border text-center text-[10px] text-text-muted/50">
              Closing prices · Resumes at 09:15 IST
            </div>
          </div>
        ) : (
          <div className="px-5 py-6 text-center">
            <p className="text-xs text-text-muted">
              {marketLive
                ? "Press Start to stream live prices for your starred stocks"
                : "Market closed · Ticker will auto-start when market opens at 09:15 IST"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatVol(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}
