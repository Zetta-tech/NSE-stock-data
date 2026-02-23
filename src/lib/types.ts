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
  alertType?: "breakout" | "scan";
  todayHigh: number;
  todayVolume: number;
  prevMaxHigh: number;
  prevMaxVolume: number;
  highBreakPercent: number;
  volumeBreakPercent: number;
  todayClose: number;
  todayChange: number;
  prev10DayLow?: number;
  lowBreakPercent?: number;
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

/* ── Nifty 50 Table (snapshot from getEquityStockIndices) ─────────── */

/** A single stock row returned by NSE's getEquityStockIndices("NIFTY 50") */
export interface Nifty50StockRow {
  symbol: string;
  name: string;
  lastPrice: number;
  change: number;
  pChange: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  totalTradedVolume: number;
  totalTradedValue: number;
  yearHigh: number;
  yearLow: number;
}

/** Full snapshot response for the Nifty 50 table */
export interface Nifty50Snapshot {
  stocks: Nifty50StockRow[];
  fetchedAt: string;
  fetchSuccess: boolean;
  stale: boolean;
}

/** 5-day baseline for a single stock (computed once per trading day) */
export interface StockBaseline {
  symbol: string;
  maxHigh5d: number;
  maxVolume5d: number;
  computedDate: string; // YYYY-MM-DD in IST
}

/** Breakout discovery signal for Nifty 50 table */
export interface BreakoutDiscovery {
  symbol: string;
  name: string;
  /** true = both high AND volume break (full breakout) */
  breakout: boolean;
  /** true = only high break */
  highBreak: boolean;
  /** true = only volume break */
  volumeBreak: boolean;
  highBreakPercent: number;
  volumeBreakPercent: number;
  /** true = baseline data is unreliable or missing */
  baselineUnavailable: boolean;
  /** true = live price data fetch failed; breakout is possible but unconfirmed */
  possibleBreakout: boolean;
}

/** API response for /api/nifty50 */
export interface Nifty50TableResponse {
  snapshot: Nifty50Snapshot;
  discoveries: BreakoutDiscovery[];
  baselineStatus: {
    available: number;
    missing: number;
    date: string;
  };
  watchlistSymbols: string[];
  closeWatchSymbols: string[];
  marketOpen: boolean;
  /** Number of new alerts created in this fetch cycle */
  newAlertCount?: number;
}

/** Dev panel tracking for Nifty50 system */
export interface Nifty50DevStats {
  lastRefreshTime: string | null;
  snapshotFetchSuccess: boolean;
  snapshotFetchCount: number;
  snapshotFailCount: number;
  baselineAvailable: number;
  baselineMissing: number;
  baselineDate: string;
  alertCount: number;
  discoveryCount: number;
}

/** A breakout discovery enriched with live price data for the dashboard feed */
export interface DiscoveryStock {
  symbol: string;
  name: string;
  lastPrice: number;
  change: number;
  pChange: number;
  dayHigh: number;
  totalTradedVolume: number;
  highBreakPercent: number;
  volumeBreakPercent: number;
}

/** Persistent Nifty 50 stats stored in Redis/filesystem for cross-Lambda visibility */
export interface Nifty50PersistentStats {
  lastRefreshTime: string | null;
  snapshotFetchSuccess: boolean;
  snapshotFetchCount: number;
  snapshotFailCount: number;
}
