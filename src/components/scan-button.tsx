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
        className={`relative overflow-hidden rounded-[1.2rem] px-4 py-2.5 text-xs font-bold tracking-wide transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:scale-[1.03] ring-1 ${intraday
            ? "ring-accent/25 bg-accent/10 text-accent shadow-[0_0_15px_rgba(0,230,138,0.15)]"
            : "ring-surface-border bg-surface-raised text-text-secondary hover:ring-surface-border-bright hover:text-text-primary hover:shadow-lg hover:shadow-black/40"
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
        className="group relative flex items-center gap-2 overflow-hidden rounded-[1.2rem] bg-gradient-to-r from-accent to-accent-hover px-6 py-2.5 text-sm font-bold tracking-wide text-surface shadow-lg shadow-accent/20 transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:scale-[1.03] hover:shadow-accent/30 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100"
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
