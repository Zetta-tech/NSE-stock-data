import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { StockBaseline } from "./types";

const { getHistoricalDataMock, getRedisMock, loggerMock } = vi.hoisted(() => ({
  getHistoricalDataMock: vi.fn(),
  getRedisMock: vi.fn(),
  loggerMock: {
    api: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("./nse-client", () => ({
  getHistoricalData: getHistoricalDataMock,
}));

vi.mock("./redis", () => ({
  getRedis: getRedisMock,
}));

vi.mock("./logger", () => ({
  logger: loggerMock,
}));

function makeBaseline(symbol = "TCS"): StockBaseline {
  return {
    symbol,
    maxHigh5d: 110,
    maxVolume5d: 1200,
    minLow10d: 90,
    maxVolume10d: 2000,
    computedDate: "2025-01-06",
  };
}

describe("Baseline shared cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-06T10:30:00.000Z"));
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns Upstash-cached baselines when fetch hydration is disabled", async () => {
    const baseline = makeBaseline("TCS");
    const redis = {
      get: vi.fn(async (key: string) =>
        key === "nse:baseline:2025-01-06:TCS" ? baseline : null,
      ),
      set: vi.fn(),
    };
    getRedisMock.mockReturnValue(redis);

    const { getBaselines } = await import("./baselines");
    const result = await getBaselines(["TCS"], { maxToFetch: 0 });

    expect(result.get("TCS")).toEqual(baseline);
    expect(getHistoricalDataMock).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  test("writes newly computed baselines to Upstash", async () => {
    const redis = {
      get: vi.fn(async () => null),
      set: vi.fn(),
    };
    getRedisMock.mockReturnValue(redis);
    getHistoricalDataMock.mockResolvedValue([
      { date: "2025-01-01", high: 100, low: 90, open: 95, close: 98, volume: 1000 },
      { date: "2025-01-02", high: 101, low: 91, open: 96, close: 99, volume: 1100 },
      { date: "2025-01-03", high: 102, low: 92, open: 97, close: 100, volume: 1200 },
      { date: "2025-01-04", high: 103, low: 93, open: 98, close: 101, volume: 1300 },
      { date: "2025-01-05", high: 104, low: 94, open: 99, close: 102, volume: 1400 },
    ]);

    const { getBaseline } = await import("./baselines");
    const baseline = await getBaseline("tcs");

    expect(baseline).toMatchObject({
      symbol: "TCS",
      maxHigh5d: 104,
      maxVolume5d: 1200,
      minLow10d: 90,
      maxVolume10d: 1400,
      computedDate: "2025-01-06",
    });
    expect(redis.set).toHaveBeenCalledWith(
      "nse:baseline:2025-01-06:TCS",
      baseline,
      { ex: 129600 },
    );
  });
});
