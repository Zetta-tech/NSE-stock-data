import { NextResponse } from "next/server";
import { getCloseWatchStocks } from "@/lib/store";
import { getCurrentDayData } from "@/lib/nse-client";
import { logger } from "@/lib/logger";
import type { TickerQuote } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const stocks = await getCloseWatchStocks();

    if (stocks.length === 0) {
      return NextResponse.json({ quotes: [], fetchedAt: new Date().toISOString() });
    }

    logger.api(`GET /api/ticker → ${stocks.length} close-watch stocks`, { stockCount: stocks.length }, 'TickerRoute');

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

    logger.info(`Ticker fetched ${quotes.length}/${stocks.length} quotes`, { quoteCount: quotes.length, stockCount: stocks.length }, 'TickerRoute');

    return NextResponse.json({
      quotes,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ticker fetch failed";
    logger.error(`Ticker failed: ${message}`, { error: message }, 'TickerRoute');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
