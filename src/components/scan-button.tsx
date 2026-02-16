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
    <div className="flex items-center gap-3">
      <button
        onClick={onToggleIntraday}
        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
          intraday
            ? "border-accent/40 bg-accent-muted text-accent"
            : "border-surface-border bg-surface-raised text-text-secondary hover:border-surface-border hover:text-text-primary"
        }`}
      >
        {intraday ? "Live Mode" : "Daily Mode"}
      </button>
      <button
        onClick={onScan}
        disabled={loading}
        className="group relative flex items-center gap-2 overflow-hidden rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface/30 border-t-surface" />
            <span>Scanning...</span>
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
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span>Run Scan</span>
          </>
        )}
      </button>
    </div>
  );
}
