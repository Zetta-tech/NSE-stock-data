import "server-only";
import { getRedis } from "./redis";
import { logger } from "./logger";

/* ── Types ──────────────────────────────────────────────────────────── */

export interface ApiCallRecord {
  ts: number; // epoch ms
  type: "api" | "cache";
  method: string; // e.g. "getHistoricalData", "getCurrentDayData"
  symbol?: string;
}

export interface PersistedApiStats {
  apiCalls: number;
  cacheHits: number;
  lastFlushed: string | null;
  methodBreakdown: Record<string, { api: number; cache: number }>;
}

/* ── In-memory rolling log (per-instance, real-time view) ──────────── */

const API_CALL_LOG: ApiCallRecord[] = [];
const MAX_CALL_LOG = 500;

/* ── Pending counters (accumulated between Redis flushes) ──────────── */

let pendingApiCalls = 0;
let pendingCacheHits = 0;
const pendingMethodApi = new Map<string, number>();
const pendingMethodCache = new Map<string, number>();

/* ── In-memory cumulative fallback (local dev, no Redis) ───────────── */

let memCumulativeApiCalls = 0;
let memCumulativeCacheHits = 0;
const memMethodApi = new Map<string, number>();
const memMethodCache = new Map<string, number>();
let memLastFlushed: string | null = null;

/* ── Constants ─────────────────────────────────────────────────────── */

const API_STATS_KEY = "nse:api-stats";

/* ── Record (synchronous — zero latency impact) ───────────────────── */

export function recordCall(
  type: "api" | "cache",
  method: string,
  symbol?: string,
): void {
  API_CALL_LOG.push({ ts: Date.now(), type, method, symbol });
  if (API_CALL_LOG.length > MAX_CALL_LOG)
    API_CALL_LOG.splice(0, API_CALL_LOG.length - MAX_CALL_LOG);

  if (type === "api") {
    pendingApiCalls++;
    pendingMethodApi.set(method, (pendingMethodApi.get(method) ?? 0) + 1);
  } else {
    pendingCacheHits++;
    pendingMethodCache.set(method, (pendingMethodCache.get(method) ?? 0) + 1);
  }
}

/* ── Instance-level stats (same shape as before) ──────────────────── */

export function getApiStats(): {
  total: number;
  apiCalls: number;
  cacheHits: number;
  recentRate: number;
  last60s: ApiCallRecord[];
} {
  const now = Date.now();
  const cutoff = now - 60_000;
  const recent = API_CALL_LOG.filter((r) => r.ts >= cutoff);
  const recentApi = recent.filter((r) => r.type === "api");
  const allApi = API_CALL_LOG.filter((r) => r.type === "api");
  const allCache = API_CALL_LOG.filter((r) => r.type === "cache");
  return {
    total: API_CALL_LOG.length,
    apiCalls: allApi.length,
    cacheHits: allCache.length,
    recentRate:
      recentApi.length > 0
        ? parseFloat((recentApi.length / 60).toFixed(2))
        : 0,
    last60s: recent,
  };
}

/* ── Flush pending deltas to Redis ─────────────────────────────────── */

export async function flushStats(): Promise<void> {
  const apiDelta = pendingApiCalls;
  const cacheDelta = pendingCacheHits;
  const methodApiSnap = new Map(pendingMethodApi);
  const methodCacheSnap = new Map(pendingMethodCache);

  if (apiDelta === 0 && cacheDelta === 0) return;

  // Reset immediately so calls during async flush aren't lost
  pendingApiCalls = 0;
  pendingCacheHits = 0;
  pendingMethodApi.clear();
  pendingMethodCache.clear();

  const r = getRedis();
  const now = new Date().toISOString();

  if (r) {
    try {
      const p = r.pipeline();
      p.hincrby(API_STATS_KEY, "apiCalls", apiDelta);
      p.hincrby(API_STATS_KEY, "cacheHits", cacheDelta);
      Array.from(methodApiSnap.entries()).forEach(([method, count]) => {
        p.hincrby(API_STATS_KEY, `method:api:${method}`, count);
      });
      Array.from(methodCacheSnap.entries()).forEach(([method, count]) => {
        p.hincrby(API_STATS_KEY, `method:cache:${method}`, count);
      });
      p.hset(API_STATS_KEY, { lastFlushed: now });
      await p.exec();
    } catch {
      // Restore pending counters so they retry on next flush
      pendingApiCalls += apiDelta;
      pendingCacheHits += cacheDelta;
      Array.from(methodApiSnap.entries()).forEach(([method, count]) => {
        pendingMethodApi.set(
          method,
          (pendingMethodApi.get(method) ?? 0) + count,
        );
      });
      Array.from(methodCacheSnap.entries()).forEach(([method, count]) => {
        pendingMethodCache.set(
          method,
          (pendingMethodCache.get(method) ?? 0) + count,
        );
      });
      logger.warn("Failed to flush API stats to Redis", {}, "api-stats");
    }
  } else {
    // In-memory fallback (local dev)
    memCumulativeApiCalls += apiDelta;
    memCumulativeCacheHits += cacheDelta;
    Array.from(methodApiSnap.entries()).forEach(([method, count]) => {
      memMethodApi.set(method, (memMethodApi.get(method) ?? 0) + count);
    });
    Array.from(methodCacheSnap.entries()).forEach(([method, count]) => {
      memMethodCache.set(method, (memMethodCache.get(method) ?? 0) + count);
    });
    memLastFlushed = now;
  }
}

/* ── Read cumulative stats from Redis ──────────────────────────────── */

export async function getPersistedStats(): Promise<PersistedApiStats> {
  const r = getRedis();

  if (r) {
    try {
      const data = await r.hgetall<Record<string, string>>(API_STATS_KEY);
      if (!data) {
        return {
          apiCalls: 0,
          cacheHits: 0,
          lastFlushed: null,
          methodBreakdown: {},
        };
      }

      const methodBreakdown: Record<string, { api: number; cache: number }> =
        {};
      for (const [key, val] of Object.entries(data)) {
        const apiMatch = key.match(/^method:api:(.+)$/);
        if (apiMatch) {
          const m = apiMatch[1];
          if (!methodBreakdown[m]) methodBreakdown[m] = { api: 0, cache: 0 };
          methodBreakdown[m].api = parseInt(String(val), 10);
        }
        const cacheMatch = key.match(/^method:cache:(.+)$/);
        if (cacheMatch) {
          const m = cacheMatch[1];
          if (!methodBreakdown[m]) methodBreakdown[m] = { api: 0, cache: 0 };
          methodBreakdown[m].cache = parseInt(String(val), 10);
        }
      }

      return {
        apiCalls: parseInt(String(data.apiCalls ?? "0"), 10),
        cacheHits: parseInt(String(data.cacheHits ?? "0"), 10),
        lastFlushed: (data.lastFlushed as string) ?? null,
        methodBreakdown,
      };
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const methodBreakdown: Record<string, { api: number; cache: number }> = {};
  Array.from(memMethodApi.entries()).forEach(([method, count]) => {
    if (!methodBreakdown[method])
      methodBreakdown[method] = { api: 0, cache: 0 };
    methodBreakdown[method].api = count;
  });
  Array.from(memMethodCache.entries()).forEach(([method, count]) => {
    if (!methodBreakdown[method])
      methodBreakdown[method] = { api: 0, cache: 0 };
    methodBreakdown[method].cache = count;
  });

  return {
    apiCalls: memCumulativeApiCalls,
    cacheHits: memCumulativeCacheHits,
    lastFlushed: memLastFlushed,
    methodBreakdown,
  };
}
