"use client";

import { useState } from "react";
import type { DiscoveryStock } from "@/lib/types";

function formatVol(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  if (vol === 0) return "\u2014";
  return vol.toString();
}

export function DiscoveryFeed({
  discoveries,
  onAddToWatchlist,
}: {
  discoveries: DiscoveryStock[];
  onAddToWatchlist: (symbol: string, name: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  if (discoveries.length === 0) return null;

  const handleAdd = (symbol: string, name: string) => {
    onAddToWatchlist(symbol, name);
    setAddedSymbols((prev) => new Set(prev).add(symbol));
  };

  return (
    <div className="animate-slide-down">
      <div
        className="overflow-hidden rounded-2xl ring-1 ring-accent/15 card-elevated"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,230,138,0.02) 0%, var(--surface-raised) 40%, var(--surface-raised) 60%, rgba(0,180,214,0.015) 100%)",
          boxShadow:
            "0 0 0 1px rgba(0,230,138,0.08), 0 4px 24px -4px rgba(0,230,138,0.06), inset 0 1px 0 rgba(255,255,255,0.02)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-accent/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-accent"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <div className="absolute -inset-0.5 rounded-lg bg-accent/8 blur-sm animate-glow-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xs font-bold uppercase tracking-wider text-accent">
                Nifty 50 Discoveries
              </h2>
              <span className="rounded-full bg-accent/10 ring-1 ring-accent/20 px-2 py-0.5 font-mono text-[9px] font-bold tabular-nums text-accent">
                {discoveries.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[9px] font-semibold text-accent/50 uppercase tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Breakout
            </span>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex h-6 w-6 items-center justify-center rounded-lg ring-1 ring-accent/10 bg-accent/[0.04] text-accent/60 transition-all hover:text-accent hover:ring-accent/20"
            >
              <svg
                width="10"
                height="10"
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

        {/* Discovery Cards */}
        {!collapsed && (
          <div className="overflow-x-auto scrollbar-thin px-3 py-3">
            <div className="flex gap-2.5" style={{ width: "max-content" }}>
              {discoveries.map((stock, i) => (
                <DiscoveryCard
                  key={stock.symbol}
                  stock={stock}
                  index={i}
                  added={addedSymbols.has(stock.symbol)}
                  onAdd={handleAdd}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BreakBar({
  percent,
  label,
  color,
}: {
  percent: number;
  label: string;
  color: "accent" | "blue";
}) {
  const capped = Math.min(Math.abs(percent), 25);
  const width = Math.max((capped / 25) * 100, 10);
  const barColor =
    color === "accent" ? "bg-accent" : "bg-blue-400";
  const textColor =
    color === "accent" ? "text-accent" : "text-blue-400";

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] font-semibold text-text-muted w-2 text-right">
        {label}
      </span>
      <div className="h-[3px] w-10 rounded-full bg-surface-overlay overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} animate-bar-fill`}
          style={{ "--bar-width": `${width}%`, width: `${width}%` } as React.CSSProperties}
        />
      </div>
      <span
        className={`font-mono text-[8px] font-bold tabular-nums ${textColor}`}
      >
        +{percent.toFixed(1)}%
      </span>
    </div>
  );
}

function DiscoveryCard({
  stock,
  index,
  added,
  onAdd,
}: {
  stock: DiscoveryStock;
  index: number;
  added: boolean;
  onAdd: (symbol: string, name: string) => void;
}) {
  const isUp = stock.pChange >= 0;
  const isRadar = !stock.fullBreakout;

  return (
    <div
      className={`group relative flex flex-col rounded-xl px-3.5 py-3 transition-all duration-200 animate-fade-in ${
        isRadar
          ? "ring-1 ring-amber-500/15 border border-dashed border-amber-500/20 bg-amber-500/[0.02] hover:ring-amber-500/30 hover:bg-amber-500/[0.04]"
          : "ring-1 ring-accent/12 bg-accent/[0.02] hover:ring-accent/25 hover:bg-accent/[0.04]"
      }`}
      style={{
        minWidth: 172,
        width: 172,
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Status indicator */}
      <div className="absolute right-2 top-2">
        {isRadar ? (
          /* Steady amber dot — "on radar" */
          <span className="flex h-1.5 w-1.5">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400/70" />
          </span>
        ) : (
          /* Pulsing green dot — confirmed breakout */
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(0,230,138,0.4)]" />
          </span>
        )}
      </div>

      {/* Symbol & Badge */}
      <div className="flex items-center gap-1.5">
        <span className={`font-display text-[11px] font-bold tracking-tight ${isRadar ? "text-amber-400" : "text-accent"}`}>
          {stock.symbol}
        </span>
        {stock.fullBreakout ? (
          <span className="rounded bg-accent/8 ring-1 ring-accent/15 px-1 py-px text-[7px] font-bold uppercase tracking-wider text-accent/70">
            Breakout
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/8 ring-1 ring-amber-500/15 px-1 py-px text-[7px] font-bold uppercase tracking-wider text-amber-400/70">
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-400/70">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            On Radar
          </span>
        )}
      </div>

      {/* Price & Change */}
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-xs font-bold tabular-nums tracking-tight text-text-primary">
          {stock.lastPrice > 0
            ? `\u20B9${stock.lastPrice.toLocaleString("en-IN")}`
            : "\u2014"}
        </span>
        <span
          className={`font-mono text-[10px] font-semibold tabular-nums ${
            isUp ? "text-accent" : "text-danger"
          }`}
        >
          {isUp ? "+" : ""}
          {stock.pChange.toFixed(2)}%
        </span>
      </div>

      {/* Break Strength Bars */}
      <div className="mt-2 space-y-1">
        <BreakBar
          percent={stock.highBreakPercent}
          label="H"
          color="accent"
        />
        <BreakBar
          percent={stock.volumeBreakPercent}
          label="V"
          color="blue"
        />
      </div>

      {/* Volume */}
      <div className="mt-1.5 flex items-center gap-1">
        <svg
          width="7"
          height="7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-text-muted/40"
        >
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="10" width="4" height="10" />
        </svg>
        <span className="font-mono text-[8px] tabular-nums text-text-muted/60">
          {formatVol(stock.totalTradedVolume)}
        </span>
      </div>

      {/* Add Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!added) onAdd(stock.symbol, stock.name);
        }}
        disabled={added}
        className={`mt-2.5 flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[9px] font-semibold transition-all duration-200 ring-1 ${
          added
            ? "ring-accent/10 bg-accent/[0.04] text-accent/40 cursor-default"
            : isRadar
              ? "ring-amber-500/15 bg-amber-500/[0.06] text-amber-400 hover:ring-amber-500/30 hover:bg-amber-500/[0.1]"
              : "ring-accent/15 bg-accent/[0.06] text-accent hover:ring-accent/30 hover:bg-accent/[0.1]"
        }`}
      >
        {added ? (
          <>
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Added
          </>
        ) : (
          <>
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add to Watchlist
          </>
        )}
      </button>
    </div>
  );
}
