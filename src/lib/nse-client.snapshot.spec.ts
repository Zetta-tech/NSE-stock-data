import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { getEquityStockIndicesMock, getEquityChartHistoricalDataMock, getRedisMock } = vi.hoisted(() => ({
  getEquityStockIndicesMock: vi.fn(),
  getEquityChartHistoricalDataMock: vi.fn(),
  getRedisMock: vi.fn(),
}));

vi.mock("stock-nse-india", () => ({
  NseIndia: vi.fn(() => ({
    getEquityStockIndices: getEquityStockIndicesMock,
    getEquityChartHistoricalData: getEquityChartHistoricalDataMock,
  })),
}));

vi.mock("./redis", () => ({
  getRedis: getRedisMock,
}));

vi.mock("./logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    api: vi.fn(),
    log: vi.fn(),
  },
}));

describe("Nifty 50 snapshot parsing contracts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getRedisMock.mockReturnValue(null);
    vi.useFakeTimers();
    // Monday, 06 Jan 2025 10:00 IST (inside extended hours).
    vi.setSystemTime(new Date("2025-01-06T04:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("maps NSE snapshot rows into the stable table contract", async () => {
    getEquityStockIndicesMock.mockResolvedValue({
      data: [
        {
          symbol: "NIFTY 50",
          lastPrice: 0,
        },
        {
          symbol: "INFY",
          meta: { companyName: "Infosys Ltd" },
          lastPrice: 1500,
          change: 12,
          pChange: 0.8,
          open: 1491,
          dayHigh: 1510,
          dayLow: 1489,
          previousClose: 1488,
          totalTradedVolume: 1200000,
          totalTradedValue: 1800000000,
          yearHigh: 1900,
          yearLow: 1200,
        },
      ],
    });

    const { getNifty50Snapshot } = await import("./nse-client");
    const snapshot = await getNifty50Snapshot();

    expect(getEquityStockIndicesMock).toHaveBeenCalledWith("NIFTY 50");
    expect(snapshot.fetchSuccess).toBe(true);
    expect(snapshot.stale).toBe(false);
    expect(snapshot.source).toBe("nse-index");
    expect(snapshot.stocks).toHaveLength(1);
    expect(snapshot.stocks[0]).toMatchObject({
      symbol: "INFY",
      name: "Infosys Ltd",
      dayHigh: 1510,
      totalTradedVolume: 1200000,
    });
  });

  test("returns stale snapshot with unconfirmed freshness when refresh fails after cache is seeded", async () => {
    // Contract: on transient NSE failure, keep showing previous rows but mark stale/unavailable freshness.
    getEquityStockIndicesMock
      .mockResolvedValueOnce({
        data: [
          {
            symbol: "INFY",
            meta: { companyName: "Infosys Ltd" },
            lastPrice: 1500,
            dayHigh: 1510,
            dayLow: 1489,
            previousClose: 1488,
            totalTradedVolume: 1200000,
            totalTradedValue: 1800000000,
            yearHigh: 1900,
            yearLow: 1200,
            change: 12,
            pChange: 0.8,
            open: 1491,
          },
        ],
      })
      .mockRejectedValueOnce(new Error("NSE timeout"));

    const nseClient = await import("./nse-client");
    const first = await nseClient.getNifty50Snapshot();
    expect(first.fetchSuccess).toBe(true);

    // Expire 3-minute TTL so the next call attempts a fresh fetch.
    vi.advanceTimersByTime(3 * 60_000 + 1);

    const second = await nseClient.getNifty50Snapshot();
    const stats = nseClient.getNifty50SnapshotStats();

    expect(second.fetchSuccess).toBe(false);
    expect(second.stale).toBe(true);
    expect(second.source).toBe("nse-index");
    expect(second.stocks[0]?.symbol).toBe("INFY");
    expect(stats.snapshotFetchCount).toBe(2);
    expect(stats.snapshotFailCount).toBe(1);
  });

  test("uses charting intraday fallback when Nifty index metadata has no constituent rows", async () => {
    getEquityStockIndicesMock.mockResolvedValue({
      name: "NIFTY 50",
      metadata: { last: 23405.6 },
      data: [],
    });
    getEquityChartHistoricalDataMock.mockImplementation(() =>
      Promise.resolve({
        status: true,
        data: [
          { time: 1000, open: 99, high: 101, low: 98, close: 100, volume: 12345 },
          { time: 2000, open: 100, high: 102, low: 99, close: 101, volume: 23456 },
        ],
      }),
    );

    const { getNifty50Snapshot } = await import("./nse-client");
    const snapshot = await getNifty50Snapshot();

    expect(snapshot.fetchSuccess).toBe(true);
    expect(snapshot.stale).toBe(false);
    expect(snapshot.source).toBe("nse-charting-intraday");
    expect(snapshot.stocks.length).toBeGreaterThanOrEqual(40);
    expect(snapshot.stocks[0]).toMatchObject({
      lastPrice: 101,
      change: 2,
      dayHigh: 102,
      totalTradedVolume: 35801,
    });
    expect(getEquityChartHistoricalDataMock).toHaveBeenCalled();
  });

  test("writes successful snapshots to fresh and last-good Upstash keys", async () => {
    const redis = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => "OK"),
      createScript: vi.fn(() => ({ exec: vi.fn(async () => 1) })),
    };
    getRedisMock.mockReturnValue(redis);
    getEquityStockIndicesMock.mockResolvedValue({
      data: [
        {
          symbol: "INFY",
          meta: { companyName: "Infosys Ltd" },
          lastPrice: 1500,
          change: 12,
          pChange: 0.8,
          open: 1491,
          dayHigh: 1510,
          dayLow: 1489,
          previousClose: 1488,
          totalTradedVolume: 1200000,
          totalTradedValue: 1800000000,
          yearHigh: 1900,
          yearLow: 1200,
        },
      ],
    });

    const { getNifty50Snapshot } = await import("./nse-client");
    const snapshot = await getNifty50Snapshot();

    expect(snapshot.fetchSuccess).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      "nse:nifty50Snapshot",
      expect.objectContaining({ source: "nse-index", fetchSuccess: true }),
      { ex: 900 },
    );
    expect(redis.set).toHaveBeenCalledWith(
      "nse:nifty50Snapshot:lastGood",
      expect.objectContaining({ source: "nse-index", fetchSuccess: true }),
      { ex: 432000 },
    );
  });

  test("returns shared last-good snapshots as stale when market is unavailable", async () => {
    // Monday, 06 Jan 2025 07:30 IST (outside extended market hours).
    vi.setSystemTime(new Date("2025-01-06T02:00:00.000Z"));
    const lastGoodSnapshot = {
      stocks: [
        {
          symbol: "INFY",
          name: "Infosys Ltd",
          lastPrice: 1500,
          change: 12,
          pChange: 0.8,
          open: 1491,
          dayHigh: 1510,
          dayLow: 1489,
          previousClose: 1488,
          totalTradedVolume: 1200000,
          totalTradedValue: 1800000000,
          yearHigh: 1900,
          yearLow: 1200,
        },
      ],
      fetchedAt: "2025-01-03T10:00:00.000Z",
      fetchSuccess: true,
      stale: false,
      source: "nse-index",
    };
    const redis = {
      get: vi.fn(async (key: string) =>
        key === "nse:nifty50Snapshot:lastGood" ? lastGoodSnapshot : null,
      ),
      set: vi.fn(async () => "OK"),
      createScript: vi.fn(() => ({ exec: vi.fn(async () => 1) })),
    };
    getRedisMock.mockReturnValue(redis);

    const { getNifty50Snapshot } = await import("./nse-client");
    const snapshot = await getNifty50Snapshot();

    expect(getEquityStockIndicesMock).not.toHaveBeenCalled();
    expect(snapshot.fetchSuccess).toBe(false);
    expect(snapshot.stale).toBe(true);
    expect(snapshot.source).toBe("nse-index");
    expect(snapshot.stocks[0]?.symbol).toBe("INFY");
  });

  test("does not write partial fallback snapshots to the fresh Upstash key", async () => {
    const redis = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => "OK"),
      createScript: vi.fn(() => ({ exec: vi.fn(async () => 1) })),
    };
    getRedisMock.mockReturnValue(redis);
    getEquityStockIndicesMock.mockResolvedValue({
      name: "NIFTY 50",
      metadata: { last: 23405.6 },
      data: [],
    });
    getEquityChartHistoricalDataMock.mockImplementation((symbol: string) => {
      if (symbol !== "TCS") return Promise.reject(new Error("chart unavailable"));
      return Promise.resolve({
        status: true,
        data: [
          { time: 1000, open: 99, high: 101, low: 98, close: 100, volume: 12345 },
          { time: 2000, open: 100, high: 102, low: 99, close: 101, volume: 23456 },
        ],
      });
    });

    const { getNifty50Snapshot } = await import("./nse-client");
    const snapshot = await getNifty50Snapshot();

    expect(snapshot.fetchSuccess).toBe(false);
    expect(snapshot.stale).toBe(true);
    expect(snapshot.stocks).toHaveLength(1);
    expect(redis.set).not.toHaveBeenCalledWith(
      "nse:nifty50Snapshot",
      expect.anything(),
      expect.anything(),
    );
    expect(redis.set).not.toHaveBeenCalledWith(
      "nse:nifty50Snapshot:lastGood",
      expect.anything(),
    );

    getEquityStockIndicesMock.mockClear();
    getEquityChartHistoricalDataMock.mockClear();
    await getNifty50Snapshot();

    expect(getEquityStockIndicesMock).toHaveBeenCalledWith("NIFTY 50");
    expect(getEquityChartHistoricalDataMock).toHaveBeenCalled();
  });

  test("waits for a shared snapshot when another request owns the refresh lock", async () => {
    let freshAvailable = false;
    const sharedSnapshot = {
      stocks: [
        {
          symbol: "INFY",
          name: "Infosys Ltd",
          lastPrice: 1500,
          change: 12,
          pChange: 0.8,
          open: 1491,
          dayHigh: 1510,
          dayLow: 1489,
          previousClose: 1488,
          totalTradedVolume: 1200000,
          totalTradedValue: 1800000000,
          yearHigh: 1900,
          yearLow: 1200,
        },
      ],
      fetchedAt: new Date().toISOString(),
      fetchSuccess: true,
      stale: false,
      source: "nse-index" as const,
    };
    const redis = {
      get: vi.fn(async (key: string) => {
        if (key === "nse:nifty50Snapshot") return freshAvailable ? sharedSnapshot : null;
        return null;
      }),
      set: vi.fn(async (key: string) =>
        key === "nse:nifty50Snapshot:refreshing" ? null : "OK",
      ),
      createScript: vi.fn(() => ({ exec: vi.fn(async () => 1) })),
    };
    getRedisMock.mockReturnValue(redis);

    const { getNifty50Snapshot } = await import("./nse-client");
    const pending = getNifty50Snapshot();
    freshAvailable = true;
    await vi.advanceTimersByTimeAsync(750);
    const snapshot = await pending;

    expect(snapshot.stocks[0]?.symbol).toBe("INFY");
    expect(snapshot.fetchSuccess).toBe(true);
    expect(getEquityStockIndicesMock).not.toHaveBeenCalled();
  });

  test("does not return empty during a cold shared refresh lock before the long wait window", async () => {
    let freshAvailable = false;
    const sharedSnapshot = {
      stocks: [
        {
          symbol: "INFY",
          name: "Infosys Ltd",
          lastPrice: 1500,
          change: 12,
          pChange: 0.8,
          open: 1491,
          dayHigh: 1510,
          dayLow: 1489,
          previousClose: 1488,
          totalTradedVolume: 1200000,
          totalTradedValue: 1800000000,
          yearHigh: 1900,
          yearLow: 1200,
        },
      ],
      fetchedAt: new Date().toISOString(),
      fetchSuccess: true,
      stale: false,
      source: "nse-index" as const,
    };
    const redis = {
      get: vi.fn(async (key: string) => {
        if (key === "nse:nifty50Snapshot") return freshAvailable ? sharedSnapshot : null;
        return null;
      }),
      set: vi.fn(async (key: string) =>
        key === "nse:nifty50Snapshot:refreshing" ? null : "OK",
      ),
      createScript: vi.fn(() => ({ exec: vi.fn(async () => 1) })),
    };
    getRedisMock.mockReturnValue(redis);

    const { getNifty50Snapshot } = await import("./nse-client");
    const pending = getNifty50Snapshot();
    let resolved = false;
    const observed = pending.then((snapshot) => {
      resolved = true;
      return snapshot;
    });

    await vi.advanceTimersByTimeAsync(3_000);
    expect(resolved).toBe(false);

    freshAvailable = true;
    await vi.advanceTimersByTimeAsync(750);
    const snapshot = await observed;

    expect(snapshot.stocks[0]?.symbol).toBe("INFY");
    expect(snapshot.fetchSuccess).toBe(true);
    expect(getEquityStockIndicesMock).not.toHaveBeenCalled();
  });
});
