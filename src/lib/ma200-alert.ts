import "server-only";
import { getHistoricalData } from "./nse-client";
import type { DataSource } from "./types";

const MA200_DAYS = 200;
const MA200_TOUCH_THRESHOLD_PCT = 1;

export interface Ma200Result {
  ma200: number;
  touchPercent: number;
  triggered: boolean;
}

export async function checkMa200Touch(
  symbol: string,
  currentClose: number,
  dataSource: DataSource
): Promise<Ma200Result | null> {
  if (dataSource === "stale") return null;
  if (currentClose <= 0) return null;

  try {
    const historical = await getHistoricalData(symbol, MA200_DAYS);
    if (historical.length < MA200_DAYS) return null;

    const last200 = historical.slice(-MA200_DAYS);
    const ma200 = last200.reduce((sum, d) => sum + d.close, 0) / MA200_DAYS;
    if (ma200 <= 0) return null;

    const touchPercent = ((currentClose - ma200) / ma200) * 100;
    const triggered = Math.abs(touchPercent) <= MA200_TOUCH_THRESHOLD_PCT;

    return {
      ma200: Math.round(ma200 * 100) / 100,
      touchPercent: Math.round(touchPercent * 100) / 100,
      triggered,
    };
  } catch {
    return null;
  }
}
