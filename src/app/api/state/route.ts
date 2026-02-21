import { NextResponse } from "next/server";
import { getWatchlist, getAlerts } from "@/lib/store";
import { getScanMeta } from "@/lib/activity";
import { getMarketStatus, getHistoricalCacheStats, getNifty50Index, getApiStats, getNifty50SnapshotStats } from "@/lib/nse-client";
import { getBaselineStats } from "@/lib/baselines";

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

  // Break down alerts by type
  const nifty50Alerts = alerts.filter((a) => a.alertType === "breakout");
  const scanAlerts = alerts.filter((a) => !a.alertType || a.alertType === "scan");

  // Cache layer breakdown from apiStats
  const apiStats = getApiStats();
  const cacheLayers = {
    historical: cacheStats,
    snapshot: getNifty50SnapshotStats(),
    apiThrottle: {
      total: apiStats.total,
      apiCalls: apiStats.apiCalls,
      cacheHits: apiStats.cacheHits,
      hitRate: apiStats.total > 0 ? Math.round((apiStats.cacheHits / apiStats.total) * 100) : 0,
    },
  };

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
      nifty50Alerts: nifty50Alerts.length,
      scanAlerts: scanAlerts.length,
      recentSymbols: alerts.slice(0, 5).map((a) => a.symbol),
    },
    scan: scanMeta,
    cache: cacheStats,
    cacheLayers,
    nifty: nifty ?? null,
    apiStats,
    nifty50Stats: {
      ...getNifty50SnapshotStats(),
      baselines: getBaselineStats(),
    },
    serverTime: new Date().toISOString(),
  });
}
