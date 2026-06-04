import { logger } from "./logger";
import { randomUUID } from "node:crypto";
import { NseIndia } from "stock-nse-india";
import { isExtendedHours } from "./market-hours";
import { NIFTY_50_STOCKS } from "./nifty50";
import type { DayData, NiftyIndex, Nifty50StockRow, Nifty50Snapshot } from "./types";
import { recordCall, getApiStats } from "./api-stats";
import { getRedis } from "./redis";

export { getApiStats };

/* ── Holiday Calendar ───────────────────────────────────────────────── */

let holidaySet: Set<string> | null = null;
let holidayLoadedForDate: string | null = null;

function todayIST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )
    .toISOString()
    .slice(0, 10);
}

function parseHolidayDate(tradingDate: string): string | null {
  const d = new Date(tradingDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function loadHolidayCalendar(): Promise<Set<string>> {
  const today = todayIST();
  if (holidaySet && holidayLoadedForDate === today) return holidaySet;

  const year = today.slice(0, 4);
  const redisKey = `nse:holidays:${year}`;
  const r = getRedis();

  if (r) {
    try {
      const cached = await r.get<string[]>(redisKey);
      if (cached && Array.isArray(cached)) {
        holidaySet = new Set(cached);
        holidayLoadedForDate = today;
        return holidaySet;
      }
    } catch {
      // fall through to API fetch
    }
  }

  try {
    const holidays = await withRetry(
      () => getNse().getTradingHolidays(),
      "getTradingHolidays",
    );
    const dates: string[] = [];
    for (const segment of Object.keys(holidays)) {
      const list = holidays[segment];
      if (!Array.isArray(list)) continue;
      for (const h of list) {
        const iso = parseHolidayDate(h.tradingDate);
        if (iso) dates.push(iso);
      }
    }
    const unique = Array.from(new Set(dates));
    holidaySet = new Set(unique);
    holidayLoadedForDate = today;

    if (r) {
      try {
        await r.set(redisKey, unique, { ex: 86400 });
      } catch {
        // non-critical — will retry next cold start
      }
    }

    logger.info(
      `Holiday calendar loaded: ${unique.length} dates for ${year}`,
      { count: unique.length },
      "Holiday Calendar",
    );

    return holidaySet;
  } catch {
    logger.warn(
      "Failed to fetch holiday calendar — skipping holiday check",
      {},
      "Holiday Calendar",
    );
    holidaySet = new Set();
    holidayLoadedForDate = today;
    return holidaySet;
  }
}

export async function isHolidayToday(): Promise<boolean> {
  const holidays = await loadHolidayCalendar();
  return holidays.has(todayIST());
}

/* Singleton per Lambda invocation.  On Vercel each cold start creates a
 * fresh instance (new cookies, empty cache).  Warm invocations reuse
 * the existing instance, which is ideal for NseIndia's session handling. */
let nseInstance: NseIndia | null = null;

function getNse(): NseIndia {
  if (!nseInstance) {
    nseInstance = new NseIndia();
  }
  return nseInstance;
}

/** Reset the singleton so the next getNse() creates a fresh instance
 *  with new cookies / session.  Call this when API calls fail. */
function resetNse(): void {
  nseInstance = null;
}

/** Run an async operation against the NSE client.  If the first attempt
 *  fails, reset the singleton (stale cookies) and retry once. */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (firstError) {
    logger.warn(
      `${label}: first attempt failed, resetting NSE session and retrying`,
      { error: firstError instanceof Error ? firstError.message : String(firstError) },
      "NSE Data Service",
    );
    resetNse();
    return await fn();
  }
}

/* ── Historical-data cache ────────────────────────────────────────────
 * Key:   stock symbol (e.g. "INFY")
 * Value: { date: "YYYY-MM-DD", days: requested lookback, data: DayData[] }
 *
 * A cached entry is valid when:
 *   1. The calendar date (IST) hasn't changed since the entry was stored
 *   2. The requested `days` parameter matches (different scans could ask
 *      for different lookback windows)
 *
 * This avoids redundant NSE API calls when the same symbol is scanned
 * multiple times in a single day (e.g. a 50-symbol watchlist scanned
 * several times).
 */
interface HistoricalCacheEntry {
  date: string;
  days: number;
  data: DayData[];
}

/* Per-invocation cache — reduces redundant NSE calls within a single
 * request or warm Lambda.  Resets on cold start, which is acceptable. */
const historicalCache = new Map<string, HistoricalCacheEntry>();

function todayDateString(): string {
  // Use IST (UTC+5:30) so the cache rolls over at Indian midnight,
  // matching NSE's trading-day boundary.
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )
    .toISOString()
    .slice(0, 10);
}

