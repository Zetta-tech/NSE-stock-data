import { NextResponse } from "next/server";
import { getNifty50Snapshot, getMarketStatus } from "@/lib/nse-client";
import { getBaselines, getBaselineStats } from "@/lib/baselines";
import { getWatchlist, getCloseWatchStocks, addAlert, getAlerts, getNifty50PersistentStats, updateNifty50PersistentStats } from "@/lib/store";
import { addActivity } from "@/lib/activity";
import { logger } from "@/lib/logger";
import type {
  BreakoutDiscovery,
  Nifty50TableResponse,
  Alert,
  Nifty50StockRow,
  StockBaseline,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRIMARY_SOURCE_BASELINE_FETCH_LIMIT = 5;
const FALLBACK_SOURCE_BASELINE_FETCH_LIMIT = 0;

function todayIST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )
    .toISOString()
    .slice(0, 10);
}

function isPotentialSignal(stock: Nifty50StockRow, baseline: StockBaseline): boolean {
  const highBreak = stock.dayHigh > baseline.maxHigh5d;
  const volumeBreak = stock.totalTradedVolume >= baseline.maxVolume5d * 3;
  const lowBreak = stock.dayLow < baseline.minLow10d;
  const lowVolumeBreak = stock.totalTradedVolume > baseline.maxVolume10d;
  return (highBreak && volumeBreak) || (lowBreak && lowVolumeBreak);
}

