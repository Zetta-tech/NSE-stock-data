import "server-only";
import { getHistoricalData } from "./nse-client";
import type { DataSource } from "./types";

const MA5_DAYS = 5;
const MA5_TOUCH_THRESHOLD_PCT = 1;

export interface Ma5Result {
  ma5: number;
  touchPercent: number;
  triggered: boolean;
}

export async function checkMa5Touch(
  symbol: string,
  currentClose: number,
  dataSource: DataSource
): Promise<Ma5Result | null> {
  if (dataSource === "stale") return null;
  if (currentClose <= 0) return null;

  try {
    const historical = await getHistoricalData(symbol, MA5_DAYS);
    if (historical.length < MA5_DAYS) return null;

    const last5 = historical.slice(-MA5_DAYS);
    const ma5 = last5.reduce((sum, d) => sum + d.close, 0) / MA5_DAYS;
    if (ma5 <= 0) return null;

    const touchPercent = ((currentClose - ma5) / ma5) * 100;
    const triggered = Math.abs(touchPercent) <= MA5_TOUCH_THRESHOLD_PCT;

    return {
      ma5: Math.round(ma5 * 100) / 100,
      touchPercent: Math.round(touchPercent * 100) / 100,
      triggered,
    };
  } catch {
    return null;
  }
}