export function getHistoricalCacheStats(): {
  size: number;
  symbols: string[];
  date: string;
} {
  const today = todayDateString();
  const validEntries: [string, HistoricalCacheEntry][] = [];
  historicalCache.forEach((v, k) => {
    if (v.date === today) validEntries.push([k, v]);
  });
  return {
    size: validEntries.length,
    symbols: validEntries.map(([k]) => k),
    date: today,
  };
}

export async function getHistoricalData(
  symbol: string,
  days: number = 10
): Promise<DayData[]> {
  const today = todayDateString();
  const cached = historicalCache.get(symbol);

  if (cached && cached.date === today && cached.days === days) {
    recordCall("cache", "getHistoricalData", symbol);
    logger.debug(
      `Cache hit: ${symbol} (${days} days)`,
      { type: 'CACHE_HIT', symbol },
      'NSE Data Service',
      `No network call needed — we already have today's price history for ${symbol}. The cached data covers the last ${days} trading days and is still valid because the date hasn't changed.`,
    );
    return cached.data;
  }

  recordCall("api", "getHistoricalData", symbol);
  logger.api(
    `Fetching historical data: ${symbol} (${days} days)`,
    { symbol, days },
    'NSE Data Service',
    `Calling the NSE India API to download the last ${days} trading days of price & volume data for ${symbol}. This data is needed to check whether today's numbers are unusually high compared to recent history.`,
  );

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days * 2);

  const raw = await withRetry(
    () => getNse().getEquityHistoricalData(symbol, { start, end }),
    `getHistoricalData(${symbol})`,
  );
  logger.debug(
    `API response received: ${symbol} — ${raw.length} record(s)`,
    { rawCount: raw.length },
    'NSE Data Service',
    `The NSE API responded successfully for ${symbol}. We received ${raw.length} raw data chunk(s) which will be sorted by date before analysis.`,
  );

  const records = raw.flatMap((entry) => entry.data);

  const data = records
    .map((r) => ({
      date: r.mtimestamp,
      high: r.chTradeHighPrice,
      low: r.chTradeLowPrice,
      open: r.chOpeningPrice,
      close: r.chClosingPrice,
      volume: r.chTotTradedQty,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  historicalCache.set(symbol, { date: today, days, data });

  return data;
}

export async function getCurrentDayData(
  symbol: string
): Promise<{ high: number; volume: number; close: number; change: number; yearHigh: number } | null> {
  recordCall("api", "getCurrentDayData", symbol);

  try {
    const result = await withRetry(async () => {
      const nse = getNse();
      const [details, tradeInfo] = await Promise.all([
        nse.getEquityDetails(symbol),
        nse.getEquityTradeInfo(symbol),
      ]);

      const high = details.priceInfo.intraDayHighLow.max;
      const close = details.priceInfo.lastPrice || details.priceInfo.close;
      const change = details.priceInfo.pChange;
      const volume =
        tradeInfo.marketDeptOrderBook.tradeInfo.totalTradedVolume;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yearHigh = (details.priceInfo as any).weekHighLow?.max ?? 0;

      return { high, volume, close, change, yearHigh };
    }, `getCurrentDayData(${symbol})`);

    logger.debug(
      `Live data received: ${symbol} — ₹${result.close} (${result.change >= 0 ? '+' : ''}${result.change.toFixed(2)}%)`,
      { high: result.high, volume: result.volume, close: result.close, change: result.change },
      'NSE Data Service',
      `Successfully fetched real-time intraday data for ${symbol}. Current price is ₹${result.close} with a ${result.change >= 0 ? 'gain' : 'loss'} of ${Math.abs(result.change).toFixed(2)}% today. Today's high so far is ₹${result.high} on volume of ${result.volume.toLocaleString()} shares.`,
    );
    return result;
  } catch (error) {
    logger.error(
      `Live data fetch failed: ${symbol}`,
      { error },
      'NSE Data Service',
      `Could not retrieve real-time price data for ${symbol} from the NSE. The scanner will fall back to the most recent end-of-day closing data instead. This often happens outside of market hours (9:15 AM – 3:30 PM IST).`,
    );
    return null;
  }
}

let lastMarketStatus: { open: boolean; checkedAt: number } | null = null;
const MARKET_STATUS_TTL = 60_000; // 1 minute

export async function getMarketStatus(): Promise<boolean> {
  if (!isExtendedHours() || await isHolidayToday()) {
    recordCall("cache", "getMarketStatus");
    return false;
  }

  // Within extended hours, reuse recent result if fresh
  if (lastMarketStatus && Date.now() - lastMarketStatus.checkedAt < MARKET_STATUS_TTL) {
    recordCall("cache", "getMarketStatus");
    return lastMarketStatus.open;
  }

  recordCall("api", "getMarketStatus");
  try {
    const status = await withRetry(
      () => getNse().getMarketStatus(),
      "getMarketStatus",
    );
    const open = status.marketState.some(
      (s) =>
        s.market === "Capital Market" &&
        s.marketStatus.toLowerCase().includes("open")
    );
    lastMarketStatus = { open, checkedAt: Date.now() };
    return open;
  } catch (error) {
    logger.error(
      `Market status check failed`,
      { error },
      'NSE Data Service',
      `Unable to determine whether the Indian stock market is currently open. The system will assume the market is closed and use end-of-day data. This is usually caused by an NSE website timeout.`,
    );
    return lastMarketStatus?.open ?? false;
  }
}

/* ── Nifty 50 Index ───────────────────────────────────────────────────── */

let indexCache: { data: NiftyIndex; fetchedAt: number } | null = null;
const INDEX_CACHE_TTL = 15_000; // 15 seconds

export async function getNifty50Index(): Promise<NiftyIndex | null> {
  // Return cached if fresh
  if (indexCache && Date.now() - indexCache.fetchedAt < INDEX_CACHE_TTL) {
    recordCall("cache", "getNifty50Index");
    return indexCache.data;
  }

  if (!isExtendedHours() || await isHolidayToday()) {
    if (indexCache) {
      recordCall("cache", "getNifty50Index");
      return indexCache.data;
    }
  }

  recordCall("api", "getNifty50Index");
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await withRetry(
      () => getNse().getEquityStockIndices("NIFTY 50"),
      "getNifty50Index",
    );
    const meta = raw?.metadata;
    if (!meta) {
      logger.warn("Nifty 50 index response missing metadata", { keys: raw ? Object.keys(raw) : null }, "NSE Data Service");
      return null;
    }

    const result: NiftyIndex = {
      value: meta.last ?? meta.close ?? 0,
      change: meta.change ?? 0,
      changePercent: meta.percChange ?? 0,
      open: meta.open ?? 0,
      high: meta.high ?? 0,
      low: meta.low ?? 0,
      previousClose: meta.previousClose ?? 0,
      fetchedAt: new Date().toISOString(),
    };

    indexCache = { data: result, fetchedAt: Date.now() };
    logger.debug(
      `Nifty 50 index: ${result.value} (${result.change >= 0 ? "+" : ""}${result.changePercent.toFixed(2)}%)`,
      { value: result.value, change: result.change },
      "NSE Data Service",
    );
    return result;
  } catch (error) {
    logger.error(
      "Failed to fetch Nifty 50 index",
      { error },
      "NSE Data Service",
      "Could not retrieve the Nifty 50 index value from NSE. This is typically a temporary network issue.",
    );
    return indexCache?.data ?? null; // return stale if available
  }
}

export interface NseSearchResult {
  symbol: string;
  name: string;
}

export async function searchStocks(
  query: string
): Promise<NseSearchResult[]> {
  recordCall("api", "searchStocks");
  try {
    logger.api(
      `Searching NSE for "${query}"`,
      { query },
      'NSE Data Service',
      `Looking up stock symbols on the NSE that match the search term "${query}". Results are filtered to only show equities (no derivatives or indices).`,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await withRetry(
      () => getNse().getDataByEndpoint(
        `/api/search/autocomplete?q=${encodeURIComponent(query)}`
      ),
      `searchStocks(${query})`,
    );

    if (!data || !Array.isArray(data.symbols)) {
      logger.warn(
        `NSE search returned unexpected data format`,
        { query, keys: data ? Object.keys(data) : null },
        'NSE Data Service',
        `The NSE search API responded, but the data format was different from what we expected. This might mean NSE changed their API. No results will be shown for this search.`,
      );
      return [];
    }

    // Filter to equity results and map to our shape
    const results: NseSearchResult[] = data.symbols
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => {
        const type = (item.result_type || item.type || "").toLowerCase();
        // Accept equity results; exclude derivatives, indices, etc.
        return type === "stock" || type === "equity" || type === "symbol";
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ({
        symbol: (item.symbol || "").toUpperCase().trim(),
        name: item.symbol_info || item.company_name || item.name || item.symbol || "",
      }))
      .filter((r: NseSearchResult) => r.symbol.length > 0);

    logger.info(
      `Search "${query}" → ${results.length} result(s)`,
      { query, resultCount: results.length },
      'NSE Data Service',
      `Found ${results.length} stock(s) matching "${query}" on the National Stock Exchange. ${results.length === 0 ? 'Try a different keyword or check the spelling.' : `Top match: ${results[0].name} (${results[0].symbol}).`}`,
    );
    return results;
  } catch (error) {
    logger.error(
      `NSE search failed for "${query}"`,
      { query, error },
      'NSE Data Service',
      `The search request to NSE for "${query}" couldn't be completed. This is typically a temporary network issue with NSE's servers. Try again in a few seconds.`,
    );
    return [];
  }
}

/* ── Nifty 50 Stock Snapshot (for table view) ────────────────────────
 * Uses getEquityStockIndices("NIFTY 50") to fetch all 50 constituent
 * stocks in a single API call — much cheaper than 50 individual calls.
 *
 * Cache strategy:
 *   - During market hours: 3-minute TTL (target refresh interval)
 *   - After hours: serve bounded last-known data as stale (no polling)
 *   - On fetch failure: return stale data with stale=true flag
 * ──────────────────────────────────────────────────────────────────── */

let snapshotCache: { data: Nifty50Snapshot; fetchedAt: number } | null = null;
const SNAPSHOT_CACHE_TTL = 3 * 60_000; // 3 minutes
const SNAPSHOT_SHARED_CACHE_KEY = "nse:nifty50Snapshot";
const SNAPSHOT_SHARED_LAST_GOOD_KEY = "nse:nifty50Snapshot:lastGood";
const SNAPSHOT_SHARED_LOCK_KEY = "nse:nifty50Snapshot:refreshing";
const SNAPSHOT_SHARED_CACHE_TTL_SECONDS = 15 * 60;
const SNAPSHOT_SHARED_LAST_GOOD_TTL_SECONDS = 5 * 24 * 60 * 60;
const SNAPSHOT_SHARED_LAST_GOOD_MAX_AGE_MS =
  SNAPSHOT_SHARED_LAST_GOOD_TTL_SECONDS * 1000;
const SNAPSHOT_SHARED_LOCK_TTL_SECONDS = 60;
const SNAPSHOT_SHARED_LOCK_WAIT_MS = 45_000;
const SNAPSHOT_SHARED_STALE_LOCK_WAIT_MS = 3_000;
const SNAPSHOT_SHARED_LOCK_POLL_MS = 750;
const SNAPSHOT_SHARED_LOCK_RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`.trim();

// Tracking stats for dev panel
let snapshotFetchCount = 0;
let snapshotFailCount = 0;
const NIFTY50_CHART_FALLBACK_BATCH_SIZE = 10;
const NIFTY50_CHART_FALLBACK_MIN_ROWS = 40;
const NIFTY50_CHART_FALLBACK_CALL_TIMEOUT_MS = 8_000;

export function getNifty50SnapshotStats() {
  return {
    lastRefreshTime: snapshotCache?.data.fetchedAt ?? null,
    snapshotFetchSuccess: snapshotCache?.data.fetchSuccess ?? false,
    snapshotSource: snapshotCache?.data.source ?? "unavailable",
    snapshotFetchCount,
    snapshotFailCount,
  };
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSnapshotAgeMs(snapshot: Nifty50Snapshot): number {
  const fetchedAt = new Date(snapshot.fetchedAt).getTime();
  return Number.isFinite(fetchedAt) ? Date.now() - fetchedAt : Number.POSITIVE_INFINITY;
}

function isSnapshotFresh(snapshot: Nifty50Snapshot): boolean {
  return getSnapshotAgeMs(snapshot) < SNAPSHOT_CACHE_TTL;
}

function isSuccessfulSnapshot(snapshot: Nifty50Snapshot): boolean {
  return snapshot.fetchSuccess && !snapshot.stale && snapshot.stocks.length > 0;
}

function isFreshSuccessfulSnapshot(snapshot: Nifty50Snapshot): boolean {
  return isSuccessfulSnapshot(snapshot) && isSnapshotFresh(snapshot);
}

function isUsableLastGoodSnapshot(snapshot: Nifty50Snapshot): boolean {
  return (
    isSuccessfulSnapshot(snapshot)
    && getSnapshotAgeMs(snapshot) < SNAPSHOT_SHARED_LAST_GOOD_MAX_AGE_MS
  );
}

function markSnapshotUnavailable(snapshot: Nifty50Snapshot): Nifty50Snapshot {
  return { ...snapshot, stale: true, fetchSuccess: false };
}

async function readSharedNifty50Snapshot(
  key = SNAPSHOT_SHARED_CACHE_KEY,
): Promise<Nifty50Snapshot | null> {
  const r = getRedis();
  if (!r) return null;

  try {
    const snapshot = await r.get<Nifty50Snapshot>(key);
    if (!snapshot?.fetchedAt || !Array.isArray(snapshot.stocks)) return null;
    return snapshot;
  } catch (error) {
    logger.warn(
      "Nifty 50 shared snapshot cache read failed",
      { error, key },
      "Nifty50 Snapshot",
    );
    return null;
  }
}

async function writeSharedNifty50Snapshot(snapshot: Nifty50Snapshot): Promise<void> {
  const r = getRedis();
  if (!r) return;
  if (!isSuccessfulSnapshot(snapshot)) return;

  try {
    await Promise.all([
      r.set(SNAPSHOT_SHARED_CACHE_KEY, snapshot, { ex: SNAPSHOT_SHARED_CACHE_TTL_SECONDS }),
      r.set(SNAPSHOT_SHARED_LAST_GOOD_KEY, snapshot, { ex: SNAPSHOT_SHARED_LAST_GOOD_TTL_SECONDS }),
    ]);
  } catch (error) {
    logger.warn(
      "Nifty 50 shared snapshot cache write failed",
      { error },
      "Nifty50 Snapshot",
    );
  }
}

async function readSharedLastGoodNifty50Snapshot(): Promise<Nifty50Snapshot | null> {
  const lastGood = await readSharedNifty50Snapshot(SNAPSHOT_SHARED_LAST_GOOD_KEY);
  return lastGood && isUsableLastGoodSnapshot(lastGood) ? lastGood : null;
}

async function waitForSharedNifty50Snapshot(timeoutMs: number): Promise<Nifty50Snapshot | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(Math.min(SNAPSHOT_SHARED_LOCK_POLL_MS, Math.max(0, deadline - Date.now())));
    const snapshot = await readSharedNifty50Snapshot();
    if (snapshot && isFreshSuccessfulSnapshot(snapshot)) {
      return snapshot;
    }
  }

  return null;
}

type SharedRefreshLock =
  | { status: "acquired"; token: string }
  | { status: "busy" | "unavailable"; token?: never };

async function acquireSharedNifty50RefreshLock(): Promise<SharedRefreshLock> {
  const r = getRedis();
  if (!r) return { status: "unavailable" };

  try {
    const token = randomUUID();
    const locked = await r.set(SNAPSHOT_SHARED_LOCK_KEY, token, {
      nx: true,
      ex: SNAPSHOT_SHARED_LOCK_TTL_SECONDS,
    });
    return locked === "OK" ? { status: "acquired", token } : { status: "busy" };
  } catch (error) {
    logger.warn(
      "Nifty 50 shared refresh lock failed; proceeding without shared lock",
      { error },
      "Nifty50 Snapshot",
    );
    return { status: "unavailable" };
  }
}

async function releaseSharedNifty50RefreshLock(token: string): Promise<void> {
  const r = getRedis();
  if (!r) return;

  try {
    const script = r.createScript<number>(SNAPSHOT_SHARED_LOCK_RELEASE_SCRIPT);
    await script.exec([SNAPSHOT_SHARED_LOCK_KEY], [token]);
  } catch (error) {
    logger.warn(
      "Nifty 50 shared refresh lock release failed",
      { error },
      "Nifty50 Snapshot",
    );
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

type ChartingCandle = {
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  volume?: unknown;
  time?: unknown;
};

async function getNifty50ChartFallbackRows(): Promise<Nifty50StockRow[]> {
  recordCall("api", "getNifty50ChartFallback");
  const rows: Nifty50StockRow[] = [];
  const failedSymbols: string[] = [];

  for (let i = 0; i < NIFTY_50_STOCKS.length; i += NIFTY50_CHART_FALLBACK_BATCH_SIZE) {
    const batch = NIFTY_50_STOCKS.slice(i, i + NIFTY50_CHART_FALLBACK_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (stock) => {
        const response = await withTimeout(
          getNse().getEquityChartHistoricalData(
            stock.symbol,
            undefined,
            undefined,
            "Equity",
            "I",
            "5",
          ),
          NIFTY50_CHART_FALLBACK_CALL_TIMEOUT_MS,
          `Nifty 50 charting fallback ${stock.symbol}`,
        );
        const candles = (Array.isArray(response?.data) ? response.data : [])
          .map((candle: ChartingCandle) => ({
            open: asNumber(candle.open),
            high: asNumber(candle.high),
            low: asNumber(candle.low),
            close: asNumber(candle.close),
            volume: asNumber(candle.volume),
            time: asNumber(candle.time),
          }))
          .filter((candle) => candle.close > 0)
          .sort((a, b) => a.time - b.time);

        if (candles.length === 0) {
          throw new Error(`No charting candles returned for ${stock.symbol}`);
        }

        const first = candles[0];
        const last = candles[candles.length - 1];
        const open = first.open > 0 ? first.open : first.close;
        const lastPrice = last.close;
        const change = lastPrice - open;
        const pChange = open > 0 ? (change / open) * 100 : 0;
        const dayHigh = Math.max(...candles.map((candle) => candle.high || candle.close));
        const dayLow = Math.min(...candles.map((candle) => candle.low || candle.close));
        const volume = candles.reduce((sum, candle) => sum + candle.volume, 0);

        return {
          symbol: stock.symbol,
          name: stock.name,
          lastPrice,
          change,
          pChange,
          open,
          dayHigh,
          dayLow,
          previousClose: open,
          totalTradedVolume: volume,
          totalTradedValue: volume * lastPrice,
          yearHigh: 0,
          yearLow: 0,
        } satisfies Nifty50StockRow;
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value.lastPrice > 0) {
        rows.push(result.value);
      } else if (result.status === "fulfilled") {
        failedSymbols.push(result.value.symbol);
      } else {
        failedSymbols.push(batch[j]?.symbol ?? "unknown");
      }
    }
  }

  if (failedSymbols.length > 0) {
    logger.warn(
      `Nifty 50 charting fallback missed ${failedSymbols.length} symbol(s)`,
      { failedSymbols },
      "Nifty50 Snapshot",
    );
  }

  return rows;
}

export async function getNifty50Snapshot(): Promise<Nifty50Snapshot> {
  // Return cached if fresh
  if (snapshotCache && Date.now() - snapshotCache.fetchedAt < SNAPSHOT_CACHE_TTL) {
    recordCall("cache", "getNifty50Snapshot");
    return snapshotCache.data;
  }

  const marketUnavailable = !isExtendedHours() || await isHolidayToday();
  if (marketUnavailable) {
    if (snapshotCache) {
      recordCall("cache", "getNifty50Snapshot");
      return snapshotCache.data;
    }
  }

  const sharedSnapshot = await readSharedNifty50Snapshot();
  const lastGoodSnapshot = sharedSnapshot && isUsableLastGoodSnapshot(sharedSnapshot)
    ? sharedSnapshot
    : await readSharedLastGoodNifty50Snapshot();

  if (sharedSnapshot && isFreshSuccessfulSnapshot(sharedSnapshot)) {
    recordCall("cache", "getNifty50Snapshot");
    snapshotCache = { data: sharedSnapshot, fetchedAt: Date.now() };
    return sharedSnapshot;
  }

  if (marketUnavailable && lastGoodSnapshot) {
    recordCall("cache", "getNifty50Snapshot");
    const staleLastGood = markSnapshotUnavailable(lastGoodSnapshot);
    snapshotCache = { data: staleLastGood, fetchedAt: Date.now() };
    return staleLastGood;
  }

  const sharedLock = await acquireSharedNifty50RefreshLock();
  if (sharedLock.status === "busy") {
    const staleFallback = lastGoodSnapshot
      ?? (sharedSnapshot?.stocks.length ? sharedSnapshot : null);
    const waitMs = staleFallback
      ? SNAPSHOT_SHARED_STALE_LOCK_WAIT_MS
      : SNAPSHOT_SHARED_LOCK_WAIT_MS;
    const refreshedSharedSnapshot = await waitForSharedNifty50Snapshot(waitMs);
    if (refreshedSharedSnapshot) {
      recordCall("cache", "getNifty50Snapshot");
      snapshotCache = { data: refreshedSharedSnapshot, fetchedAt: Date.now() };
      return refreshedSharedSnapshot;
    }
    if (staleFallback) {
      return markSnapshotUnavailable(staleFallback);
    }
    return {
      stocks: [],
      fetchedAt: new Date().toISOString(),
      fetchSuccess: false,
      stale: true,
      source: "unavailable",
    };
  }

  recordCall("api", "getNifty50Snapshot");
  snapshotFetchCount++;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await withRetry(
      () => getNse().getEquityStockIndices("NIFTY 50"),
      "getNifty50Snapshot",
    );
    const dataArray = raw?.data;

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      const fallbackRows = await getNifty50ChartFallbackRows();
      if (fallbackRows.length > 0) {
        const fetchSuccess = fallbackRows.length >= NIFTY50_CHART_FALLBACK_MIN_ROWS;
        const snapshot: Nifty50Snapshot = {
          stocks: fallbackRows,
          fetchedAt: new Date().toISOString(),
          fetchSuccess,
          stale: !fetchSuccess,
          source: "nse-charting-intraday",
        };
        if (fetchSuccess) {
          snapshotCache = { data: snapshot, fetchedAt: Date.now() };
          await writeSharedNifty50Snapshot(snapshot);
        }
        logger[fetchSuccess ? "info" : "warn"](
          `Nifty 50 charting fallback: ${fallbackRows.length}/${NIFTY_50_STOCKS.length} stocks`,
          { stockCount: fallbackRows.length, fetchSuccess },
          "Nifty50 Snapshot",
        );
        return snapshot;
      }

      logger.warn(
        "Nifty 50 snapshot: no data array in response",
        { keys: raw ? Object.keys(raw) : null },
        "Nifty50 Snapshot",
      );
      snapshotFailCount++;
      if (snapshotCache) {
        return { ...snapshotCache.data, stale: true, fetchSuccess: false };
      }
      return {
        stocks: [],
        fetchedAt: new Date().toISOString(),
        fetchSuccess: false,
        stale: true,
        source: "unavailable",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stocks: Nifty50StockRow[] = dataArray
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((d: any) => d.symbol && d.symbol !== "NIFTY 50")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d: any) => ({
        symbol: d.symbol,
        name: d.meta?.companyName ?? d.symbol,
        lastPrice: d.lastPrice ?? d.close ?? 0,
        change: d.change ?? 0,
        pChange: d.pChange ?? 0,
        open: d.open ?? 0,
        dayHigh: d.dayHigh ?? 0,
        dayLow: d.dayLow ?? 0,
        previousClose: d.previousClose ?? 0,
        totalTradedVolume: d.totalTradedVolume ?? 0,
        totalTradedValue: d.totalTradedValue ?? 0,
        yearHigh: d.yearHigh ?? 0,
        yearLow: d.yearLow ?? 0,
      }));

    const snapshot: Nifty50Snapshot = {
      stocks,
      fetchedAt: new Date().toISOString(),
      fetchSuccess: true,
      stale: false,
      source: "nse-index",
    };

    snapshotCache = { data: snapshot, fetchedAt: Date.now() };
    await writeSharedNifty50Snapshot(snapshot);

    logger.debug(
      `Nifty 50 snapshot: ${stocks.length} stocks fetched`,
      { count: stocks.length },
      "Nifty50 Snapshot",
    );

    return snapshot;
  } catch (error) {
    snapshotFailCount++;
    logger.error(
      "Failed to fetch Nifty 50 snapshot",
      { error },
      "Nifty50 Snapshot",
      "Could not retrieve the Nifty 50 constituent stocks from NSE. Will use stale data if available.",
    );

    if (snapshotCache) {
      return { ...snapshotCache.data, stale: true, fetchSuccess: false };
    }
    if (lastGoodSnapshot) {
      return markSnapshotUnavailable(lastGoodSnapshot);
    }
    if (sharedSnapshot?.stocks.length) {
      return markSnapshotUnavailable(sharedSnapshot);
    }
    return {
      stocks: [],
      fetchedAt: new Date().toISOString(),
      fetchSuccess: false,
      stale: true,
      source: "unavailable",
    };
  } finally {
    if (sharedLock.status === "acquired") {
      await releaseSharedNifty50RefreshLock(sharedLock.token);
    }
  }
}
