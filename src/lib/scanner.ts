import "server-only";
import { getHistoricalData, getCurrentDayData } from "./nse-client";
import type { ScanResult, DayData } from "./types";

const LOOKBACK_DAYS = 5;

function analyzeBreakout(
  today: { high: number; volume: number; close: number; change: number },
  previousDays: DayData[]
): Omit<ScanResult, "symbol" | "name" | "scannedAt"> {
  const prevMaxHigh = Math.max(...previousDays.map((d) => d.high));
  const prevMaxVolume = Math.max(...previousDays.map((d) => d.volume));

  const highBreak = today.high > prevMaxHigh;
  const volumeBreak = today.volume > prevMaxVolume;

  const highBreakPercent =
    prevMaxHigh > 0 ? ((today.high - prevMaxHigh) / prevMaxHigh) * 100 : 0;
  const volumeBreakPercent =
    prevMaxVolume > 0
      ? ((today.volume - prevMaxVolume) / prevMaxVolume) * 100
      : 0;

  return {
    triggered: highBreak && volumeBreak,
    todayHigh: today.high,
    todayVolume: today.volume,
    prevMaxHigh,
    prevMaxVolume,
    highBreakPercent: Math.round(highBreakPercent * 100) / 100,
    volumeBreakPercent: Math.round(volumeBreakPercent * 100) / 100,
    todayClose: today.close,
    todayChange: Math.round(today.change * 100) / 100,
  };
}

export async function scanStock(
  symbol: string,
  name: string,
  useIntraday: boolean = false
): Promise<ScanResult> {
  const scannedAt = new Date().toISOString();

  try {
    const historical = await getHistoricalData(symbol, 15);

    if (historical.length < LOOKBACK_DAYS + 1) {
      throw new Error(
        `Insufficient historical data for ${symbol}: got ${historical.length} days`
      );
    }

    let todayData: {
      high: number;
      volume: number;
      close: number;
      change: number;
    };
    let previousDays: DayData[];

    if (useIntraday) {
      const liveDayData = await getCurrentDayData(symbol);

      if (liveDayData && liveDayData.high > 0) {
        todayData = liveDayData;
        previousDays = historical.slice(-LOOKBACK_DAYS);
      } else {
        const lastDay = historical[historical.length - 1];
        todayData = {
          high: lastDay.high,
          volume: lastDay.volume,
          close: lastDay.close,
          change: 0,
        };
        previousDays = historical.slice(
          -(LOOKBACK_DAYS + 1),
          -1
        );
      }
    } else {
      const lastDay = historical[historical.length - 1];
      todayData = {
        high: lastDay.high,
        volume: lastDay.volume,
        close: lastDay.close,
        change:
          lastDay.close > 0 && historical.length > 1
            ? ((lastDay.close - historical[historical.length - 2].close) /
                historical[historical.length - 2].close) *
              100
            : 0,
      };
      previousDays = historical.slice(-(LOOKBACK_DAYS + 1), -1);
    }

    const analysis = analyzeBreakout(todayData, previousDays);

    return { symbol, name, scannedAt, ...analysis };
  } catch (error) {
    return {
      symbol,
      name,
      triggered: false,
      todayHigh: 0,
      todayVolume: 0,
      prevMaxHigh: 0,
      prevMaxVolume: 0,
      highBreakPercent: 0,
      volumeBreakPercent: 0,
      todayClose: 0,
      todayChange: 0,
      scannedAt,
    };
  }
}

export async function scanMultipleStocks(
  stocks: { symbol: string; name: string }[],
  useIntraday: boolean = false
): Promise<ScanResult[]> {
  const results = await Promise.allSettled(
    stocks.map((s) => scanStock(s.symbol, s.name, useIntraday))
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          symbol: stocks[i].symbol,
          name: stocks[i].name,
          triggered: false,
          todayHigh: 0,
          todayVolume: 0,
          prevMaxHigh: 0,
          prevMaxVolume: 0,
          highBreakPercent: 0,
          volumeBreakPercent: 0,
          todayClose: 0,
          todayChange: 0,
          scannedAt: new Date().toISOString(),
        }
  );
}
