import "server-only";
import { getHistoricalData } from "./nse-client";
import { logger } from "./logger";
import type { StockBaseline } from "./types";

/* ── Baseline Cache ───────────────────────────────────────────────────
 * Baselines are "one-time compute" per trading day per symbol.
 * Once computed for a given IST date, they don't change — historical
 * data is immutable after market close.
 *
 * In-memory cache keyed by symbol. Entries are valid for the current
 * IST date. Cold starts recompute (acceptable — only happens once).
 * ──────────────────────────────────────────────────────────────────── */

const LOOKBACK_DAYS = 5;
const baselineCache = new Map<string, StockBaseline>();

function todayIST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )
    .toISOString()
    .slice(0, 10);
}

/** Get baseline for a single symbol. Returns null if historical data is insufficient. */
export async function getBaseline(symbol: string): Promise<StockBaseline | null> {
  const today = todayIST();
  const cached = baselineCache.get(symbol);

  if (cached && cached.computedDate === today) {
    return cached;
  }

  try {
    const historical = await getHistoricalData(symbol, 25);

    if (historical.length < LOOKBACK_DAYS) {
      logger.debug(
        `Baseline: insufficient data for ${symbol} (${historical.length} days)`,
        { symbol, daysAvailable: historical.length },
        "Baseline Service",
      );
      return null;
    }

    // Use the last LOOKBACK_DAYS entries (excluding today's partial data
    // if present — historical data from NSE typically includes completed days only)
    const recentDays = historical.slice(-LOOKBACK_DAYS);

    const baseline: StockBaseline = {
      symbol,
      maxHigh5d: Math.max(...recentDays.map((d) => d.high)),
      maxVolume5d:
        recentDays.reduce((sum, d) => sum + d.volume, 0) / recentDays.length,
      computedDate: today,
    };

    baselineCache.set(symbol, baseline);
    return baseline;
  } catch (error) {
    logger.error(
      `Baseline computation failed: ${symbol}`,
      { error },
      "Baseline Service",
      `Could not compute the 5-day baseline for ${symbol}. Breakout detection will be unavailable for this stock.`,
    );
    return null;
  }
}

/** Batch-fetch baselines for multiple symbols. Non-blocking — failures for individual symbols are silently handled. */
export async function getBaselines(symbols: string[]): Promise<Map<string, StockBaseline>> {
  const today = todayIST();

  // Split into cached vs need-fetch
  const results = new Map<string, StockBaseline>();
  const toFetch: string[] = [];

  for (const sym of symbols) {
    const cached = baselineCache.get(sym);
    if (cached && cached.computedDate === today) {
      results.set(sym, cached);
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length === 0) {
    return results;
  }

  logger.api(
    `Computing baselines for ${toFetch.length} symbol(s)`,
    { count: toFetch.length, symbols: toFetch.slice(0, 10) },
    "Baseline Service",
    `Fetching historical data to compute 5-day baselines for ${toFetch.length} NIFTY 50 stocks. These baselines are cached for the rest of the trading day.`,
  );

  // Fetch in batches to avoid overwhelming NSE
  const BATCH_SIZE = 5;
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((sym) => getBaseline(sym))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = settled[j];
      if (result.status === "fulfilled" && result.value) {
        results.set(batch[j], result.value);
      }
    }
  }

  logger.info(
    `Baselines ready: ${results.size}/${symbols.length} available`,
    { available: results.size, total: symbols.length },
    "Baseline Service",
  );

  return results;
}

/** Returns cache stats for the dev panel. */
export function getBaselineStats(): {
  available: number;
  missing: number;
  date: string;
  symbols: string[];
} {
  const today = todayIST();
  const valid: string[] = [];
  baselineCache.forEach((v, k) => {
    if (v.computedDate === today) valid.push(k);
  });
  return {
    available: valid.length,
    missing: 50 - valid.length, // approximate (NIFTY 50)
    date: today,
    symbols: valid,
  };
}
