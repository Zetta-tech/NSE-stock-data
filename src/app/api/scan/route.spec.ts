import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ScanResult, Alert } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  scanMultipleStocks: vi.fn(),
  getWatchlist: vi.fn(),
  getCloseWatchStocks: vi.fn(),
  addAlert: vi.fn(),
  getAlerts: vi.fn(),
  saveScanResults: vi.fn(),
  getScanResults: vi.fn(),
  acquireScanLock: vi.fn(),
  releaseScanLock: vi.fn(),
  getScanLockTTL: vi.fn(),
  getMarketStatus: vi.fn(),
  getHistoricalCacheStats: vi.fn(),
  addActivity: vi.fn(),
  setScanMeta: vi.fn(),
  checkMa200Touch: vi.fn(),
  checkMa100Touch: vi.fn(),
  checkMa50Touch: vi.fn(),
  checkMa5Touch: vi.fn(),
}));

vi.mock("@/lib/scanner", () => ({
  scanMultipleStocks: mocks.scanMultipleStocks,
}));

vi.mock("@/lib/store", () => ({
  getWatchlist: mocks.getWatchlist,
  getCloseWatchStocks: mocks.getCloseWatchStocks,
  addAlert: mocks.addAlert,
  getAlerts: mocks.getAlerts,
  saveScanResults: mocks.saveScanResults,
  getScanResults: mocks.getScanResults,
  acquireScanLock: mocks.acquireScanLock,
  releaseScanLock: mocks.releaseScanLock,
  getScanLockTTL: mocks.getScanLockTTL,
}));

vi.mock("@/lib/nse-client", () => ({
  getMarketStatus: mocks.getMarketStatus,
  getHistoricalCacheStats: mocks.getHistoricalCacheStats,
}));

