import type {
  Alert,
  BreakoutDiscovery,
  Nifty50Snapshot,
  Nifty50StockRow,
  Nifty50TableResponse,
  StockBaseline,
  WatchlistStock,
} from "@/lib/types";

export function makeSnapshotStock(
  overrides: Partial<Nifty50StockRow> = {},
): Nifty50StockRow {
  return {
    symbol: "INFY",
    name: "Infosys",
    lastPrice: 1500,
    change: 10,
    pChange: 0.67,
    open: 1490,
    dayHigh: 1510,
    dayLow: 1485,
    previousClose: 1490,
    totalTradedVolume: 1_000_000,
    totalTradedValue: 1_500_000_000,
    yearHigh: 1900,
    yearLow: 1200,
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<Nifty50Snapshot> = {},
): Nifty50Snapshot {
  return {
    stocks: [makeSnapshotStock()],
    fetchedAt: "2025-01-06T10:30:00.000Z",
    fetchSuccess: true,
    stale: false,
    ...overrides,
  };
}

export function makeDiscovery(
  overrides: Partial<BreakoutDiscovery> = {},
): BreakoutDiscovery {
  return {
    symbol: "INFY",
    name: "Infosys",
    breakout: false,
    highBreak: false,
    volumeBreak: false,
    highBreakPercent: 0,
    volumeBreakPercent: 0,
    baselineUnavailable: false,
    possibleBreakout: false,
    ...overrides,
  };
}

export function makeNifty50TableResponse(
  overrides: Partial<Nifty50TableResponse> = {},
): Nifty50TableResponse {
  return {
    snapshot: makeSnapshot(),
    discoveries: [],
    baselineStatus: {
      available: 1,
      missing: 49,
      date: "2025-01-06",
    },
    watchlistSymbols: [],
    closeWatchSymbols: [],
    marketOpen: true,
    ...overrides,
  };
}

export function makeBaseline(
  symbol: string,
  overrides: Partial<StockBaseline> = {},
): StockBaseline {
  return {
    symbol,
    maxHigh5d: 100,
    maxVolume5d: 1_000_000,
    computedDate: "2025-01-06",
    ...overrides,
  };
}

export function makeWatchlistStock(
  overrides: Partial<WatchlistStock> = {},
): WatchlistStock {
  return {
    symbol: "INFY",
    name: "Infosys",
    closeWatch: false,
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "INFY-1",
    symbol: "INFY",
    name: "Infosys",
    alertType: "scan",
    todayHigh: 1510,
    todayVolume: 1_200_000,
    prevMaxHigh: 1490,
    prevMaxVolume: 1_000_000,
    highBreakPercent: 1.34,
    volumeBreakPercent: 20,
    todayClose: 1505,
    todayChange: 1.2,
    triggeredAt: "2025-01-06T10:30:00.000Z",
    read: false,
    ...overrides,
  };
}
