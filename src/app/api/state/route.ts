import { NextResponse } from "next/server";
import { getWatchlist, getAlerts } from "@/lib/store";
import { getScanMeta } from "@/lib/activity";
import { getMarketStatus, getHistoricalCacheStats } from "@/lib/nse-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const [watchlist, alerts, scanMeta, marketOpen, cacheStats] =
    await Promise.all([
      getWatchlist(),
      getAlerts(),
      getScanMeta(),
      getMarketStatus().catch(() => false),
      Promise.resolve(getHistoricalCacheStats()),
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
    serverTime: new Date().toISOString(),
  });
}