vi.mock("@/lib/activity", () => ({
  addActivity: mocks.addActivity,
  setScanMeta: mocks.setScanMeta,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    api: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock("@/lib/ma200-alert", () => ({ checkMa200Touch: mocks.checkMa200Touch }));
vi.mock("@/lib/ma100-alert", () => ({ checkMa100Touch: mocks.checkMa100Touch }));
vi.mock("@/lib/ma50-alert", () => ({ checkMa50Touch: mocks.checkMa50Touch }));
vi.mock("@/lib/ma5-alert", () => ({ checkMa5Touch: mocks.checkMa5Touch }));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown> = {}): Request {
  return new Request("http://localhost:3000/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    symbol: "INFY",
    name: "Infosys",
    triggered: false,
    todayHigh: 1510,
    todayVolume: 1200000,
    prevMaxHigh: 1490,
    prevMaxVolume: 1000000,
    highBreakPercent: 1.34,
    volumeBreakPercent: 20,
    todayClose: 1505,
    todayChange: 1.2,
    scannedAt: "2025-01-06T10:30:00.000Z",
    dataSource: "live",
    ...overrides,
  };
}

describe("Scan route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWatchlist.mockResolvedValue([{ symbol: "INFY", name: "Infosys", closeWatch: false }]);
    mocks.getCloseWatchStocks.mockResolvedValue([]);
    mocks.getAlerts.mockResolvedValue([]);
    mocks.getScanResults.mockResolvedValue([]);
    mocks.addAlert.mockResolvedValue(false);
    mocks.saveScanResults.mockResolvedValue(undefined);
    mocks.addActivity.mockResolvedValue(undefined);
    mocks.setScanMeta.mockResolvedValue(undefined);
    mocks.releaseScanLock.mockResolvedValue(undefined);
    mocks.getMarketStatus.mockResolvedValue(true);
    mocks.getHistoricalCacheStats.mockReturnValue({ size: 0, symbols: [], date: "" });
    mocks.checkMa200Touch.mockResolvedValue(null);
    mocks.checkMa100Touch.mockResolvedValue(null);
    mocks.checkMa50Touch.mockResolvedValue(null);
    mocks.checkMa5Touch.mockResolvedValue(null);
  });

  describe("Distributed debounce lock", () => {
    test("returns cached results with lockHeld when lock is not acquired", async () => {
      mocks.acquireScanLock.mockResolvedValue(false);
      mocks.getScanLockTTL.mockResolvedValue(22);
      const cachedResults = [makeScanResult()];
      const cachedAlerts: Alert[] = [];
      mocks.getScanResults.mockResolvedValue(cachedResults);
      mocks.getAlerts.mockResolvedValue(cachedAlerts);

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(json.lockHeld).toBe(true);
      expect(json.cached).toBe(true);
      expect(json.lockExpiresIn).toBe(22);
      expect(json.results).toHaveLength(1);
      expect(mocks.scanMultipleStocks).not.toHaveBeenCalled();
    });

    test("runs full scan when lock is acquired", async () => {
      mocks.acquireScanLock.mockResolvedValue(true);
      mocks.scanMultipleStocks.mockResolvedValue([makeScanResult()]);

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(json.lockHeld).toBeUndefined();
      expect(json.cached).toBeUndefined();
      expect(json.results).toHaveLength(1);
      expect(mocks.scanMultipleStocks).toHaveBeenCalledTimes(1);
      expect(mocks.releaseScanLock).toHaveBeenCalledWith("manual");
    });

    test("releases lock on error", async () => {
      mocks.acquireScanLock.mockResolvedValue(true);
      mocks.scanMultipleStocks.mockRejectedValue(new Error("boom"));

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("boom");
      expect(mocks.releaseScanLock).toHaveBeenCalledWith("manual");
      expect(mocks.releaseScanLock).toHaveBeenCalledWith("auto");
    });
  });

  describe("Backpressure (nextPollMs)", () => {
    test("returns 30s when all stocks are live and scan is fast", async () => {
      mocks.acquireScanLock.mockResolvedValue(true);
      mocks.scanMultipleStocks.mockResolvedValue([
        makeScanResult({ dataSource: "live" }),
      ]);

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(json.nextPollMs).toBe(30_000);
    });

    test("returns 60s when some stocks are stale", async () => {
      mocks.acquireScanLock.mockResolvedValue(true);
      mocks.scanMultipleStocks.mockResolvedValue([
        makeScanResult({ symbol: "INFY", dataSource: "live" }),
        makeScanResult({ symbol: "TCS", dataSource: "live" }),
        makeScanResult({ symbol: "SBIN", dataSource: "stale" }),
      ]);

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(json.nextPollMs).toBe(60_000);
    });

    test("returns 120s when majority of stocks are stale", async () => {
      mocks.acquireScanLock.mockResolvedValue(true);
      mocks.scanMultipleStocks.mockResolvedValue([
        makeScanResult({ symbol: "INFY", dataSource: "stale" }),
        makeScanResult({ symbol: "TCS", dataSource: "stale" }),
        makeScanResult({ symbol: "SBIN", dataSource: "live" }),
      ]);

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(json.nextPollMs).toBe(120_000);
    });

    test("returns 180s on scan error", async () => {
      mocks.acquireScanLock.mockResolvedValue(true);
      mocks.scanMultipleStocks.mockRejectedValue(new Error("timeout"));

      const res = await POST(makeRequest());
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.nextPollMs).toBe(180_000);
    });
  });

  describe("Scan type routing", () => {
    test("uses manual lock for regular scans", async () => {
      mocks.acquireScanLock.mockResolvedValue(true);
      mocks.scanMultipleStocks.mockResolvedValue([]);

      await POST(makeRequest({ intraday: true }));

      expect(mocks.acquireScanLock).toHaveBeenCalledWith("manual");
      expect(mocks.getWatchlist).toHaveBeenCalled();
    });

    test("uses auto lock for closeWatchOnly scans", async () => {
      mocks.acquireScanLock.mockResolvedValue(true);
      mocks.scanMultipleStocks.mockResolvedValue([]);
      mocks.getCloseWatchStocks.mockResolvedValue([]);

      await POST(makeRequest({ closeWatchOnly: true }));

      expect(mocks.acquireScanLock).toHaveBeenCalledWith("auto");
      expect(mocks.getCloseWatchStocks).toHaveBeenCalled();
    });
  });
});
