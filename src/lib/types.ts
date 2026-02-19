export interface WatchlistStock {
  symbol: string;
  name: string;
  closeWatch: boolean;
}

export interface DayData {
  date: string;
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
}

export type DataSource = "live" | "historical" | "stale";

export interface ScanResult {
  symbol: string;
  name: string;
  triggered: boolean;
  todayHigh: number;
  todayVolume: number;
  prevMaxHigh: number;
  prevMaxVolume: number;
  highBreakPercent: number;
  volumeBreakPercent: number;
  todayClose: number;
  todayChange: number;
  scannedAt: string;
  dataSource: DataSource;
  lowBreakTriggered: boolean;
  prev10DayLow: number;
  lowBreakPercent: number;
}

export type AlertType = "breakout" | "low-break";

export interface Alert {
  id: string;
  symbol: string;
  name: string;
  alertType: AlertType;
  todayHigh: number;
  todayVolume: number;
  prevMaxHigh: number;
  prevMaxVolume: number;
  highBreakPercent: number;
  volumeBreakPercent: number;
  todayClose: number;
  todayChange: number;
  prev10DayLow: number;
  lowBreakPercent: number;
  triggeredAt: string;
  read: boolean;
}

export interface TickerQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  high: number;
  volume: number;
  fetchedAt: string;
}

export interface ScanResponse {
  results: ScanResult[];
  alerts: Alert[];
  scannedAt: string;
  marketOpen: boolean;
  cacheStats?: {
    size: number;
    symbols: string[];
    date: string;
  };
}

/* ── Nifty 50 Index ────────────────────────────────────────────────── */

export interface NiftyIndex {
  value: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  fetchedAt: string;
}

/* ── Activity / Audit types ─────────────────────────────────────────── */

export type ActivityCategory = "user" | "system" | "warning";

export type ActivityActor = "dad" | "system" | "auto-check";

export interface ActivityChange {
  field: string;
  from?: string | number | boolean;
  to?: string | number | boolean;
}

export interface ActivityEvent {
  id: string;
  ts: string;
  cat: ActivityCategory;
  action: string;
  label: string;
  actor?: ActivityActor;
  changes?: ActivityChange[];
  snapshot?: Record<string, unknown>;
  detail?: Record<string, unknown>;
}

export interface ScanMeta {
  scannedAt: string;
  scanType: "manual" | "auto";
  marketOpen: boolean;
  stockCount: number;
  triggeredCount: number;
  staleCount: number;
  liveCount: number;
  historicalCount: number;
  closeWatchSymbols: string[];
  alertsFired: string[];
}
