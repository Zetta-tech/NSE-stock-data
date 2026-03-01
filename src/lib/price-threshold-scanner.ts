import "server-only";
import { getCurrentDayData, getHistoricalData } from "./nse-client";
import type { DataSource } from "./types";
import type { PriceThresholdConfig } from "./price-thresholds";

export interface PriceThresholdResult {
  symbol: string;
  name: string;
  threshold: number;
  direction: "below" | "above";
  currentPrice: number;
  currentChange: number;
  triggered: boolean;
  dataSource: DataSource;
}

export async function checkPriceThreshold(
  config: PriceThresholdConfig,
  useIntraday: boolean,
  marketOpen: boolean
): Promise<PriceThresholdResult> {
  const { symbol, name, threshold, direction } = config;
  let currentPrice = 0;
  let currentChange = 0;
  let dataSource: DataSource = "historical";

  if (useIntraday) {
    const live = await getCurrentDayData(symbol);
    if (live && live.close > 0) {
      currentPrice = live.close;
      currentChange = live.change;
      dataSource = "live";
    } else {
      const hist = await getHistoricalData(symbol, 5);
      if (hist.length > 0) {
        const last = hist[hist.length - 1];
        currentPrice = last.close;
        dataSource = marketOpen ? "stale" : "historical";
      }
    }
  } else {
    const hist = await getHistoricalData(symbol, 5);
    if (hist.length > 0) {
      const last = hist[hist.length - 1];
      const prev = hist.length > 1 ? hist[hist.length - 2] : null;
      currentPrice = last.close;
      currentChange =
        prev && prev.close > 0
          ? ((last.close - prev.close) / prev.close) * 100
          : 0;
    }
  }

  const crossed =
    dataSource !== "stale" &&
    currentPrice > 0 &&
    (direction === "below"
      ? currentPrice < threshold
      : currentPrice > threshold);

  return {
    symbol,
    name,
    threshold,
    direction,
    currentPrice,
    currentChange: Math.round(currentChange * 100) / 100,
    triggered: crossed,
    dataSource,
  };
}

export async function checkAllPriceThresholds(
  configs: PriceThresholdConfig[],
  useIntraday: boolean,
  marketOpen: boolean
): Promise<PriceThresholdResult[]> {
  const results = await Promise.allSettled(
    configs.map((c) => checkPriceThreshold(c, useIntraday, marketOpen))
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          symbol: configs[i].symbol,
          name: configs[i].name,
          threshold: configs[i].threshold,
          direction: configs[i].direction,
          currentPrice: 0,
          currentChange: 0,
          triggered: false,
          dataSource: "historical" as DataSource,
        }
  );
}
