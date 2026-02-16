import { NextResponse } from "next/server";
import { scanMultipleStocks } from "@/lib/scanner";
import { getWatchlist, getCloseWatchStocks, addAlert, getAlerts } from "@/lib/store";
import { getMarketStatus, getHistoricalCacheStats } from "@/lib/nse-client";
import { logger } from "@/lib/logger";
import type { Alert, ScanResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const useIntraday = body.intraday === true;
    const closeWatchOnly = body.closeWatchOnly === true;

    const watchlist = closeWatchOnly
      ? await getCloseWatchStocks()
      : await getWatchlist();
    logger.api(`POST /api/scan → ${watchlist.length} stocks, intraday=${useIntraday}, closeWatchOnly=${closeWatchOnly}`, { stockCount: watchlist.length, useIntraday, closeWatchOnly }, 'ScanRoute');

    const scanStart = Date.now();
    const marketOpen = await getMarketStatus().catch(() => false);
    const results = await scanMultipleStocks(watchlist, useIntraday, marketOpen);
    const scanDuration = Date.now() - scanStart;

    const newAlerts: Alert[] = [];
    for (const result of results) {
      if (result.triggered) {
        const alert: Alert = {
          id: `${result.symbol}-${Date.now()}`,
          symbol: result.symbol,
          name: result.name,
          todayHigh: result.todayHigh,
          todayVolume: result.todayVolume,
          prevMaxHigh: result.prevMaxHigh,
          prevMaxVolume: result.prevMaxVolume,
          highBreakPercent: result.highBreakPercent,
          volumeBreakPercent: result.volumeBreakPercent,
          todayClose: result.todayClose,
          todayChange: result.todayChange,
          triggeredAt: result.scannedAt,
          read: false,
        };
        await addAlert(alert);
        newAlerts.push(alert);
      }
    }

    const response: ScanResponse = {
      results,
      alerts: await getAlerts(),
      scannedAt: new Date().toISOString(),
      marketOpen,
      cacheStats: getHistoricalCacheStats(),
    };

    logger.info(`Scan complete in ${scanDuration}ms — ${results.length} stocks, ${newAlerts.length} new alerts`, { durationMs: scanDuration, stockCount: results.length, alertCount: newAlerts.length, marketOpen }, 'ScanRoute');
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scan failed";
    logger.error(`Scan failed: ${message}`, { error: message }, 'ScanRoute');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
