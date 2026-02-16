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
}

export interface Alert {
  id: string;
  symbol: string;
  name: string;
  todayHigh: number;
  todayVolume: number;
  prevMaxHigh: number;
  prevMaxVolume: number;
  highBreakPercent: number;
  volumeBreakPercent: number;
  todayClose: number;
  todayChange: number;
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

/* ── Activity / Audit types ─────────────────────────────────────────── */

export type ActivityCategory = "user" | "system" | "warning";

export interface ActivityEvent {
  id: string;
  ts: string;
  cat: ActivityCategory;
  action: string;
  label: string;
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
