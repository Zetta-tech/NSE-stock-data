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

    const watchlist = closeWatchOnly ? getCloseWatchStocks() : getWatchlist();
    logger.api(
      `Starting scan of ${watchlist.length} stock(s) ${closeWatchOnly ? '(Close Watch only)' : ''}`,
      { stockCount: watchlist.length, useIntraday, closeWatchOnly },
      'Scan API',
      `A scan was requested for ${watchlist.length} stock(s). ${closeWatchOnly ? 'Only stocks on your Close Watch list are being checked.' : 'All stocks on your watchlist are being scanned.'} ${useIntraday ? 'Using live intraday prices (market hours mode).' : 'Using end-of-day closing prices.'}`,
    );

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

    logger.info(
      `Scan complete in ${scanDuration}ms — ${results.length} stocks, ${newAlerts.length} new alert(s)`,
      { durationMs: scanDuration, stockCount: results.length, alertCount: newAlerts.length, marketOpen },
      'Scan API',
      `Finished scanning ${results.length} stock(s) in ${(scanDuration / 1000).toFixed(1)} seconds. ${newAlerts.length > 0 ? `⚠️ ${newAlerts.length} stock(s) triggered a breakout alert — their price and volume both exceeded recent highs. Check the alerts panel for details.` : '✅ No breakout signals detected this cycle. All stocks are trading within their normal recent ranges.'} ${marketOpen ? 'Market is currently OPEN.' : 'Market is currently CLOSED — using yesterday\'s closing data.'}`,
    );
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scan failed";
    logger.error(
      `Scan failed: ${message}`,
      { error: message },
      'Scan API',
      `The entire scan cycle failed and no stocks were analyzed. Error: "${message}". This usually means the NSE India website is unreachable. The system will try again on the next scan cycle.`,
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
