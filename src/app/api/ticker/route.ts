import { NextResponse } from "next/server";
import { getCloseWatchStocks } from "@/lib/store";
import { getCurrentDayData } from "@/lib/nse-client";
import { logger } from "@/lib/logger";
import type { TickerQuote } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stocks = getCloseWatchStocks();

    if (stocks.length === 0) {
      return NextResponse.json({ quotes: [], fetchedAt: new Date().toISOString() });
    }

    logger.api(
      `Refreshing live prices for ${stocks.length} Close Watch stock(s)`,
      { stockCount: stocks.length },
      'Live Ticker',
      `The ticker bar at the top of the dashboard is updating. It's fetching real-time prices for the ${stocks.length} stock(s) you have marked as "Close Watch". This data powers the scrolling ticker display.`,
    );

    const settled = await Promise.allSettled(
      stocks.map(async (s) => {
        const data = await getCurrentDayData(s.symbol);
        if (!data || data.high === 0) return null;
        return {
          symbol: s.symbol,
          name: s.name,
          price: data.close,
          change: Math.round(data.change * 100) / 100,
          high: data.high,
          volume: data.volume,
          fetchedAt: new Date().toISOString(),
        } satisfies TickerQuote;
      })
    );

    const quotes: TickerQuote[] = settled
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((q): q is TickerQuote => q !== null);

    logger.info(
      `Ticker updated: ${quotes.length} of ${stocks.length} prices received`,
      { quoteCount: quotes.length, stockCount: stocks.length },
      'Live Ticker',
      `Successfully fetched live prices for ${quotes.length} out of ${stocks.length} Close Watch stock(s). ${quotes.length < stocks.length ? `${stocks.length - quotes.length} stock(s) couldn't be fetched — they may be newly listed or the NSE may be temporarily unavailable for those symbols.` : 'All prices are up to date.'}`,
    );

    return NextResponse.json({
      quotes,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ticker fetch failed";
    logger.error(
      `Ticker refresh failed: ${message}`,
      { error: message },
      'Live Ticker',
      `The live ticker couldn't refresh its price data. Error: "${message}". The ticker will continue showing the last known prices until the next successful refresh.`,
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
