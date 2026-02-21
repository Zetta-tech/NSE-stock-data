import { beforeEach, describe, expect, test, vi } from "vitest";
import { makeAlert, makeWatchlistStock } from "@/test-utils/fixtures";

const mocks = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getAlerts: vi.fn(),
  getScanMeta: vi.fn(),
  getMarketStatus: vi.fn(),
  getHistoricalCacheStats: vi.fn(),
  getNifty50Index: vi.fn(),
  getApiStats: vi.fn(),
  getNifty50SnapshotStats: vi.fn(),
  getBaselineStats: vi.fn(),
}));

vi.mock("@/lib/store", () => ({
  getWatchlist: mocks.getWatchlist,
  getAlerts: mocks.getAlerts,
}));

vi.mock("@/lib/activity", () => ({
  getScanMeta: mocks.getScanMeta,
}));

vi.mock("@/lib/nse-client", () => ({
  getMarketStatus: mocks.getMarketStatus,
  getHistoricalCacheStats: mocks.getHistoricalCacheStats,
  getNifty50Index: mocks.getNifty50Index,
  getApiStats: mocks.getApiStats,
  getNifty50SnapshotStats: mocks.getNifty50SnapshotStats,
}));

vi.mock("@/lib/baselines", () => ({
  getBaselineStats: mocks.getBaselineStats,
}));

import { GET } from "./route";

describe("Dev state route contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getWatchlist.mockResolvedValue([
      makeWatchlistStock({ symbol: "INFY", closeWatch: true }),
      makeWatchlistStock({ symbol: "TCS", name: "TCS", closeWatch: false }),
    ]);
    mocks.getAlerts.mockResolvedValue([
      makeAlert({ id: "a1", alertType: "breakout", symbol: "INFY", read: false }),
      makeAlert({ id: "a2", alertType: "scan", symbol: "TCS", read: true }),
      makeAlert({ id: "a3", alertType: "scan", symbol: "SBIN", read: false }),
    ]);
    mocks.getScanMeta.mockResolvedValue({
      scannedAt: "2025-01-06T10:30:00.000Z",
      scanType: "manual",
      marketOpen: true,
      stockCount: 2,
      triggeredCount: 1,
      staleCount: 0,
      liveCount: 1,
      historicalCount: 1,
      closeWatchSymbols: ["INFY"],
      alertsFired: ["INFY"],
    });
    mocks.getMarketStatus.mockResolvedValue(true);
    mocks.getHistoricalCacheStats.mockReturnValue({
      size: 2,
      symbols: ["INFY", "TCS"],
      date: "2025-01-06",
    });
    mocks.getNifty50Index.mockResolvedValue({
      value: 22500,
      change: 100,
      changePercent: 0.45,
      open: 22400,
      high: 22600,
      low: 22300,
      previousClose: 22400,
      fetchedAt: "2025-01-06T10:30:00.000Z",
    });
    mocks.getApiStats.mockReturnValue({
      total: 20,
      apiCalls: 8,
      cacheHits: 12,
      recentRate: 0.13,
      last60s: [],
    });
    mocks.getNifty50SnapshotStats.mockReturnValue({
      lastRefreshTime: "2025-01-06T10:29:00.000Z",
      snapshotFetchSuccess: true,
      snapshotFetchCount: 7,
      snapshotFailCount: 1,
    });
    mocks.getBaselineStats.mockReturnValue({
      available: 48,
      missing: 2,
      date: "2025-01-06",
      symbols: ["INFY", "TCS"],
    });
  });

  test("returns dev panel counters for refresh health, baselines, and alert split", async () => {
    // Contract: Dev panel should get a single consolidated payload with health counters and splits.
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.market.open).toBe(true);
    expect(json.watchlist).toMatchObject({
      total: 2,
      closeWatch: 1,
      closeWatchSymbols: ["INFY"],
    });
    expect(json.alerts).toMatchObject({
      total: 3,
      unread: 2,
      nifty50Alerts: 1,
      scanAlerts: 2,
    });
    expect(json.cacheLayers.snapshot).toMatchObject({
      snapshotFetchSuccess: true,
      snapshotFetchCount: 7,
      snapshotFailCount: 1,
    });
    expect(json.nifty50Stats.baselines).toMatchObject({
      available: 48,
      missing: 2,
      date: "2025-01-06",
    });
  });
});
