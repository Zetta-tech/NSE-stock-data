import { beforeEach, describe, expect, test, vi } from "vitest";

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
    del: async (key: string) => {
      redisMap.delete(key);
      return 1;
    },
    ttl: async (key: string) => {
      return redisMap.has(key) ? 25 : -2;
    },
  }),
}));

import { acquireScanLock, releaseScanLock, getScanLockTTL } from "./store";

describe("Distributed Scan Lock", () => {
  beforeEach(() => {
    redisMap.clear();
  });

  test("acquires lock on first call and blocks second call", async () => {
    expect(await acquireScanLock("manual")).toBe(true);
    expect(await acquireScanLock("manual")).toBe(false);
  });

  test("manual and auto locks are independent", async () => {
    expect(await acquireScanLock("manual")).toBe(true);
    expect(await acquireScanLock("auto")).toBe(true);
  });

  test("releasing lock allows re-acquisition", async () => {
    expect(await acquireScanLock("manual")).toBe(true);
    expect(await acquireScanLock("manual")).toBe(false);

    await releaseScanLock("manual");
    expect(await acquireScanLock("manual")).toBe(true);
  });

  test("releasing auto does not release manual", async () => {
    expect(await acquireScanLock("manual")).toBe(true);
    expect(await acquireScanLock("auto")).toBe(true);

    await releaseScanLock("auto");
    expect(await acquireScanLock("auto")).toBe(true);
    expect(await acquireScanLock("manual")).toBe(false);
  });

  test("getScanLockTTL returns positive value when lock is held", async () => {
    await acquireScanLock("manual");
    const ttl = await getScanLockTTL("manual");
    expect(ttl).toBeGreaterThan(0);
  });

  test("getScanLockTTL returns 0 when no lock is held", async () => {
    const ttl = await getScanLockTTL("manual");
    expect(ttl).toBe(0);
  });
});
