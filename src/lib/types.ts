export interface WatchlistStock {
  symbol: string;
  name: string;
}

export interface DayData {
  date: string;
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
}

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

export interface ScanResponse {
  results: ScanResult[];
  alerts: Alert[];
  scannedAt: string;
  marketOpen: boolean;
}
