import { NextResponse } from "next/server";
import { scanMultipleStocks } from "@/lib/scanner";
import { getWatchlist, getCloseWatchStocks, addAlert, getAlerts } from "@/lib/store";
import { getMarketStatus, getHistoricalCacheStats } from "@/lib/nse-client";
import { addActivity, setScanMeta } from "@/lib/activity";
import { logger } from "@/lib/logger";
import type { Alert, ScanResponse, ScanMeta } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const useIntraday = body.intraday === true;
    const closeWatchOnly = body.closeWatchOnly === true;
    const scanType: "manual" | "auto" = closeWatchOnly ? "auto" : "manual";

    const watchlist = closeWatchOnly
      ? await getCloseWatchStocks()
      : await getWatchlist();
    logger.api(
      `Starting scan of ${watchlist.length} stock(s) ${closeWatchOnly ? '(Close Watch only)' : ''}`,
      { stockCount: watchlist.length, useIntraday, closeWatchOnly },
      'Scan API',
      `A scan was requested for ${watchlist.length} stock(s). ${closeWatchOnly ? 'Only stocks on your Close Watch list are being checked.' : 'All stocks on your watchlist are being scanned.'} ${useIntraday ? 'Using live intraday prices.' : 'Using end-of-day closing prices.'}`,
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

    // ── Activity tracking ──────────────────────────────────────────────
    const staleCount = results.filter((r) => r.dataSource === "stale").length;
    const liveCount = results.filter((r) => r.dataSource === "live").length;
    const historicalCount = results.filter((r) => r.dataSource === "historical").length;
    const closeWatchSymbols = (await getCloseWatchStocks()).map((s) => s.symbol);

    const meta: ScanMeta = {
      scannedAt: new Date().toISOString(),
      scanType,
      marketOpen,
      stockCount: results.length,
      triggeredCount: newAlerts.length,
      staleCount,
      liveCount,
      historicalCount,
      closeWatchSymbols,
      alertsFired: newAlerts.map((a) => a.symbol),
    };
    await setScanMeta(meta);

    await addActivity(
      "system",
      scanType === "auto" ? "scan-auto" : "scan-manual",
      `${scanType === "auto" ? "Auto-scan" : "Manual scan"}: ${results.length} stocks in ${scanDuration}ms` +
        (newAlerts.length > 0 ? ` — ${newAlerts.length} breakout${newAlerts.length > 1 ? "s" : ""}` : ""),
      { durationMs: scanDuration, stockCount: results.length, triggeredCount: newAlerts.length, marketOpen, intraday: useIntraday }
    );

    for (const a of newAlerts) {
      await addActivity(
        "system",
        "alert-fired",
        `Alert: ${a.symbol} breakout — high +${a.highBreakPercent}%, vol +${a.volumeBreakPercent}%`,
        { symbol: a.symbol, highBreakPercent: a.highBreakPercent, volumeBreakPercent: a.volumeBreakPercent }
      );
    }

    if (staleCount > 0) {
      const staleSymbols = results.filter((r) => r.dataSource === "stale").map((r) => r.symbol);
      await addActivity(
        "warning",
        "data-stale",
        `${staleCount} stock${staleCount > 1 ? "s" : ""} returned stale data: ${staleSymbols.join(", ")}`,
        { symbols: staleSymbols, count: staleCount }
      );
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
      `Finished scanning ${results.length} stock(s) in ${(scanDuration / 1000).toFixed(1)} seconds. ${newAlerts.length > 0 ? `${newAlerts.length} stock(s) triggered a breakout alert.` : 'No breakout signals detected this cycle.'} ${marketOpen ? 'Market is currently OPEN.' : 'Market is currently CLOSED.'}`,
    );
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scan failed";
    logger.error(
      `Scan failed: ${message}`,
      { error: message },
      'Scan API',
      `The entire scan cycle failed. Error: "${message}". The system will try again on the next scan cycle.`,
    );

    await addActivity("warning", "scan-error", `Scan failed: ${message}`).catch(() => {});

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
