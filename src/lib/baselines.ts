import "server-only";
import { getHistoricalData } from "./nse-client";
import { logger } from "./logger";
import { getRedis } from "./redis";
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
const BASELINE_SHARED_CACHE_TTL_SECONDS = 36 * 60 * 60;
const baselineCache = new Map<string, StockBaseline>();

function todayIST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )
    .toISOString()
    .slice(0, 10);
}

function baselineSharedCacheKey(symbol: string, date: string): string {
  return `nse:baseline:${date}:${symbol.toUpperCase()}`;
}

async function readSharedBaseline(
  symbol: string,
  date: string,
): Promise<StockBaseline | null> {
  const r = getRedis();
  if (!r) return null;

  try {
    const baseline = await r.get<StockBaseline>(baselineSharedCacheKey(symbol, date));
    if (!baseline || baseline.computedDate !== date || baseline.symbol !== symbol.toUpperCase()) {
      return null;
    }
    baselineCache.set(symbol.toUpperCase(), baseline);
    return baseline;
  } catch (error) {
    logger.warn(
      `Baseline shared cache read failed: ${symbol}`,
      { error, symbol },
      "Baseline Service",
    );
    return null;
  }
}

async function writeSharedBaseline(baseline: StockBaseline): Promise<void> {
  const r = getRedis();
  if (!r) return;

  try {
    await r.set(
      baselineSharedCacheKey(baseline.symbol, baseline.computedDate),
      baseline,
      { ex: BASELINE_SHARED_CACHE_TTL_SECONDS },
    );
  } catch (error) {
    logger.warn(
      `Baseline shared cache write failed: ${baseline.symbol}`,
      { error, symbol: baseline.symbol },
      "Baseline Service",
    );
  }
}

/** Get baseline for a single symbol. Returns null if historical data is insufficient. */
export async function getBaseline(symbol: string): Promise<StockBaseline | null> {
  const normalizedSymbol = symbol.toUpperCase();
  const today = todayIST();
  const cached = baselineCache.get(normalizedSymbol);

  if (cached && cached.computedDate === today) {
    return cached;
  }

  const shared = await readSharedBaseline(normalizedSymbol, today);
  if (shared) {
    return shared;
  }

  try {
    const historical = await getHistoricalData(normalizedSymbol, 25);

    if (historical.length < LOOKBACK_DAYS) {
      logger.debug(
        `Baseline: insufficient data for ${normalizedSymbol} (${historical.length} days)`,
        { symbol: normalizedSymbol, daysAvailable: historical.length },
        "Baseline Service",
      );
      return null;
    }

    // Use the last LOOKBACK_DAYS entries (excluding today's partial data
    // if present — historical data from NSE typically includes completed days only)
    const recentDays = historical.slice(-LOOKBACK_DAYS);
    const recent10Days = historical.length >= 10
      ? historical.slice(-10)
      : historical;

    const baseline: StockBaseline = {
      symbol: normalizedSymbol,
      maxHigh5d: Math.max(...recentDays.map((d) => d.high)),
      maxVolume5d:
        recentDays.reduce((sum, d) => sum + d.volume, 0) / recentDays.length,
      minLow10d: Math.min(...recent10Days.map((d) => d.low)),
      maxVolume10d: Math.max(...recent10Days.map((d) => d.volume)),
      computedDate: today,
    };

    baselineCache.set(normalizedSymbol, baseline);
    await writeSharedBaseline(baseline);
    return baseline;
  } catch (error) {
    logger.error(
      `Baseline computation failed: ${normalizedSymbol}`,
      { error },
      "Baseline Service",
      `Could not compute the 5-day baseline for ${normalizedSymbol}. Breakout detection will be unavailable for this stock.`,
    );
    return null;
  }
}

/** Batch-fetch baselines for multiple symbols. Non-blocking — failures for individual symbols are silently handled. */
export async function getBaselines(
  symbols: string[],
  options: { maxToFetch?: number } = {},
): Promise<Map<string, StockBaseline>> {
  const today = todayIST();

  // Split into cached vs need-fetch
  const results = new Map<string, StockBaseline>();
  const toFetch: string[] = [];

  for (const sym of symbols) {
    const normalizedSymbol = sym.toUpperCase();
    const cached = baselineCache.get(normalizedSymbol);
    if (cached && cached.computedDate === today) {
      results.set(normalizedSymbol, cached);
    } else {
      toFetch.push(normalizedSymbol);
    }
  }

  if (toFetch.length === 0) {
    return results;
  }

  const sharedBaselines = await Promise.all(
    toFetch.map((sym) => readSharedBaseline(sym, today)),
  );
  const stillMissing: string[] = [];

  for (let i = 0; i < toFetch.length; i++) {
    const baseline = sharedBaselines[i];
    if (baseline) {
      results.set(toFetch[i], baseline);
    } else {
      stillMissing.push(toFetch[i]);
    }
  }

  if (stillMissing.length === 0) {
    return results;
  }

  const fetchLimit = options.maxToFetch ?? stillMissing.length;
  const limitedFetch = fetchLimit > 0 ? stillMissing.slice(0, fetchLimit) : [];

  if (limitedFetch.length === 0) {
    logger.debug(
      `Baseline hydration skipped; ${stillMissing.length} symbol(s) not cached`,
      { skipped: stillMissing.length, available: results.size },
      "Baseline Service",
    );
    return results;
  }

  logger.api(
    `Computing baselines for ${limitedFetch.length} symbol(s)`,
    {
      count: limitedFetch.length,
      deferred: Math.max(0, stillMissing.length - limitedFetch.length),
      symbols: limitedFetch.slice(0, 10),
    },
    "Baseline Service",
    `Fetching historical data to compute 5-day baselines for ${limitedFetch.length} NIFTY 50 stocks. These baselines are cached for the rest of the trading day.`,
  );

  // Fetch in batches to avoid overwhelming NSE
  const BATCH_SIZE = 5;
  for (let i = 0; i < limitedFetch.length; i += BATCH_SIZE) {
    const batch = limitedFetch.slice(i, i + BATCH_SIZE);
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
