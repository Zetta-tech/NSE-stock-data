import { NextResponse } from "next/server";
import { getWatchlist, getAlerts } from "@/lib/store";
import { getScanMeta } from "@/lib/activity";
import { getMarketStatus, getHistoricalCacheStats, getNifty50Index } from "@/lib/nse-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const [watchlist, alerts, scanMeta, marketOpen, cacheStats, nifty] =
    await Promise.all([
      getWatchlist(),
      getAlerts(),
      getScanMeta(),
      getMarketStatus().catch(() => false),
      Promise.resolve(getHistoricalCacheStats()),
      getNifty50Index().catch(() => null),
    ]);

  const closeWatchStocks = watchlist.filter((s) => s.closeWatch);
  const unreadAlerts = alerts.filter((a) => !a.read).length;

  return NextResponse.json({
    market: { open: marketOpen },
    watchlist: {
      total: watchlist.length,
      closeWatch: closeWatchStocks.length,
      closeWatchSymbols: closeWatchStocks.map((s) => s.symbol),
    },
    alerts: {
      total: alerts.length,
      unread: unreadAlerts,
    },
    scan: scanMeta,
    cache: cacheStats,
    nifty: nifty ?? null,
    serverTime: new Date().toISOString(),
  });
}
