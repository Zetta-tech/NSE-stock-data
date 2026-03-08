import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { getTradingHolidaysMock } = vi.hoisted(() => ({
  getTradingHolidaysMock: vi.fn(),
}));

vi.mock("stock-nse-india", () => ({
  NseIndia: vi.fn(() => ({
    getTradingHolidays: getTradingHolidaysMock,
  })),
}));

vi.mock("./redis", () => ({
  getRedis: () => null,
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

describe("Holiday calendar gating", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("isHolidayToday returns true when today matches a holiday date", async () => {
    vi.setSystemTime(new Date("2025-01-26T04:30:00.000Z"));

    getTradingHolidaysMock.mockResolvedValue({
      CM: [
        { tradingDate: "26-Jan-2025" },
        { tradingDate: "15-Aug-2025" },
      ],
    });

    const { isHolidayToday } = await import("./nse-client");
    expect(await isHolidayToday()).toBe(true);
  });

  test("isHolidayToday returns false on a normal trading day", async () => {
    vi.setSystemTime(new Date("2025-01-06T04:30:00.000Z"));

    getTradingHolidaysMock.mockResolvedValue({
      CM: [
        { tradingDate: "26-Jan-2025" },
        { tradingDate: "15-Aug-2025" },
      ],
    });

    const { isHolidayToday } = await import("./nse-client");
    expect(await isHolidayToday()).toBe(false);
  });

  test("returns false and logs warning when holiday API fails", async () => {
    vi.setSystemTime(new Date("2025-01-26T04:30:00.000Z"));

    getTradingHolidaysMock.mockRejectedValue(new Error("NSE down"));

    const { isHolidayToday } = await import("./nse-client");
    expect(await isHolidayToday()).toBe(false);
  });

  test("caches holidays and does not re-fetch on second call same day", async () => {
    vi.setSystemTime(new Date("2025-01-06T04:30:00.000Z"));

    getTradingHolidaysMock.mockResolvedValue({
      CM: [{ tradingDate: "26-Jan-2025" }],
    });

    const { isHolidayToday } = await import("./nse-client");
    await isHolidayToday();
    await isHolidayToday();

    expect(getTradingHolidaysMock).toHaveBeenCalledTimes(1);
  });

  test("handles multiple segments in holiday response", async () => {
    vi.setSystemTime(new Date("2025-03-14T04:30:00.000Z"));

    getTradingHolidaysMock.mockResolvedValue({
      CM: [{ tradingDate: "14-Mar-2025" }],
      FO: [{ tradingDate: "14-Mar-2025" }],
      CD: [{ tradingDate: "01-May-2025" }],
    });

    const { isHolidayToday } = await import("./nse-client");
    expect(await isHolidayToday()).toBe(true);
  });
});
