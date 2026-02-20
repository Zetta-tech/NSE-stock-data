import "server-only";
import { getHistoricalData, getCurrentDayData, recordCall } from "./nse-client";
import { logger } from "./logger";
import type { ScanResult, DayData, DataSource } from "./types";

const LOOKBACK_DAYS = 5;
const LOW_BREAK_LOOKBACK = 10;

/* ── CDN-backed candle fetcher ────────────────────────────────────────
 * On Vercel, GET /api/candles?symbol=…&days=… is served through the CDN
 * with Cache-Control headers.  Fetching via HTTP instead of a direct
 * function call lets repeat scans for the same symbol hit the CDN edge
 * rather than invoking the serverless function again.
 *
 * Fallback: if the HTTP fetch fails (cold CDN, local dev without server,
 * network glitch), we fall back to the direct getHistoricalData() call
 * which uses its own in-memory cache.
 * ──────────────────────────────────────────────────────────────────── */

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

async function fetchCandles(symbol: string, days: number): Promise<DayData[]> {
  const url = `${getBaseUrl()}/api/candles?symbol=${encodeURIComponent(symbol)}&days=${days}`;

  try {
    const res = await fetch(url);

    // Surface Vercel CDN cache status (x-vercel-cache: HIT | MISS | STALE | …)
    const cdnStatus = res.headers.get("x-vercel-cache") || "none";

    if (!res.ok) {
      throw new Error(`Candles API ${res.status}`);
    }

    const data = await res.json();

    // Map CDN status to call record type
    const cdnType = cdnStatus === "HIT" ? "cdn-hit"
      : cdnStatus === "STALE" ? "cdn-stale"
      : "cdn-miss";
    recordCall(cdnType, "fetchCandles", symbol);

    logger.debug(
      `Candles via CDN: ${symbol} (${data.candleCount} days, cdn=${cdnStatus})`,
      { symbol, candleCount: data.candleCount, cdnStatus },
      "Stock Scanner",
    );

    return data.candles as DayData[];
  } catch (error) {
    // CDN / HTTP fetch failed — fall back to direct function call.
    // This keeps the scanner working on localhost and when CDN evicts.
    const msg = error instanceof Error ? error.message : String(error);
    logger.debug(
      `CDN fetch failed for ${symbol}, falling back to direct call: ${msg}`,
      { symbol, error: msg },
      "Stock Scanner",
    );
    recordCall("cdn-error", "fetchCandles", symbol);
    return getHistoricalData(symbol, days);
  }
}

function analyzeBreakout(
  today: { high: number; volume: number; close: number; change: number },
  previousDays: DayData[],
  lowBreakDays: DayData[]
): Omit<ScanResult, "symbol" | "name" | "scannedAt" | "dataSource"> {
  const prevMaxHigh = Math.max(...previousDays.map((d) => d.high));
  const prevMaxVolume = Math.max(...previousDays.map((d) => d.volume));

  const highBreak = today.high > prevMaxHigh;
  const volumeBreak = today.volume > prevMaxVolume;

  const highBreakPercent =
    prevMaxHigh > 0 ? ((today.high - prevMaxHigh) / prevMaxHigh) * 100 : 0;
  const volumeBreakPercent =
    prevMaxVolume > 0
      ? ((today.volume - prevMaxVolume) / prevMaxVolume) * 100
      : 0;

  // Low-break: LTP falls below the lowest daily low of previous 10 trading days
  let prev10DayLow = 0;
  let lowBreakTriggered = false;
  let lowBreakPercent = 0;

  if (lowBreakDays.length > 0) {
    prev10DayLow = Math.min(...lowBreakDays.map((d) => d.low));
    lowBreakTriggered = today.close < prev10DayLow && prev10DayLow > 0;
    lowBreakPercent =
      prev10DayLow > 0
        ? ((prev10DayLow - today.close) / prev10DayLow) * 100
        : 0;
  }

  return {
    triggered: highBreak && volumeBreak,
    todayHigh: today.high,
    todayVolume: today.volume,
    prevMaxHigh,
    prevMaxVolume,
    highBreakPercent: Math.round(highBreakPercent * 100) / 100,
    volumeBreakPercent: Math.round(volumeBreakPercent * 100) / 100,
    todayClose: today.close,
    todayChange: Math.round(today.change * 100) / 100,
    lowBreakTriggered,
    prev10DayLow: Math.round(prev10DayLow * 100) / 100,
    lowBreakPercent: Math.round(lowBreakPercent * 100) / 100,
  };
}

