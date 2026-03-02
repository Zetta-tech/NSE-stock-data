import "server-only";
import { getHistoricalData } from "./nse-client";
import type { DataSource } from "./types";

const MA50_DAYS = 50;
const MA50_TOUCH_THRESHOLD_PCT = 1;

export interface Ma50Result {
  ma50: number;
  touchPercent: number;
  triggered: boolean;
}

export async function checkMa50Touch(
  symbol: string,
  currentClose: number,
  dataSource: DataSource
): Promise<Ma50Result | null> {
  if (dataSource === "stale") return null;
  if (currentClose <= 0) return null;

  try {
    const historical = await getHistoricalData(symbol, MA50_DAYS);
    if (historical.length < MA50_DAYS) return null;

    const last50 = historical.slice(-MA50_DAYS);
    const ma50 = last50.reduce((sum, d) => sum + d.close, 0) / MA50_DAYS;
    if (ma50 <= 0) return null;

    const touchPercent = ((currentClose - ma50) / ma50) * 100;
    const triggered = Math.abs(touchPercent) <= MA50_TOUCH_THRESHOLD_PCT;

    return {
      ma50: Math.round(ma50 * 100) / 100,
      touchPercent: Math.round(touchPercent * 100) / 100,
      triggered,
    };
  } catch {
    return null;
  }
}
