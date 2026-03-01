import { NextResponse } from "next/server";
import { getWatchlist, getAlerts, getNifty50PersistentStats } from "@/lib/store";
import { getScanMeta } from "@/lib/activity";
import { getMarketStatus, getHistoricalCacheStats, getNifty50Index, getApiStats } from "@/lib/nse-client";
import { getBaselineStats } from "@/lib/baselines";
import { flushStats, getPersistedStats } from "@/lib/api-stats";
import { getAlertRequests } from "@/lib/alert-requests";

export const dynamic = "force-dynamic";

export async function GET() {
  // Lazy flush: write pending API stat deltas to Redis on each poll
  await flushStats().catch(() => {});

  const [watchlist, alerts, scanMeta, marketOpen, cacheStats, nifty, nifty50Stats, persistedApiStats, alertRequests] =
    await Promise.all([
      getWatchlist(),
      getAlerts(),
      getScanMeta(),
      getMarketStatus().catch(() => false),
      Promise.resolve(getHistoricalCacheStats()),
      getNifty50Index().catch(() => null),
      getNifty50PersistentStats(),
      getPersistedStats(),
      getAlertRequests().catch(() => [] as import("@/lib/types").AlertRequest[]),
    ]);

  const closeWatchStocks = watchlist.filter((s) => s.closeWatch);
  const unreadAlerts = alerts.filter((a) => !a.read).length;

  // Break down alerts by type
  const nifty50Alerts = alerts.filter((a) => a.alertType === "breakout");
  const scanAlerts = alerts.filter((a) => !a.alertType || a.alertType === "scan");

  // Cache layer breakdown from apiStats
  const apiStats = getApiStats();
  const cacheLayers = {
    historical: { ...cacheStats, scope: "per-instance" as const },
    snapshot: { ...nifty50Stats, scope: "cross-instance" as const },
    apiThrottle: {
      total: apiStats.total,
      apiCalls: apiStats.apiCalls,
      cacheHits: apiStats.cacheHits,
      hitRate: apiStats.total > 0 ? Math.round((apiStats.cacheHits / apiStats.total) * 100) : 0,
      scope: "per-instance" as const,
    },
    persisted: {
      apiCalls: persistedApiStats.apiCalls,
      cacheHits: persistedApiStats.cacheHits,
      lastFlushed: persistedApiStats.lastFlushed,
      methodBreakdown: persistedApiStats.methodBreakdown,
      scope: "cross-instance" as const,
    },
  };

  // Alert request status breakdown
  const alertRequestsByStatus: Record<string, number> = {};
  for (const r of alertRequests) {
    alertRequestsByStatus[r.status] = (alertRequestsByStatus[r.status] ?? 0) + 1;
  }
  const inProgressCount = alertRequests.filter(
    (r) => r.status !== "implemented" && r.status !== "rejected"
  ).length;

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
    alertRequests: {
      total: alertRequests.length,
      inProgress: inProgressCount,
      byStatus: alertRequestsByStatus,
      recent: alertRequests.slice(0, 5).map((r) => ({
        id: r.id,
        text: r.text.replace(/^Create Alert:\s*/i, ""),
        status: r.status,
        createdAt: r.createdAt,
        githubIssueNumber: r.githubIssueNumber,
        githubPrNumber: r.githubPrNumber,
      })),
    },
    scan: scanMeta,
    cache: cacheStats,
    cacheLayers,
    nifty: nifty ?? null,
    apiStats,
    nifty50Stats: {
      ...nifty50Stats,
      baselines: getBaselineStats(),
    },
    serverTime: new Date().toISOString(),
  });
}