export async function scanStock(
  symbol: string,
  name: string,
  useIntraday: boolean = false,
  marketOpen: boolean = false
): Promise<ScanResult> {
  const scannedAt = new Date().toISOString();

  try {
    const historical = await fetchCandles(symbol, 25);

    if (historical.length < LOOKBACK_DAYS + 1) {
      throw new Error(
        `Insufficient historical data for ${symbol}: got ${historical.length} days`
      );
    }

    let todayData: {
      high: number;
      volume: number;
      close: number;
      change: number;
    };
    let previousDays: DayData[];
    let lowBreakDays: DayData[];
    let dataSource: DataSource;

    if (useIntraday) {
      const liveDayData = await getCurrentDayData(symbol);

      if (liveDayData && liveDayData.high > 0) {
        todayData = liveDayData;
        previousDays = historical.slice(-LOOKBACK_DAYS);
        lowBreakDays = historical.slice(-LOW_BREAK_LOOKBACK);
        dataSource = "live";
      } else {
        // Live fetch failed — behaviour depends on whether market is open.
        const lastDay = historical[historical.length - 1];
        todayData = {
          high: lastDay.high,
          volume: lastDay.volume,
          close: lastDay.close,
          change: 0,
        };
        previousDays = historical.slice(
          -(LOOKBACK_DAYS + 1),
          -1
        );
        lowBreakDays = historical.slice(
          -(LOW_BREAK_LOOKBACK + 1),
          -1
        );

        // Market open → data is stale (could miss real breakout).
        // Market closed → historical fallback is the correct behaviour.
        dataSource = marketOpen ? "stale" : "historical";
      }
    } else {
      const lastDay = historical[historical.length - 1];
      todayData = {
        high: lastDay.high,
        volume: lastDay.volume,
        close: lastDay.close,
        change:
          lastDay.close > 0 && historical.length > 1
            ? ((lastDay.close - historical[historical.length - 2].close) /
              historical[historical.length - 2].close) *
            100
            : 0,
      };
      previousDays = historical.slice(-(LOOKBACK_DAYS + 1), -1);
      lowBreakDays = historical.slice(-(LOW_BREAK_LOOKBACK + 1), -1);
      dataSource = "historical";
    }

    const analysis = analyzeBreakout(todayData, previousDays, lowBreakDays);

    // Suppress triggers when data is stale — we can't trust the comparison.
    const triggered = dataSource === "stale" ? false : analysis.triggered;
    const lowBreakTriggered = dataSource === "stale" ? false : analysis.lowBreakTriggered;

    if (triggered) {
      logger.warn(
        `BREAKOUT: ${symbol} — High +${analysis.highBreakPercent}%, Vol +${analysis.volumeBreakPercent}%`,
        { symbol, highBreakPercent: analysis.highBreakPercent, volumeBreakPercent: analysis.volumeBreakPercent, dataSource },
        'Stock Scanner',
        `🚨 ${name} (${symbol}) is showing unusual activity! Today's highest price is ${analysis.highBreakPercent}% above the highest price of the last ${LOOKBACK_DAYS} trading days, AND trading volume is up ${analysis.volumeBreakPercent}% beyond its recent peak. This combination of a new price high with surging volume is a classic "breakout" signal that may indicate the start of a strong upward move.`,
      );
    }

    if (lowBreakTriggered) {
      logger.warn(
        `LOW BREAK: ${symbol} — LTP ₹${analysis.todayClose} below 10-day low ₹${analysis.prev10DayLow} (-${analysis.lowBreakPercent}%)`,
        { symbol, ltp: analysis.todayClose, prev10DayLow: analysis.prev10DayLow, lowBreakPercent: analysis.lowBreakPercent, dataSource },
        'Stock Scanner',
        `🔻 ${name} (${symbol}) has broken below its ${LOW_BREAK_LOOKBACK}-day low! The last traded price of ₹${analysis.todayClose} is ${analysis.lowBreakPercent}% below the lowest daily low (₹${analysis.prev10DayLow}) of the previous ${LOW_BREAK_LOOKBACK} trading days. This breakdown signal may indicate increased selling pressure.`,
      );
    }

    return { symbol, name, scannedAt, dataSource, ...analysis, triggered, lowBreakTriggered };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `Scan failed for ${symbol}: ${message}`,
      { symbol, error: message },
      'Stock Scanner',
      `We were unable to analyze ${name} (${symbol}). Reason: "${message}". This stock will be skipped for this scan cycle. Common causes include insufficient trading history (newly listed stocks) or a temporary NSE API outage.`,
    );
    return {
      symbol,
      name,
      triggered: false,
      lowBreakTriggered: false,
      todayHigh: 0,
      todayVolume: 0,
      prevMaxHigh: 0,
      prevMaxVolume: 0,
      highBreakPercent: 0,
      volumeBreakPercent: 0,
      todayClose: 0,
      todayChange: 0,
      prev10DayLow: 0,
      lowBreakPercent: 0,
      scannedAt,
      dataSource: "historical",
    };
  }
}

export async function scanMultipleStocks(
  stocks: { symbol: string; name: string }[],
  useIntraday: boolean = false,
  marketOpen: boolean = false
): Promise<ScanResult[]> {
  const results = await Promise.allSettled(
    stocks.map((s) => scanStock(s.symbol, s.name, useIntraday, marketOpen))
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
        symbol: stocks[i].symbol,
        name: stocks[i].name,
        triggered: false,
        lowBreakTriggered: false,
        todayHigh: 0,
        todayVolume: 0,
        prevMaxHigh: 0,
        prevMaxVolume: 0,
        highBreakPercent: 0,
        volumeBreakPercent: 0,
        todayClose: 0,
        todayChange: 0,
        prev10DayLow: 0,
        lowBreakPercent: 0,
        scannedAt: new Date().toISOString(),
        dataSource: "historical" as const,
      }
  );
}
