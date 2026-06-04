import { beforeEach, describe, expect, test, vi } from "vitest";

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

import { getNifty50PersistentStats } from "./store";

describe("Nifty 50 persistent stats", () => {
  beforeEach(() => {
    redisMap.clear();
  });

  test("merges defaults into older Redis stats that do not have snapshot source", async () => {
    redisMap.set("nse:nifty50Stats", {
      lastRefreshTime: "2026-06-03T10:00:00.000Z",
      snapshotFetchSuccess: true,
      snapshotFetchCount: 4,
      snapshotFailCount: 1,
    });

    await expect(getNifty50PersistentStats()).resolves.toEqual({
      lastRefreshTime: "2026-06-03T10:00:00.000Z",
      snapshotFetchSuccess: true,
      snapshotFetchCount: 4,
      snapshotFailCount: 1,
      snapshotSource: "unavailable",
    });
  });
});
