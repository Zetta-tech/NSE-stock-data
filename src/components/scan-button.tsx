"use client";

export function ScanButton({
  onScan,
  loading,
  intraday,
  onToggleIntraday,
}: {
  onScan: () => void;
  loading: boolean;
  intraday: boolean;
  onToggleIntraday: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleIntraday}
        className={`relative overflow-hidden rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ring-1 ${
          intraday
            ? "ring-accent/25 bg-accent/8 text-accent"
            : "ring-surface-border bg-surface-raised text-text-secondary hover:ring-surface-border-bright hover:text-text-primary"
        }`}
      >
        <span className="relative z-10 flex items-center gap-1.5">
          {intraday ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          )}
          {intraday ? "Live" : "Daily"}
        </span>
      </button>
      <button
        onClick={onScan}
        disabled={loading}
        className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-accent to-accent-hover px-5 py-2.5 text-sm font-bold text-surface shadow-lg shadow-accent/15 transition-all duration-200 hover:shadow-accent/25 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
      >
        <span className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/10" />
        {loading ? (
          <>
            <span className="relative h-4 w-4 animate-spin rounded-full border-2 border-surface/30 border-t-surface" />
            <span className="relative">Scanning...</span>
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="relative"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="relative">Run Scan</span>
          </>
        )}
      </button>
    </div>
  );
}
