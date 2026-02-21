import { NextResponse } from "next/server";
import { getWatchlist, getAlerts, getAllAlerts, clearAlerts } from "@/lib/store";
import { getScanMeta } from "@/lib/activity";
import { getMarketStatus, getHistoricalCacheStats, getNifty50Index, getApiStats } from "@/lib/nse-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const [watchlist, todayAlerts, allAlerts, scanMeta, marketOpen, cacheStats, nifty] =
    await Promise.all([
      getWatchlist(),
      getAlerts(),
      getAllAlerts(),
      getScanMeta(),
      getMarketStatus().catch(() => false),
      Promise.resolve(getHistoricalCacheStats()),
      getNifty50Index().catch(() => null),
    ]);

  const closeWatchStocks = watchlist.filter((s) => s.closeWatch);
  const unreadAlerts = todayAlerts.filter((a) => !a.read).length;

  // Group historical alerts by date for the dev panel
  const alertsByDate: Record<string, number> = {};
  for (const a of allAlerts) {
    const date = a.triggeredAt.slice(0, 10);
    alertsByDate[date] = (alertsByDate[date] || 0) + 1;
  }

  return NextResponse.json({
    market: { open: marketOpen },
    watchlist: {
      total: watchlist.length,
      closeWatch: closeWatchStocks.length,
      closeWatchSymbols: closeWatchStocks.map((s) => s.symbol),
    },
    alerts: {
      today: todayAlerts.length,
      unread: unreadAlerts,
      totalStored: allAlerts.length,
      byDate: alertsByDate,
    },
    scan: scanMeta,
    cache: cacheStats,
    nifty: nifty ?? null,
    apiStats: getApiStats(),
    serverTime: new Date().toISOString(),
  });
}

export async function DELETE() {
  await clearAlerts();
  return NextResponse.json({ ok: true, cleared: true });
}