export async function GET() {
  try {
    // Parallel: fetch snapshot, watchlist, market status, and baselines prep
    const [snapshot, watchlist, closeWatchStocks, marketOpen] = await Promise.all([
      getNifty50Snapshot(),
      getWatchlist(),
      getCloseWatchStocks(),
      getMarketStatus().catch(() => false),
    ]);

    const watchlistSymbols = watchlist.map((s) => s.symbol);
    const closeWatchSymbols = closeWatchStocks.map((s) => s.symbol);
    const watchlistSet = new Set(watchlistSymbols);
    const isPrimarySource = snapshot.source === "nse-index";

    // Use cached baselines for fallback sources and hydrate only a small slice for
    // the primary path. Cold-starting all 50 can exceed production duration.
    const snapshotSymbols = snapshot.stocks.map((s) => s.symbol);
    const baselineFetchLimit =
      snapshot.source === "nse-index"
        ? PRIMARY_SOURCE_BASELINE_FETCH_LIMIT
        : FALLBACK_SOURCE_BASELINE_FETCH_LIMIT;
    const baselines = await getBaselines(snapshotSymbols, { maxToFetch: baselineFetchLimit });
    const baseStats = getBaselineStats();

    // Build breakout discoveries for stocks NOT in the watchlist
    const discoveries: BreakoutDiscovery[] = [];
    const today = todayIST();
    const newAlerts: Alert[] = [];

    for (const stock of snapshot.stocks) {
      // Skip stocks already in the watchlist — they have their own scan
      if (watchlistSet.has(stock.symbol)) continue;

      // 52-week high alert (no baseline required — data comes from snapshot)
      if (isPrimarySource && snapshot.fetchSuccess && stock.yearHigh > 0 && stock.dayHigh >= stock.yearHigh) {
        const weekHighAlert: Alert = {
          id: `${stock.symbol}-nifty50-week-high-${today}`,
          symbol: stock.symbol,
          name: stock.name,
          alertType: "week-high",
          todayHigh: stock.dayHigh,
          todayVolume: stock.totalTradedVolume,
          prevMaxHigh: 0,
          prevMaxVolume: 0,
          highBreakPercent: 0,
          volumeBreakPercent: 0,
          todayClose: stock.lastPrice,
          todayChange: stock.pChange,
          yearHigh: stock.yearHigh,
          triggeredAt: new Date().toISOString(),
          read: false,
        };
        const added = await addAlert(weekHighAlert);
        newAlerts.push(weekHighAlert);
        if (added) {
          await addActivity(
            "system",
            "alert-fired",
            `Nifty 50 alert: ${stock.symbol} touched 52-week high of ₹${stock.yearHigh}`,
            {
              actor: "system",
              detail: { source: "nifty50", symbol: stock.symbol, alertType: "week-high", yearHigh: stock.yearHigh, dayHigh: stock.dayHigh },
            },
          );
        }
      }

      const baseline = baselines.get(stock.symbol);

      if (!baseline) {
        // No baseline — can't reliably compute breakout, but flag as possible
        if (stock.lastPrice > 0) {
          discoveries.push({
            symbol: stock.symbol,
            name: stock.name,
            breakout: false,
            highBreak: false,
            volumeBreak: false,
            highBreakPercent: 0,
            volumeBreakPercent: 0,
            baselineUnavailable: true,
            possibleBreakout: false,
          });
        }
        continue;
      }

      // If snapshot freshness/source trust is degraded, only surface plausible
      // candidates as possible; never mark them as confirmed signals.
      if (!snapshot.fetchSuccess) {
        discoveries.push({
          symbol: stock.symbol,
          name: stock.name,
          breakout: false,
          highBreak: false,
          volumeBreak: false,
          highBreakPercent: 0,
          volumeBreakPercent: 0,
          baselineUnavailable: false,
          possibleBreakout: isPotentialSignal(stock, baseline),
        });
        continue;
      }

      if (!isPrimarySource) {
        discoveries.push({
          symbol: stock.symbol,
          name: stock.name,
          breakout: false,
          highBreak: false,
          volumeBreak: false,
          highBreakPercent: 0,
          volumeBreakPercent: 0,
          baselineUnavailable: false,
          possibleBreakout: isPotentialSignal(stock, baseline),
        });
        continue;
      }

      const highBreak = stock.dayHigh > baseline.maxHigh5d;
      const volumeThreshold = baseline.maxVolume5d * 3;
      const volumeBreak = stock.totalTradedVolume >= volumeThreshold;
      const breakout = highBreak && volumeBreak;

      const highBreakPercent = baseline.maxHigh5d > 0
        ? Math.round(((stock.dayHigh - baseline.maxHigh5d) / baseline.maxHigh5d) * 10000) / 100
        : 0;
      const volumeBreakPercent = volumeThreshold > 0
        ? Math.round(((stock.totalTradedVolume - volumeThreshold) / volumeThreshold) * 10000) / 100
        : 0;

      discoveries.push({
        symbol: stock.symbol,
        name: stock.name,
        breakout,
        highBreak,
        volumeBreak,
        highBreakPercent,
        volumeBreakPercent,
        baselineUnavailable: false,
        possibleBreakout: false,
      });

      // Fire alert for confirmed breakouts (dedup by symbol + alertType + date)
      if (isPrimarySource && breakout) {
        const alertId = `${stock.symbol}-nifty50-breakout-${today}`;
        const alert: Alert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: "breakout",
          todayHigh: stock.dayHigh,
          todayVolume: stock.totalTradedVolume,
          prevMaxHigh: baseline.maxHigh5d,
          prevMaxVolume: baseline.maxVolume5d,
          highBreakPercent,
          volumeBreakPercent,
          todayClose: stock.lastPrice,
          todayChange: stock.pChange,
          prev10DayLow: 0,
          lowBreakPercent: 0,
          triggeredAt: new Date().toISOString(),
          read: false,
        };
        const added = await addAlert(alert);
        newAlerts.push(alert);

        // Log each new alert as an activity event (separate from discovery summary)
        if (added) {
          await addActivity(
            "system",
            "alert-fired",
            `Nifty 50 alert: ${stock.symbol} breakout — High +${highBreakPercent}%, Vol +${volumeBreakPercent}%`,
            {
              actor: "system",
              detail: {
                source: "nifty50",
                symbol: stock.symbol,
                highBreakPercent,
                volumeBreakPercent,
                todayHigh: stock.dayHigh,
                todayVolume: stock.totalTradedVolume,
                prevMaxHigh: baseline.maxHigh5d,
                prevMaxVolume: baseline.maxVolume5d,
              },
            },
          );
        }
      }

      const lowBreak = stock.dayLow < baseline.minLow10d;
      const volumeBreak10d = stock.totalTradedVolume > baseline.maxVolume10d;

      if (isPrimarySource && lowBreak && volumeBreak10d) {
        const lowBreakPct = baseline.minLow10d > 0
          ? Math.round(((baseline.minLow10d - stock.dayLow) / baseline.minLow10d) * 10000) / 100
          : 0;
        const volBreakPct10d = baseline.maxVolume10d > 0
          ? Math.round(((stock.totalTradedVolume - baseline.maxVolume10d) / baseline.maxVolume10d) * 10000) / 100
          : 0;

        const alertId = `${stock.symbol}-nifty50-low-breakout-${today}`;
        const alert: Alert = {
          id: alertId,
          symbol: stock.symbol,
          name: stock.name,
          alertType: "low-breakout",
          todayHigh: stock.dayHigh,
          todayVolume: stock.totalTradedVolume,
          prevMaxHigh: baseline.maxHigh5d,
          prevMaxVolume: baseline.maxVolume5d,
          highBreakPercent: 0,
          volumeBreakPercent: volBreakPct10d,
          todayClose: stock.lastPrice,
          todayChange: stock.pChange,
          prev10DayLow: baseline.minLow10d,
          lowBreakPercent: lowBreakPct,
          triggeredAt: new Date().toISOString(),
          read: false,
        };
        const added = await addAlert(alert);
        newAlerts.push(alert);

        if (added) {
          await addActivity(
            "system",
            "alert-fired",
            `Nifty 50 alert: ${stock.symbol} low breakdown — Low -${lowBreakPct}%, Vol +${volBreakPct10d}%`,
            {
              actor: "system",
              detail: {
                source: "nifty50",
                symbol: stock.symbol,
                alertType: "low-breakout",
                dayLow: stock.dayLow,
                prev10DayLow: baseline.minLow10d,
                lowBreakPercent: lowBreakPct,
                volumeBreakPercent: volBreakPct10d,
                todayVolume: stock.totalTradedVolume,
                maxVolume10d: baseline.maxVolume10d,
              },
            },
          );
        }
      }
    }

    // Activity tracking for discoveries
    const breakoutCount = discoveries.filter((d) => d.breakout).length;
    const highBreakOnly = discoveries.filter((d) => d.highBreak && !d.breakout).length;
    const volBreakOnly = discoveries.filter((d) => d.volumeBreak && !d.breakout).length;

    if (breakoutCount > 0 || highBreakOnly > 0 || volBreakOnly > 0) {
      const breakoutSymbols = discoveries.filter((d) => d.breakout).map((d) => d.symbol);
      const highBreakSymbols = discoveries.filter((d) => d.highBreak && !d.breakout).map((d) => d.symbol);
      const volBreakSymbols = discoveries.filter((d) => d.volumeBreak && !d.breakout).map((d) => d.symbol);
      const allSignalSymbols = [...breakoutSymbols, ...highBreakSymbols, ...volBreakSymbols];
      const parts: string[] = [];
      if (breakoutCount > 0) parts.push(`${breakoutCount} breakout(s) — ${breakoutSymbols.join(", ")}`);
      if (highBreakOnly > 0) parts.push(`${highBreakOnly} high-only break(s) — ${highBreakSymbols.join(", ")}`);
      if (volBreakOnly > 0) parts.push(`${volBreakOnly} volume-only break(s) — ${volBreakSymbols.join(", ")}`);

      await addActivity(
        "system",
        "nifty50-discovery",
        `Nifty 50 scan: ${parts.join(", ")}`,
        {
          actor: "system",
          detail: {
            breakoutCount,
            highBreakOnly,
            volBreakOnly,
            symbols: allSignalSymbols,
            breakoutSymbols,
            highBreakSymbols,
            volBreakSymbols,
            snapshotStale: snapshot.stale,
            snapshotSource: snapshot.source,
            alertsCreated: newAlerts.length,
          },
        },
      );
    }

    // Persist stats for dev dashboard (survives across Lambda boundaries)
    const prevStats = await getNifty50PersistentStats();
    await updateNifty50PersistentStats({
      lastRefreshTime: snapshot.fetchedAt,
      snapshotFetchSuccess: snapshot.fetchSuccess,
      snapshotFetchCount: prevStats.snapshotFetchCount + (snapshot.fetchSuccess ? 1 : 0),
      snapshotFailCount: prevStats.snapshotFailCount + (snapshot.fetchSuccess ? 0 : 1),
      snapshotSource: snapshot.source,
    });

    const response: Nifty50TableResponse = {
      snapshot,
      discoveries,
      baselineStatus: {
        available: baseStats.available,
        missing: baseStats.missing,
        date: baseStats.date,
      },
      watchlistSymbols,
      closeWatchSymbols,
      marketOpen,
      newAlertCount: newAlerts.length,
    };

    logger.debug(
      `Nifty 50 table: ${snapshot.stocks.length} stocks, ${discoveries.length} non-watchlist, ${breakoutCount} breakout(s)`,
      {
        stockCount: snapshot.stocks.length,
        discoveryCount: discoveries.length,
        breakoutCount,
        fetchSuccess: snapshot.fetchSuccess,
        stale: snapshot.stale,
        source: snapshot.source,
        baselineFetchLimit,
      },
      "Nifty50 Table API",
    );

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nifty 50 fetch failed";
    logger.error(
      `Nifty 50 table API failed: ${message}`,
      { error: message },
      "Nifty50 Table API",
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
