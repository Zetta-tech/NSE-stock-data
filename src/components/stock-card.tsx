"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import type { ScanResult } from "@/lib/types";

export function StockCard({
  result,
  onRemove,
  closeWatch,
  onToggleCloseWatch,
}: {
  result: ScanResult;
  onRemove: (symbol: string) => void;
  closeWatch: boolean;
  onToggleCloseWatch: (symbol: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const starRef = useRef<HTMLButtonElement>(null);
  const borderRef = useRef<HTMLDivElement>(null);
  const prevCloseWatch = useRef(closeWatch);

  const hasData = result.todayHigh > 0;
  const isStale = result.dataSource === "stale";
  const isLive = result.dataSource === "live";
  const highBreaks = hasData && !isStale && result.todayHigh > result.prevMaxHigh;
  const volBreaks = hasData && !isStale && result.todayVolume >= result.prevMaxVolume * 3;

  useEffect(() => {
    if (prevCloseWatch.current === closeWatch) return;
    prevCloseWatch.current = closeWatch;

    if (!cardRef.current || !starRef.current) return;

    if (closeWatch) {
      gsap.fromTo(
        starRef.current,
        { scale: 0.5, rotation: -30 },
        { scale: 1, rotation: 0, duration: 0.4, ease: "back.out(2)" }
      );
      gsap.fromTo(
        cardRef.current,
        { boxShadow: "0 0 0 2px rgba(245, 166, 35, 0.4), 0 0 24px rgba(245, 166, 35, 0.12)" },
        { boxShadow: "0 0 0 1px rgba(245, 166, 35, 0.15), 0 0 0px rgba(245, 166, 35, 0)", duration: 0.8, ease: "power2.out" }
      );
    } else {
      gsap.fromTo(
        starRef.current,
        { scale: 1.3 },
        { scale: 1, duration: 0.3, ease: "power2.out" }
      );
    }
  }, [closeWatch]);

  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }
    );
  }, []);

  return (
    <div
      ref={cardRef}
      className={`stock-card group relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 ring-1 ${
        isStale
          ? "ring-warn/25 bg-surface-raised card-glow-warn"
          : result.triggered
            ? "ring-accent/25 card-glow bg-surface-raised"
            : closeWatch
              ? "ring-warn/15 bg-surface-raised hover:shadow-xl hover:shadow-warn/5"
              : "ring-surface-border/40 bg-surface-raised hover:ring-surface-border-bright/60 hover:shadow-xl hover:shadow-black/30"
      } card-elevated`}
    >
      {/* Top edge highlight */}
      {result.triggered && !isStale && (
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
      )}
      {isStale && (
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-warn/50 to-transparent" />
      )}
      {closeWatch && !result.triggered && !isStale && (
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-warn/40 to-transparent" />
      )}

      {/* Left strip for close-watch */}
      {closeWatch && (
        <div
          ref={borderRef}
          className="absolute inset-y-0 left-0 w-[2px] rounded-l-2xl bg-gradient-to-b from-warn/60 via-warn/30 to-warn/5"
        />
      )}

      {/* Action buttons */}
      <div className="absolute right-3 top-3 flex items-center gap-0.5">
        <button
          ref={starRef}
          onClick={() => onToggleCloseWatch(result.symbol)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ${
            closeWatch
              ? "text-warn opacity-100 hover:bg-warn/10"
              : "text-text-muted opacity-0 hover:bg-surface-overlay hover:text-warn group-hover:opacity-100"
          }`}
          aria-label={`${closeWatch ? "Remove from" : "Add to"} close watch`}
          title={closeWatch ? "Remove from Close Watch" : "Add to Close Watch"}
        >
          {closeWatch ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          )}
        </button>
        <button
          onClick={() => onRemove(result.symbol)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted opacity-0 transition-all duration-200 hover:bg-danger-muted hover:text-danger group-hover:opacity-100"
          aria-label={`Remove ${result.symbol}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-start justify-between pr-16 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold transition-colors ring-1 ${
              result.triggered
                ? "bg-accent/10 text-accent ring-accent/15"
                : closeWatch
                  ? "bg-warn/8 text-warn ring-warn/15"
                  : "bg-surface-overlay text-text-secondary ring-surface-border/50"
            }`}
          >
            {result.symbol.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold tracking-tight truncate">{result.symbol}</h3>
            <p className="mt-0.5 text-xs text-text-muted truncate">{result.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {closeWatch && !result.triggered && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-warn/8 ring-1 ring-warn/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warn/80">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Watching
                </span>
              )}
              {result.triggered && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 ring-1 ring-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                  <span className="h-1 w-1 rounded-full bg-accent animate-pulse" />
                  Breakout
                </span>
              )}
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent/60">
                  Live
                </span>
              )}
              {isStale && (
                <span className="inline-flex items-center gap-1 rounded-md bg-warn/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warn">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                  Stale
                </span>
              )}
            </div>
          </div>
        </div>
        {hasData && (
          <div className="text-right flex-shrink-0">
            <p className="font-mono text-lg font-bold tabular-nums tracking-tight">
              &#x20B9;{result.todayClose.toLocaleString("en-IN")}
            </p>
            <p
              className={`font-mono text-xs font-semibold tabular-nums ${
                result.todayChange >= 0 ? "text-accent" : "text-danger"
              }`}
            >
              {result.todayChange >= 0 ? "+" : ""}
              {result.todayChange.toFixed(2)}%
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        {hasData ? (
          <div className="space-y-4">
            <MetricBar
              label="High"
              todayVal={result.todayHigh}
              prevVal={result.prevMaxHigh}
              todayStr={`\u20B9${result.todayHigh.toLocaleString("en-IN")}`}
              prevStr={`\u20B9${result.prevMaxHigh.toLocaleString("en-IN")}`}
              breakPercent={result.highBreakPercent}
              breaks={highBreaks}
            />
            <MetricBar
              label="Volume"
              todayVal={result.todayVolume}
              prevVal={result.prevMaxVolume}
              todayStr={formatVolume(result.todayVolume)}
              prevStr={formatVolume(result.prevMaxVolume)}
              breakPercent={result.volumeBreakPercent}
              breaks={volBreaks}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-surface-border/40 bg-surface-overlay/10 px-3 py-6">
            <div className="text-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 text-text-muted">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <p className="text-xs text-text-muted">Run a scan to fetch data</p>
            </div>
          </div>
        )}

        <div className="mt-auto">
          {hasData && isStale && (
            <div className="mt-4 rounded-xl border border-warn/15 bg-warn/[0.04] px-3 py-2">
              <p className="text-[11px] font-medium text-warn">
                Live data unavailable — showing last historical candle. Breakout detection paused for this stock.
              </p>
            </div>
          )}

          {hasData && !isStale && (
            <div className="mt-4 flex gap-2">
              <StatusPill active={highBreaks} label="High Break" />
              <StatusPill active={volBreaks} label="Vol Break" />
            </div>
          )}
        </div>
      </div>

      {/* Background glow effects */}
      {result.triggered && (
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-accent/[0.03] blur-3xl animate-glow-pulse" />
      )}
      {closeWatch && !result.triggered && (
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-warn/[0.02] blur-2xl" />
      )}
    </div>
  );
}

function MetricBar({
  label,
  todayVal,
  prevVal,
  todayStr,
  prevStr,
  breakPercent,
  breaks,
}: {
  label: string;
  todayVal: number;
  prevVal: number;
  todayStr: string;
  prevStr: string;
  breakPercent: number;
  breaks: boolean;
}) {
  const maxVal = Math.max(todayVal, prevVal) * 1.1;
  const todayPct = maxVal > 0 ? (todayVal / maxVal) * 100 : 0;
  const prevPct = maxVal > 0 ? (prevVal / maxVal) * 100 : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-text-muted text-[10px]">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`font-mono tabular-nums font-semibold ${breaks ? "text-accent" : "text-text-primary"}`}>
            {todayStr}
          </span>
          <span className="text-text-muted/50">vs</span>
          <span className="font-mono tabular-nums text-text-muted">{prevStr}</span>
          {breaks && (
            <span className="rounded-md bg-accent/10 ring-1 ring-accent/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-accent">
              +{breakPercent.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-overlay">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-surface-border/40 transition-all duration-700"
          style={{ width: `${prevPct}%` }}
        />
        <div
          className={`absolute inset-y-0 left-0 rounded-full animate-bar-fill ${
            breaks
              ? "bg-gradient-to-r from-accent/70 to-accent"
              : "bg-text-muted/30"
          }`}
          style={{ "--bar-width": `${todayPct}%` } as React.CSSProperties}
        />
        {breaks && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent/25 blur-sm animate-bar-fill"
            style={{ "--bar-width": `${todayPct}%` } as React.CSSProperties}
          />
        )}
      </div>
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ring-1 ${
        active ? "bg-accent/8 text-accent ring-accent/15" : "bg-surface-overlay text-text-muted ring-surface-border/50"
      }`}
    >
      {active ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <span className="text-[8px]">&mdash;</span>
      )}
      {label}
    </span>
  );
}

function formatVolume(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}
