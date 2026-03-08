import { beforeEach, describe, expect, test, vi } from "vitest";
import { makeAlert } from "@/test-utils/fixtures";

const { redisMap } = vi.hoisted(() => ({
  redisMap: new Map<string, unknown>(),
}));

vi.mock("./redis", () => ({
  getRedis: () => ({
    get: async <T,>(key: string) => (redisMap.get(key) as T | undefined) ?? null,
    set: async (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) => {
      if (opts?.nx && redisMap.has(key)) return null;
      redisMap.set(key, value);
      return "OK";
    },
  }),
}));

import { addAlert, getAlerts } from "./store";

describe("Idempotent alert writes (SET NX guard)", () => {
  beforeEach(() => {
    redisMap.clear();
  });

  test("blocks concurrent duplicate within same 30-min window via SET NX", async () => {
    const a1 = makeAlert({
      id: "a1",
      symbol: "RELIANCE",
      alertType: "breakout",
      triggeredAt: "2025-03-04T10:15:00.000Z",
    });
    const a2 = makeAlert({
      id: "a2",
      symbol: "RELIANCE",
      alertType: "breakout",
      triggeredAt: "2025-03-04T10:20:00.000Z",
    });

    expect(await addAlert(a1)).toBe(true);
    expect(await addAlert(a2)).toBe(false);
    expect(await getAlerts()).toHaveLength(1);
  });

  test("same symbol same day different window still blocked by date-level dedup", async () => {
    const morning = makeAlert({
      id: "m1",
      symbol: "INFY",
      alertType: "breakout",
      triggeredAt: "2025-03-04T04:10:00.000Z",
    });
    const afternoon = makeAlert({
      id: "m2",
      symbol: "INFY",
      alertType: "breakout",
      triggeredAt: "2025-03-04T04:45:00.000Z",
    });

    expect(await addAlert(morning)).toBe(true);
    expect(await addAlert(afternoon)).toBe(false);
    expect(await getAlerts()).toHaveLength(1);
  });

  test("same symbol different day is allowed", async () => {
    const day1 = makeAlert({
      id: "d1",
      symbol: "INFY",
      alertType: "breakout",
      triggeredAt: "2025-03-04T10:15:00.000Z",
    });
    const day2 = makeAlert({
      id: "d2",
      symbol: "INFY",
      alertType: "breakout",
      triggeredAt: "2025-03-05T10:15:00.000Z",
    });

    expect(await addAlert(day1)).toBe(true);
    expect(await addAlert(day2)).toBe(true);
    expect(await getAlerts()).toHaveLength(2);
  });

  test("different alert types in same window are independent", async () => {
    const breakout = makeAlert({
      id: "b1",
      symbol: "SBIN",
      alertType: "breakout",
      triggeredAt: "2025-03-04T10:15:00.000Z",
    });
    const ma200 = makeAlert({
      id: "m1",
      symbol: "SBIN",
      alertType: "ma200-touch",
      triggeredAt: "2025-03-04T10:15:00.000Z",
    });

    expect(await addAlert(breakout)).toBe(true);
    expect(await addAlert(ma200)).toBe(true);
    expect(await getAlerts()).toHaveLength(2);
  });

  test("SET NX lock key includes time window so concurrent Lambdas in same window are blocked", async () => {
    const a1 = makeAlert({
      id: "t1",
      symbol: "TCS",
      alertType: "scan",
      triggeredAt: "2025-03-04T10:29:00.000Z",
    });
    const a2 = makeAlert({
      id: "t2",
      symbol: "TCS",
      alertType: "scan",
      triggeredAt: "2025-03-04T10:05:00.000Z",
    });

    expect(await addAlert(a1)).toBe(true);
    expect(await addAlert(a2)).toBe(false);

    const lockKey = "alert-lock:TCS:scan:2025-03-04:10:00";
    expect(redisMap.has(lockKey)).toBe(true);
  });
});
