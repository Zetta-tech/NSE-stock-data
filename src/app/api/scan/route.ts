import { NextResponse } from "next/server";
import { scanMultipleStocks } from "@/lib/scanner";
import { getWatchlist, getCloseWatchStocks, addAlert, getAlerts, saveScanResults, getScanResults, acquireScanLock, releaseScanLock, getScanLockTTL } from "@/lib/store";
import { getMarketStatus, getHistoricalCacheStats } from "@/lib/nse-client";
import { addActivity, setScanMeta } from "@/lib/activity";
import { logger } from "@/lib/logger";
import { checkMa200Touch } from "@/lib/ma200-alert";
import { checkMa100Touch } from "@/lib/ma100-alert";
import { checkMa50Touch } from "@/lib/ma50-alert";
import { checkMa5Touch } from "@/lib/ma5-alert";
import type { Alert, ScanResponse, ScanMeta } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const useIntraday = body.intraday === true;
    const closeWatchOnly = body.closeWatchOnly === true;
    const scanType: "manual" | "auto" = closeWatchOnly ? "auto" : "manual";

    const lockAcquired = await acquireScanLock(scanType);
    if (!lockAcquired) {
      const ttl = await getScanLockTTL(scanType);
      const cachedResults = await getScanResults();
      const cachedAlerts = await getAlerts();
      const response: ScanResponse = {
        results: cachedResults,
        alerts: cachedAlerts,
        scannedAt: new Date().toISOString(),
        marketOpen: false,
        cached: true,
        lockHeld: true,
        lockExpiresIn: ttl,
      };
      return NextResponse.json(response);
    }

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

    for (const result of results) {
      if (result.dataSource !== "live") continue;
      if (!result.yearHigh || result.yearHigh <= 0) continue;
      if (result.todayHigh < result.yearHigh) continue;

      const alert: Alert = {
        id: `${result.symbol}-week-high-${Date.now()}`,
        symbol: result.symbol,
        name: result.name,
        alertType: "week-high",
        todayHigh: result.todayHigh,
        todayVolume: result.todayVolume,
        prevMaxHigh: result.prevMaxHigh,
        prevMaxVolume: result.prevMaxVolume,
        highBreakPercent: result.highBreakPercent,
        volumeBreakPercent: result.volumeBreakPercent,
        todayClose: result.todayClose,
        todayChange: result.todayChange,
        yearHigh: result.yearHigh,
        triggeredAt: result.scannedAt,
        read: false,
      };
      const added = await addAlert(alert);
      if (added) {
        newAlerts.push(alert);
        await addActivity(
          "system",
          "alert-fired",
          `Alert: ${result.symbol} touched 52-week high of ₹${result.yearHigh}`,
          {
            actor: "system",
            detail: { symbol: result.symbol, alertType: "week-high", yearHigh: result.yearHigh, todayHigh: result.todayHigh },
          }
        );
      }
    }

    for (const result of results) {
      if (result.dataSource === "stale") continue;
      if (result.todayClose <= 0) continue;

      const ma200Result = await checkMa200Touch(result.symbol, result.todayClose, result.dataSource);
      if (!ma200Result || !ma200Result.triggered) continue;

      const alert: Alert = {
        id: `${result.symbol}-ma200-touch-${Date.now()}`,
        symbol: result.symbol,
        name: result.name,
        alertType: "ma200-touch",
        todayHigh: result.todayHigh,
        todayVolume: result.todayVolume,
        prevMaxHigh: result.prevMaxHigh,
        prevMaxVolume: result.prevMaxVolume,
        highBreakPercent: result.highBreakPercent,
        volumeBreakPercent: result.volumeBreakPercent,
        todayClose: result.todayClose,
        todayChange: result.todayChange,
        ma200: ma200Result.ma200,
        ma200TouchPercent: ma200Result.touchPercent,
        triggeredAt: result.scannedAt,
        read: false,
      };
      const added = await addAlert(alert);
      if (added) {
        newAlerts.push(alert);
        await addActivity(
          "system",
          "alert-fired",
          `Alert: ${result.symbol} touched 200 DMA at ₹${ma200Result.ma200} (${ma200Result.touchPercent >= 0 ? "+" : ""}${ma200Result.touchPercent}%)`,
          {
            actor: "system",
            detail: { symbol: result.symbol, alertType: "ma200-touch", ma200: ma200Result.ma200, touchPercent: ma200Result.touchPercent, todayClose: result.todayClose },
          }
        );
      }
    }

    for (const result of results) {
      if (result.dataSource === "stale") continue;
      if (result.todayClose <= 0) continue;

      const ma100Result = await checkMa100Touch(result.symbol, result.todayClose, result.dataSource);
      if (!ma100Result || !ma100Result.triggered) continue;

      const alert: Alert = {
        id: `${result.symbol}-ma100-touch-${Date.now()}`,
        symbol: result.symbol,
        name: result.name,
        alertType: "ma100-touch",
        todayHigh: result.todayHigh,
        todayVolume: result.todayVolume,
        prevMaxHigh: result.prevMaxHigh,
        prevMaxVolume: result.prevMaxVolume,
        highBreakPercent: result.highBreakPercent,
        volumeBreakPercent: result.volumeBreakPercent,
        todayClose: result.todayClose,
        todayChange: result.todayChange,
        ma100: ma100Result.ma100,
        ma100TouchPercent: ma100Result.touchPercent,
        triggeredAt: result.scannedAt,
        read: false,
      };
      const added = await addAlert(alert);
      if (added) {
        newAlerts.push(alert);
        await addActivity(
          "system",
          "alert-fired",
          `Alert: ${result.symbol} touched 100 DMA at ₹${ma100Result.ma100} (${ma100Result.touchPercent >= 0 ? "+" : ""}${ma100Result.touchPercent}%)`,
          {
            actor: "system",
            detail: { symbol: result.symbol, alertType: "ma100-touch", ma100: ma100Result.ma100, touchPercent: ma100Result.touchPercent, todayClose: result.todayClose },
          }
        );
      }
    }

    for (const result of results) {
      if (result.dataSource === "stale") continue;
      if (result.todayClose <= 0) continue;

      const ma50Result = await checkMa50Touch(result.symbol, result.todayClose, result.dataSource);
      if (!ma50Result || !ma50Result.triggered) continue;

      const alert: Alert = {
        id: `${result.symbol}-ma50-touch-${Date.now()}`,
        symbol: result.symbol,
        name: result.name,
        alertType: "ma50-touch",
        todayHigh: result.todayHigh,
        todayVolume: result.todayVolume,
        prevMaxHigh: result.prevMaxHigh,
        prevMaxVolume: result.prevMaxVolume,
        highBreakPercent: result.highBreakPercent,
        volumeBreakPercent: result.volumeBreakPercent,
        todayClose: result.todayClose,
        todayChange: result.todayChange,
        ma50: ma50Result.ma50,
        ma50TouchPercent: ma50Result.touchPercent,
        triggeredAt: result.scannedAt,
        read: false,
      };
      const added = await addAlert(alert);
      if (added) {
        newAlerts.push(alert);
        await addActivity(
          "system",
          "alert-fired",
          `Alert: ${result.symbol} touched 50 DMA at ₹${ma50Result.ma50} (${ma50Result.touchPercent >= 0 ? "+" : ""}${ma50Result.touchPercent}%)`,
          {
            actor: "system",
            detail: { symbol: result.symbol, alertType: "ma50-touch", ma50: ma50Result.ma50, touchPercent: ma50Result.touchPercent, todayClose: result.todayClose },
          }
        );
      }
    }

    for (const result of results) {
      if (result.dataSource === "stale") continue;
      if (result.todayClose <= 0) continue;

      const ma5Result = await checkMa5Touch(result.symbol, result.todayClose, result.dataSource);
      if (!ma5Result || !ma5Result.triggered) continue;

      const alert: Alert = {
        id: `${result.symbol}-ma5-touch-${Date.now()}`,
        symbol: result.symbol,
        name: result.name,
        alertType: "ma5-touch",
        todayHigh: result.todayHigh,
        todayVolume: result.todayVolume,
        prevMaxHigh: result.prevMaxHigh,
        prevMaxVolume: result.prevMaxVolume,
        highBreakPercent: result.highBreakPercent,
        volumeBreakPercent: result.volumeBreakPercent,
        todayClose: result.todayClose,
        todayChange: result.todayChange,
        ma5: ma5Result.ma5,
        ma5TouchPercent: ma5Result.touchPercent,
        triggeredAt: result.scannedAt,
        read: false,
      };
      const added = await addAlert(alert);
      if (added) {
        newAlerts.push(alert);
        await addActivity(
          "system",
          "alert-fired",
          `Alert: ${result.symbol} touched 5 DMA at ₹${ma5Result.ma5} (${ma5Result.touchPercent >= 0 ? "+" : ""}${ma5Result.touchPercent}%)`,
          {
            actor: "system",
            detail: { symbol: result.symbol, alertType: "ma5-touch", ma5: ma5Result.ma5, touchPercent: ma5Result.touchPercent, todayClose: result.todayClose },
          }
        );
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
      {
        actor: scanType === "auto" ? "auto-check" : "dad",
        detail: { durationMs: scanDuration, stockCount: results.length, triggeredCount: newAlerts.length, marketOpen, intraday: useIntraday },
        snapshot: { marketOpen, stockCount: results.length, liveCount, historicalCount, staleCount, triggeredCount: newAlerts.length },
      }
    );

    for (const a of newAlerts) {
      await addActivity(
        "system",
        "alert-fired",
        `Alert: ${a.symbol} breakout — high +${a.highBreakPercent}%, vol +${a.volumeBreakPercent}%`,
        {
          actor: "system",
          detail: { symbol: a.symbol, highBreakPercent: a.highBreakPercent, volumeBreakPercent: a.volumeBreakPercent },
          snapshot: { todayHigh: a.todayHigh, prevMaxHigh: a.prevMaxHigh, todayVolume: a.todayVolume, prevMaxVolume: a.prevMaxVolume },
        }
      );
    }

    if (staleCount > 0) {
      const staleSymbols = results.filter((r) => r.dataSource === "stale").map((r) => r.symbol);
      await addActivity(
        "warning",
        "data-stale",
        `${staleCount} stock${staleCount > 1 ? "s" : ""} returned stale data: ${staleSymbols.join(", ")}`,
        { actor: "system", detail: { symbols: staleSymbols, count: staleCount } }
      );
    }

    // Persist scan results so they survive page refreshes
    if (closeWatchOnly) {
      // Merge close-watch results into existing stored results
      const existing = await getScanResults();
      const merged = [...existing];
      for (const r of results) {
        const idx = merged.findIndex((m) => m.symbol === r.symbol);
        if (idx >= 0) merged[idx] = r;
        else merged.push(r);
      }
      await saveScanResults(merged);
    } else {
      await saveScanResults(results);
    }

    const staleRatio = results.length > 0 ? staleCount / results.length : 0;
    let nextPollMs = 30_000;
    if (scanDuration > 10_000 || staleRatio >= 0.5) {
      nextPollMs = 120_000;
    } else if (staleCount > 0) {
      nextPollMs = 60_000;
    }

    const response: ScanResponse = {
      results,
      alerts: await getAlerts(),
      scannedAt: new Date().toISOString(),
      marketOpen,
      cacheStats: getHistoricalCacheStats(),
      nextPollMs,
    };

    await releaseScanLock(scanType);

    logger.info(
      `Scan complete in ${scanDuration}ms — ${results.length} stocks, ${newAlerts.length} new alert(s)`,
      { durationMs: scanDuration, stockCount: results.length, alertCount: newAlerts.length, marketOpen },
      'Scan API',
      `Finished scanning ${results.length} stock(s) in ${(scanDuration / 1000).toFixed(1)} seconds. ${newAlerts.length > 0 ? `${newAlerts.length} stock(s) triggered a breakout alert.` : 'No breakout signals detected this cycle.'} ${marketOpen ? 'Market is currently OPEN.' : 'Market is currently CLOSED.'}`,
    );
    return NextResponse.json(response);
  } catch (error) {
    await releaseScanLock("manual").catch(() => {});
    await releaseScanLock("auto").catch(() => {});
    const message =
      error instanceof Error ? error.message : "Scan failed";
    logger.error(
      `Scan failed: ${message}`,
      { error: message },
      'Scan API',
      `The entire scan cycle failed. Error: "${message}". The system will try again on the next scan cycle.`,
    );

    await addActivity("warning", "scan-error", `Scan failed: ${message}`, { actor: "system", detail: { error: message } }).catch(() => {});

    return NextResponse.json({ error: message, nextPollMs: 180_000 }, { status: 500 });
  }
}
