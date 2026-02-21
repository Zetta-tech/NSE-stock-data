import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { getEquityStockIndicesMock } = vi.hoisted(() => ({
  getEquityStockIndicesMock: vi.fn(),
}));

vi.mock("stock-nse-india", () => ({
  NseIndia: vi.fn(() => ({
    getEquityStockIndices: getEquityStockIndicesMock,
  })),
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
    expect(second.stocks[0]?.symbol).toBe("INFY");
    expect(stats.snapshotFetchCount).toBe(2);
    expect(stats.snapshotFailCount).toBe(1);
  });
});
