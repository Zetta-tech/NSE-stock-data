import { logger } from "./logger";
import { NseIndia } from "stock-nse-india";
import { isExtendedHours } from "./market-hours";
import type { DayData, NiftyIndex, Nifty50StockRow, Nifty50Snapshot } from "./types";
import { recordCall, getApiStats } from "./api-stats";

export { getApiStats };

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
): Promise<{ high: number; volume: number; close: number; change: number } | null> {
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

      return { high, volume, close, change };
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
  // Outside extended hours (before 09:00 or after 16:00 IST), market is
  // definitely closed — skip the NSE API call entirely.
  if (!isExtendedHours()) {
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

  // Outside extended hours, return last-known closing value without hitting NSE
  if (!isExtendedHours()) {
    if (indexCache) {
      recordCall("cache", "getNifty50Index");
      return indexCache.data;
    }
    // No cached data at all — allow one fetch to seed the closing value
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
 *   - After hours: serve last-known data indefinitely (no polling)
 *   - On fetch failure: return stale data with stale=true flag
 * ──────────────────────────────────────────────────────────────────── */

let snapshotCache: { data: Nifty50Snapshot; fetchedAt: number } | null = null;
const SNAPSHOT_CACHE_TTL = 3 * 60_000; // 3 minutes

// Tracking stats for dev panel
let snapshotFetchCount = 0;
let snapshotFailCount = 0;

export function getNifty50SnapshotStats() {
  return {
    lastRefreshTime: snapshotCache?.data.fetchedAt ?? null,
    snapshotFetchSuccess: snapshotCache?.data.fetchSuccess ?? false,
    snapshotFetchCount,
    snapshotFailCount,
  };
}

export async function getNifty50Snapshot(): Promise<Nifty50Snapshot> {
  // Return cached if fresh
  if (snapshotCache && Date.now() - snapshotCache.fetchedAt < SNAPSHOT_CACHE_TTL) {
    recordCall("cache", "getNifty50Snapshot");
    return snapshotCache.data;
  }

  // Outside extended hours, return last-known data without hitting NSE
  if (!isExtendedHours()) {
    if (snapshotCache) {
      recordCall("cache", "getNifty50Snapshot");
      return snapshotCache.data;
    }
    // No cached data at all — allow one fetch to seed
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
      logger.warn(
        "Nifty 50 snapshot: no data array in response",
        { keys: raw ? Object.keys(raw) : null },
        "Nifty50 Snapshot",
      );
      snapshotFailCount++;
      if (snapshotCache) {
        return { ...snapshotCache.data, stale: true, fetchSuccess: false };
      }
      return { stocks: [], fetchedAt: new Date().toISOString(), fetchSuccess: false, stale: true };
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
    };

    snapshotCache = { data: snapshot, fetchedAt: Date.now() };

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
    return { stocks: [], fetchedAt: new Date().toISOString(), fetchSuccess: false, stale: true };
  }
}
