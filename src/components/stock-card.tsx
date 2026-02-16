"use client";

import type { ScanResult } from "@/lib/types";

export function StockCard({
  result,
  onRemove,
}: {
  result: ScanResult;
  onRemove: (symbol: string) => void;
}) {
  const hasData = result.todayHigh > 0;
  const highBreaks = hasData && result.todayHigh > result.prevMaxHigh;
  const volBreaks = hasData && result.todayVolume > result.prevMaxVolume;

  return (
    <div
      className={`group relative rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        result.triggered
          ? "border-accent/40 bg-accent-muted/40 shadow-accent/5 shadow-lg"
          : "border-surface-border bg-surface-raised hover:border-surface-border/80"
      }`}
    >
      <button
        onClick={() => onRemove(result.symbol)}
        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-all hover:bg-danger-muted hover:text-danger group-hover:opacity-100"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{result.symbol}</h3>
            {result.triggered && (
              <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                Breakout
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">{result.name}</p>
        </div>
        {hasData && (
          <div className="text-right">
            <p className="text-base font-semibold tabular-nums">
              ₹{result.todayClose.toLocaleString("en-IN")}
            </p>
            <p
              className={`text-xs font-medium tabular-nums ${
                result.todayChange >= 0 ? "text-accent" : "text-danger"
              }`}
            >
              {result.todayChange >= 0 ? "+" : ""}
              {result.todayChange.toFixed(2)}%
            </p>
          </div>
        )}
      </div>

      {hasData ? (
        <div className="mt-4 space-y-3">
          <MetricRow
            label="High"
            today={`₹${result.todayHigh.toLocaleString("en-IN")}`}
            prev={`₹${result.prevMaxHigh.toLocaleString("en-IN")}`}
            breakPercent={result.highBreakPercent}
            breaks={highBreaks}
          />
          <MetricRow
            label="Volume"
            today={formatVolume(result.todayVolume)}
            prev={formatVolume(result.prevMaxVolume)}
            breakPercent={result.volumeBreakPercent}
            breaks={volBreaks}
          />
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-surface-overlay/50 px-3 py-4 text-center text-xs text-text-muted">
          No data available. Run a scan to fetch data.
        </div>
      )}

      {hasData && (
        <div className="mt-3 flex gap-1.5">
          <StatusPill active={highBreaks} label="High Break" />
          <StatusPill active={volBreaks} label="Vol Break" />
        </div>
      )}
    </div>
  );
}

function MetricRow({
  label,
  today,
  prev,
  breakPercent,
  breaks,
}: {
  label: string;
  today: string;
  prev: string;
  breakPercent: number;
  breaks: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted w-14">{label}</span>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <span className="text-text-secondary">Today </span>
          <span className={`font-medium tabular-nums ${breaks ? "text-accent" : "text-text-primary"}`}>
            {today}
          </span>
        </div>
        <span className="text-text-muted">vs</span>
        <div className="text-right">
          <span className="text-text-secondary">5d Max </span>
          <span className="font-medium tabular-nums text-text-primary">{prev}</span>
        </div>
        {breaks && (
          <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-accent">
            +{breakPercent.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        active
          ? "bg-accent-muted text-accent"
          : "bg-surface-overlay text-text-muted"
      }`}
    >
      {active ? "✓" : "—"} {label}
    </span>
  );
}

function formatVolume(vol: number): string {
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)}Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)}L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}
