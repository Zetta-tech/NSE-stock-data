import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  makeBaseline,
  makeSnapshot,
  makeSnapshotStock,
  makeWatchlistStock,
} from "@/test-utils/fixtures";

const mocks = vi.hoisted(() => ({
  getNifty50Snapshot: vi.fn(),
  getNifty50PersistentStats: vi.fn(),
  updateNifty50PersistentStats: vi.fn(),
  getMarketStatus: vi.fn(),
  getBaselines: vi.fn(),
  getBaselineStats: vi.fn(),
  getWatchlist: vi.fn(),
  getCloseWatchStocks: vi.fn(),
  addAlert: vi.fn(),
  getAlerts: vi.fn(),
  addActivity: vi.fn(),
}));

vi.mock("@/lib/nse-client", () => ({
  getNifty50Snapshot: mocks.getNifty50Snapshot,
  getMarketStatus: mocks.getMarketStatus,
}));

vi.mock("@/lib/baselines", () => ({
  getBaselines: mocks.getBaselines,
  getBaselineStats: mocks.getBaselineStats,
}));

vi.mock("@/lib/store", () => ({
  getWatchlist: mocks.getWatchlist,
  getCloseWatchStocks: mocks.getCloseWatchStocks,
  addAlert: mocks.addAlert,
  getAlerts: mocks.getAlerts,
  getNifty50PersistentStats: mocks.getNifty50PersistentStats,
  updateNifty50PersistentStats: mocks.updateNifty50PersistentStats,
}));

vi.mock("@/lib/activity", () => ({
  addActivity: mocks.addActivity,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from "./route";

describe("Nifty50 route contracts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-06T10:30:00.000Z"));
    vi.clearAllMocks();

    mocks.getNifty50PersistentStats.mockResolvedValue({
      lastRefreshTime: "2025-01-06T10:29:00.000Z",
      snapshotFetchSuccess: true,
      snapshotFetchCount: 1,
      snapshotFailCount: 0,
    });
    mocks.updateNifty50PersistentStats.mockResolvedValue(undefined);
    mocks.getBaselineStats.mockReturnValue({
      available: 2,
      missing: 48,
      date: "2025-01-06",
      symbols: ["TCS", "ITC"],
    });
    mocks.getWatchlist.mockResolvedValue([]);
    mocks.getCloseWatchStocks.mockResolvedValue([]);
    mocks.getMarketStatus.mockResolvedValue(true);
    mocks.getBaselines.mockResolvedValue(new Map());
    mocks.getAlerts.mockResolvedValue([]);
    mocks.addAlert.mockResolvedValue(true);
    mocks.addActivity.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("builds discoveries only for non-watchlist symbols and raises alert for confirmed breakout", async () => {
    // Contract: NIFTY discovery must not duplicate symbols already covered by watchlist scans.
    mocks.getNifty50Snapshot.mockResolvedValue(
      makeSnapshot({
        stocks: [
          makeSnapshotStock({
            symbol: "INFY",
            name: "Infosys",
            dayHigh: 1600,
            totalTradedVolume: 2_000_000,
          }),
          makeSnapshotStock({
            symbol: "TCS",
            name: "TCS",
            dayHigh: 120,
            totalTradedVolume: 1500,
            lastPrice: 118,
            pChange: 2,
          }),
          makeSnapshotStock({
            symbol: "ITC",
            name: "ITC",
            dayHigh: 210,
            totalTradedVolume: 900,
            lastPrice: 205,
            pChange: 1,
          }),
        ],
      }),
    );
    mocks.getWatchlist.mockResolvedValue([
      makeWatchlistStock({ symbol: "INFY", name: "Infosys" }),
    ]);
    mocks.getBaselines.mockResolvedValue(
      new Map([
        ["TCS", makeBaseline("TCS", { maxHigh5d: 100, maxVolume5d: 1000 })],
        ["ITC", makeBaseline("ITC", { maxHigh5d: 200, maxVolume5d: 1000 })],
      ]),
    );

    const response = await GET();
    const json = await response.json();
    const symbols = json.discoveries.map((d: { symbol: string }) => d.symbol).sort();
    const tcs = json.discoveries.find((d: { symbol: string }) => d.symbol === "TCS");
    const itc = json.discoveries.find((d: { symbol: string }) => d.symbol === "ITC");

    expect(response.status).toBe(200);
    expect(symbols).toEqual(["ITC", "TCS"]);
    expect(tcs.breakout).toBe(true);
    expect(itc.highBreak).toBe(true);
    expect(itc.volumeBreak).toBe(false);

    expect(mocks.addAlert).toHaveBeenCalledTimes(2);
    expect(mocks.addAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "TCS",
        alertType: "breakout",
      }),
    );
    expect(mocks.addAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "ITC",
        alertType: "high-break",
      }),
    );
  });

  test("marks degraded rows as possible or baseline-unavailable and never confirms breakout", async () => {
    // Contract: when freshness or baseline trust is missing, do not emit a confirmed breakout.
    mocks.getNifty50Snapshot.mockResolvedValue(
      makeSnapshot({
        fetchSuccess: false,
        stale: true,
        stocks: [
          makeSnapshotStock({ symbol: "MISSING", name: "Missing Base", lastPrice: 100 }),
          makeSnapshotStock({ symbol: "STALE", name: "Stale Snapshot", lastPrice: 200 }),
        ],
      }),
    );
    mocks.getBaselines.mockResolvedValue(
      new Map([["STALE", makeBaseline("STALE", { maxHigh5d: 150, maxVolume5d: 1000 })]]),
    );

    const response = await GET();
    const json = await response.json();
    const missing = json.discoveries.find((d: { symbol: string }) => d.symbol === "MISSING");
    const stale = json.discoveries.find((d: { symbol: string }) => d.symbol === "STALE");

    expect(response.status).toBe(200);
    expect(missing.breakout).toBe(false);
    expect(missing.baselineUnavailable).toBe(true);
    expect(missing.possibleBreakout).toBe(false);

    expect(stale.breakout).toBe(false);
    expect(stale.baselineUnavailable).toBe(false);
    expect(stale.possibleBreakout).toBe(true);

    expect(mocks.addAlert).not.toHaveBeenCalled();
  });
});
