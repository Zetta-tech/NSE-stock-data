import "server-only";
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
    return cached.data;
  }

  const nse = getNse();
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days * 2);

  const raw = await nse.getEquityHistoricalData(symbol, { start, end });

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

    return { high, volume, close, change };
  } catch {
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
  } catch {
    return false;
  }
}
