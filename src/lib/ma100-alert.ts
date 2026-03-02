import "server-only";
import { getHistoricalData } from "./nse-client";
import type { DataSource } from "./types";

const MA100_DAYS = 100;
const MA100_TOUCH_THRESHOLD_PCT = 1;

export interface Ma100Result {
  ma100: number;
  touchPercent: number;
  triggered: boolean;
}

export async function checkMa100Touch(
  symbol: string,
  currentClose: number,
  dataSource: DataSource
): Promise<Ma100Result | null> {
  if (dataSource === "stale") return null;
  if (currentClose <= 0) return null;

  try {
    const historical = await getHistoricalData(symbol, MA100_DAYS);
    if (historical.length < MA100_DAYS) return null;

    const last100 = historical.slice(-MA100_DAYS);
    const ma100 = last100.reduce((sum, d) => sum + d.close, 0) / MA100_DAYS;
    if (ma100 <= 0) return null;

    const touchPercent = ((currentClose - ma100) / ma100) * 100;
    const triggered = Math.abs(touchPercent) <= MA100_TOUCH_THRESHOLD_PCT;

    return {
      ma100: Math.round(ma100 * 100) / 100,
      touchPercent: Math.round(touchPercent * 100) / 100,
      triggered,
    };
  } catch {
    return null;
  }
}
