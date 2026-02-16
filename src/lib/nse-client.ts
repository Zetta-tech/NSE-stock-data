import "server-only";
import { NseIndia } from "stock-nse-india";
import type { DayData } from "./types";

let nseInstance: NseIndia | null = null;

function getNse(): NseIndia {
  if (!nseInstance) {
    nseInstance = new NseIndia();
  }
  return nseInstance;
}

export async function getHistoricalData(
  symbol: string,
  days: number = 10
): Promise<DayData[]> {
  const nse = getNse();
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days * 2);

  const raw = await nse.getEquityHistoricalData(symbol, { start, end });

  const records = raw.flatMap((entry) => entry.data);

  return records
    .map((r) => ({
      date: r.mtimestamp,
      high: r.chTradeHighPrice,
      low: r.chTradeLowPrice,
      open: r.chOpeningPrice,
      close: r.chClosingPrice,
      volume: r.chTotTradedQty,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function getCurrentDayData(
  symbol: string
): Promise<{ high: number; volume: number; close: number; change: number } | null> {
  const nse = getNse();

  try {
    const [details, tradeInfo] = await Promise.all([
      nse.getEquityDetails(symbol),
      nse.getEquityTradeInfo(symbol),
    ]);

    const high = details.priceInfo.intraDayHighLow.max;
    const close = details.priceInfo.lastPrice || details.priceInfo.close;
    const change = details.priceInfo.pChange;
    const volume =
      tradeInfo.marketDeptOrderBook.tradeInfo.totalTradedVolume;

    return { high, volume, close, change };
  } catch {
    return null;
  }
}

export async function getMarketStatus(): Promise<boolean> {
  const nse = getNse();
  try {
    const status = await nse.getMarketStatus();
    return status.marketState.some(
      (s) =>
        s.market === "Capital Market" &&
        s.marketStatus.toLowerCase().includes("open")
    );
  } catch {
    return false;
  }
}
