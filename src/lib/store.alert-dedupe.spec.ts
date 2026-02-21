import { beforeEach, describe, expect, test, vi } from "vitest";
import { makeAlert } from "@/test-utils/fixtures";

const { redisMap } = vi.hoisted(() => ({
  redisMap: new Map<string, unknown>(),
}));

vi.mock("./redis", () => ({
  getRedis: () => ({
    get: async <T,>(key: string) => (redisMap.get(key) as T | undefined) ?? null,
    set: async (key: string, value: unknown) => {
      redisMap.set(key, value);
      return "OK";
    },
  }),
}));

import { addAlert, getAlerts } from "./store";

describe("Alert dedupe key contracts", () => {
  beforeEach(() => {
    redisMap.clear();
  });

  test("prevents duplicate alerts for same symbol, same type, same trading day", async () => {
    // Contract: repeated detections from multiple scanners in the same day should not spam alerts.
    const first = makeAlert({
      id: "scan-1",
      symbol: "INFY",
      alertType: "scan",
      triggeredAt: "2025-01-06T10:30:00.000Z",
    });
    const duplicate = makeAlert({
      id: "scan-2",
      symbol: "INFY",
      alertType: "scan",
      triggeredAt: "2025-01-06T14:30:00.000Z",
    });

    expect(await addAlert(first)).toBe(true);
    expect(await addAlert(duplicate)).toBe(false);
    expect(await getAlerts()).toHaveLength(1);
  });

  test("allows same symbol on the same day when alert type differs", async () => {
    // Contract: dedupe dimension includes alertType, so distinct signal classes are preserved.
    const scanAlert = makeAlert({
      id: "scan-1",
      symbol: "RELIANCE",
      alertType: "scan",
      triggeredAt: "2025-01-06T10:30:00.000Z",
    });
    const breakoutAlert = makeAlert({
      id: "breakout-1",
      symbol: "RELIANCE",
      alertType: "breakout",
      triggeredAt: "2025-01-06T11:00:00.000Z",
    });

    expect(await addAlert(scanAlert)).toBe(true);
    expect(await addAlert(breakoutAlert)).toBe(true);
    expect(await getAlerts()).toHaveLength(2);
  });
});
