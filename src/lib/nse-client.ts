import { logger } from "./logger";
import { NseIndia } from "stock-nse-india";
import type { DayData } from "./types";

let nseInstance: NseIndia | null = null;

function getNse(): NseIndia {
  if (!nseInstance) {
    nseInstance = new NseIndia();
  }
  return nseInstance;
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
    logger.debug(
      `Cache hit: ${symbol} (${days} days)`,
      { type: 'CACHE_HIT', symbol },
      'NSE Data Service',
      `No network call needed — we already have today's price history for ${symbol}. The cached data covers the last ${days} trading days and is still valid because the date hasn't changed.`,
    );
    return cached.data;
  }

  logger.api(
    `Fetching historical data: ${symbol} (${days} days)`,
    { symbol, days },
    'NSE Data Service',
    `Calling the NSE India API to download the last ${days} trading days of price & volume data for ${symbol}. This data is needed to check whether today's numbers are unusually high compared to recent history.`,
  );

  const nse = getNse();
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days * 2);

  const raw = await nse.getEquityHistoricalData(symbol, { start, end });
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
  const nse = getNse();

  try {
    const [details, tradeInfo] = await Promise.all([
      nse.getEquityDetails(symbol),
      nse.getEquityTradeInfo(symbol),
    ]);

    const high = details.priceInfo.intraDayHighLow.max;
    const close = details.priceInfo.lastPrice || details.priceInfo.close;
    const change = details.priceInfo.pChange;
    const volume =
      tradeInfo.marketDeptOrderBook.tradeInfo.totalTradedVolume;

    logger.debug(
      `Live data received: ${symbol} — ₹${close} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`,
      { high, volume, close, change },
      'NSE Data Service',
      `Successfully fetched real-time intraday data for ${symbol}. Current price is ₹${close} with a ${change >= 0 ? 'gain' : 'loss'} of ${Math.abs(change).toFixed(2)}% today. Today's high so far is ₹${high} on volume of ${volume.toLocaleString()} shares.`,
    );
    return { high, volume, close, change };
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

export async function getMarketStatus(): Promise<boolean> {
  const nse = getNse();
  try {
    const status = await nse.getMarketStatus();
    return status.marketState.some(
      (s) =>
        s.market === "Capital Market" &&
        s.marketStatus.toLowerCase().includes("open")
    );
  } catch (error) {
    logger.error(
      `Market status check failed`,
      { error },
      'NSE Data Service',
      `Unable to determine whether the Indian stock market is currently open. The system will assume the market is closed and use end-of-day data. This is usually caused by an NSE website timeout.`,
    );
    return false;
  }
}

export interface NseSearchResult {
  symbol: string;
  name: string;
}

export async function searchStocks(
  query: string
): Promise<NseSearchResult[]> {
  const nse = getNse();
  try {
    logger.api(
      `Searching NSE for "${query}"`,
      { query },
      'NSE Data Service',
      `Looking up stock symbols on the NSE that match the search term "${query}". Results are filtered to only show equities (no derivatives or indices).`,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await nse.getDataByEndpoint(
      `/api/search/autocomplete?q=${encodeURIComponent(query)}`
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
