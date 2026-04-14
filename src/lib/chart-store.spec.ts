import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCanonicalChartData, warmupRemainingYears } from "./chart-store";
import { getRedis } from "./redis";

// Mock the redis and nse client dependencies
vi.mock("./redis", () => ({
  getRedis: vi.fn(),
}));

const { mockGetEquityHistoricalData } = vi.hoisted(() => ({
  mockGetEquityHistoricalData: vi.fn(),
}));

vi.mock("stock-nse-india", () => {
  return {
    NseIndia: vi.fn().mockImplementation(() => ({
      getEquityHistoricalData: mockGetEquityHistoricalData,
    })),
  };
});

describe("chart-store", () => {
  let mockRedisClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEquityHistoricalData.mockReset();
    mockRedisClient = {
      get: vi.fn(),
      set: vi.fn(),
      setnx: vi.fn(),
      expire: vi.fn(),
      del: vi.fn(),
    };
    (getRedis as any).mockReturnValue(mockRedisClient);
  });

  it("handles cold start properly when lock is acquired", async () => {
    // metadata is missing -> cold start
    mockRedisClient.get.mockResolvedValueOnce(null);
    // lock is successfully acquired
    mockRedisClient.setnx.mockResolvedValueOnce("1");

    // Mock NSE Client returns valid chunk
    const { NseIndia } = await import("stock-nse-india");
    const mockNse = new NseIndia();
    // It returns an array of objects which contain "data" key
    mockGetEquityHistoricalData.mockResolvedValueOnce([
      { data: [{ mtimestamp: "2024-01-01", chTradeHighPrice: 100, chTradeLowPrice: 90, chOpeningPrice: 95, chClosingPrice: 98, chTotTradedQty: 1000 }] },
    ]);

    const result = await getCanonicalChartData("INFY");
    
    expect(mockRedisClient.setnx).toHaveBeenCalledWith("chart:lock:sync:INFY", "1");
    expect(result.length).toBe(1);
    expect(result[0].date).toBe("2024-01-01");
    // Ensure lock is deleted at the end
    expect(mockRedisClient.del).toHaveBeenCalledWith("chart:lock:sync:INFY");
    // Ensure it saved
    expect(mockRedisClient.set).toHaveBeenCalledWith("chart:daily:INFY", expect.any(Array));
  });

  it("returns fallback cache retry if cold start lock is NOT acquired", async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);
    mockRedisClient.setnx.mockResolvedValueOnce(null); // lock failed
    // on retry it finds the data
    mockRedisClient.get.mockImplementation(async (key: string) => {
        if (key === "chart:daily:INFY") return [{ date: "2024-01-01" }];
        return null;
    });

    const result = await getCanonicalChartData("INFY");
    expect(mockRedisClient.setnx).toHaveBeenCalledWith("chart:lock:sync:INFY", "1");
    expect(result[0].date).toBe("2024-01-01");
    // Ensure it didn't fetch API
    expect(mockGetEquityHistoricalData).not.toHaveBeenCalled();
  });

  it("performs gap-fill if data is older than 1 day", async () => {
    // Provide existing meta pointing to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 3);
    mockRedisClient.get.mockImplementation(async (key: string) => {
        if (key === "chart:meta:INFY") return {
            lastCompletedCandleDate: yesterday.toISOString(),
            coverageStart: "2023-01-01",
            coverageEnd: yesterday.toISOString(),
            lastSyncAt: Date.now(),
            schemaVersion: 1
        };
        if (key === "chart:daily:INFY") return [{ date: "2023-01-01" }];
        return null;
    });
    mockRedisClient.setnx.mockResolvedValueOnce("1");

    mockGetEquityHistoricalData.mockResolvedValueOnce([
        { data: [{ mtimestamp: new Date().toISOString(), chTradeHighPrice: 110, chTradeLowPrice: 90, chOpeningPrice: 95, chClosingPrice: 105, chTotTradedQty: 1000 }] },
    ]);

    const result = await getCanonicalChartData("INFY");
    
    // Gap filled array contains previous + new
    expect(result.length).toBe(2);
    expect(mockRedisClient.set).toHaveBeenCalledWith("chart:meta:INFY", expect.any(Object));
  });
});
