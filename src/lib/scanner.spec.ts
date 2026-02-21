import { beforeEach, describe, expect, test, vi } from "vitest";

const { getHistoricalDataMock, getCurrentDayDataMock } = vi.hoisted(() => ({
  getHistoricalDataMock: vi.fn(),
  getCurrentDayDataMock: vi.fn(),
}));

vi.mock("./nse-client", () => ({
  getHistoricalData: getHistoricalDataMock,
  getCurrentDayData: getCurrentDayDataMock,
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

import { scanStock } from "./scanner";

const historicalFixture = [
  { date: "2025-01-01", high: 90, low: 80, open: 82, close: 88, volume: 500 },
  { date: "2025-01-02", high: 95, low: 85, open: 89, close: 92, volume: 600 },
  { date: "2025-01-03", high: 100, low: 90, open: 92, close: 98, volume: 700 },
  { date: "2025-01-04", high: 102, low: 93, open: 98, close: 101, volume: 800 },
  { date: "2025-01-05", high: 101, low: 95, open: 101, close: 100, volume: 900 },
  { date: "2025-01-06", high: 110, low: 99, open: 101, close: 108, volume: 1200 },
];

describe("Scanner breakout contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHistoricalDataMock.mockResolvedValue(historicalFixture);
    getCurrentDayDataMock.mockResolvedValue(null);
  });

  test("confirms a breakout only when both high and volume break above the prior five-day maxima", async () => {
    // Contract: historical scan must use last completed day vs prior 5 completed sessions.
    const result = await scanStock("TCS", "TCS", false, false);

    expect(result.dataSource).toBe("historical");
    expect(result.prevMaxHigh).toBe(102);
    expect(result.prevMaxVolume).toBe(900);
    expect(result.todayHigh).toBe(110);
    expect(result.todayVolume).toBe(1200);
    expect(result.triggered).toBe(true);
  });

  test("suppresses confirmed breakout when live fetch fails during market hours", async () => {
    // Contract: stale intraday data can be shown, but breakout cannot be marked confirmed.
    const result = await scanStock("TCS", "TCS", true, true);

    expect(result.dataSource).toBe("stale");
    expect(result.triggered).toBe(false);
    expect(result.todayHigh).toBe(110);
    expect(result.todayVolume).toBe(1200);
  });

  test("falls back to historical and still evaluates breakout when market is closed", async () => {
    // Contract: outside market hours, historical fallback is treated as trustworthy.
    const result = await scanStock("TCS", "TCS", true, false);

    expect(result.dataSource).toBe("historical");
    expect(result.triggered).toBe(true);
  });
});
