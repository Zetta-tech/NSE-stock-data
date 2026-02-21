import { afterEach, describe, expect, test, vi } from "vitest";
import { isExtendedHours, isMarketHours, minutesUntilOpen } from "./market-hours";

describe("Market hours utility contracts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns market open only during weekday live session (09:15 to 15:30 IST)", () => {
    vi.useFakeTimers();
    // Monday, 06 Jan 2025 10:00 IST
    vi.setSystemTime(new Date("2025-01-06T04:30:00.000Z"));

    expect(isMarketHours()).toBe(true);
    expect(isExtendedHours()).toBe(true);
    expect(minutesUntilOpen()).toBe(0);
  });

  test("treats pre-open as closed and reports exact minutes until open", () => {
    vi.useFakeTimers();
    // Monday, 06 Jan 2025 08:00 IST
    vi.setSystemTime(new Date("2025-01-06T02:30:00.000Z"));

    expect(isMarketHours()).toBe(false);
    expect(isExtendedHours()).toBe(false);
    expect(minutesUntilOpen()).toBe(75);
  });

  test("treats weekends as closed even during market clock hours", () => {
    vi.useFakeTimers();
    // Saturday, 04 Jan 2025 11:00 IST
    vi.setSystemTime(new Date("2025-01-04T05:30:00.000Z"));

    expect(isMarketHours()).toBe(false);
    expect(isExtendedHours()).toBe(false);
  });
});
