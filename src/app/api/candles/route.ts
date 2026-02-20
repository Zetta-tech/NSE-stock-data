import { NextResponse } from "next/server";
import { getHistoricalData } from "@/lib/nse-client";
import { logger } from "@/lib/logger";

/**
 * GET /api/candles?symbol=INFY&days=25
 *
 * Returns historical daily OHLCV candles for a symbol.
 * Served via Vercel CDN with aggressive caching — historical candle
 * data for completed trading days doesn't change within a calendar day.
 *
 * Cache strategy:
 *   CDN-Cache-Control: s-maxage=3600 (fresh 1 h) + stale-while-revalidate=43200 (12 h)
 *   Cache-Control:     max-age=60 (browser caches 1 min only)
 *
 * The Vercel CDN cache is best-effort; callers should handle cache misses
 * gracefully (the function will re-execute and return fresh data).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.toUpperCase().trim();
  const days = parseInt(searchParams.get("days") || "25", 10);

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing required query parameter: symbol", example: "/api/candles?symbol=INFY&days=25" },
      { status: 400 }
    );
  }

  if (isNaN(days) || days < 1 || days > 365) {
    return NextResponse.json(
      { error: "days must be between 1 and 365", received: searchParams.get("days") },
      { status: 400 }
    );
  }

  try {
    const start = Date.now();
    const candles = await getHistoricalData(symbol, days);
    const durationMs = Date.now() - start;

    logger.debug(
      `Candles served: ${symbol} (${candles.length} days, ${durationMs}ms)`,
      { symbol, days, candleCount: candles.length, durationMs },
      "Candles API",
    );

    const response = NextResponse.json({
      symbol,
      days,
      candles,
      candleCount: candles.length,
      fetchedAt: new Date().toISOString(),
    });

    // CDN caching: fresh for 1 hour, stale served for up to 12 hours
    // while the CDN revalidates in the background.
    // Vercel strips s-maxage / stale-while-revalidate from the browser
    // response automatically when CDN-Cache-Control is set.
    response.headers.set(
      "CDN-Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=43200"
    );
    // Short browser TTL so clients see relatively fresh data on refresh
    response.headers.set("Cache-Control", "public, max-age=60");

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      `Candles API failed: ${symbol} — ${message}`,
      { symbol, days, error: message },
      "Candles API",
      `Could not retrieve historical candle data for ${symbol}. This is typically caused by an NSE API timeout or the symbol not being found.`,
    );

    return NextResponse.json(
      { error: "Failed to fetch candle data", symbol, detail: message },
      { status: 502 }
    );
  }
}
