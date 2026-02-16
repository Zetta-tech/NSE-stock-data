import { NextResponse } from "next/server";
import { scanMultipleStocks } from "@/lib/scanner";
import { getWatchlist, addAlert, getAlerts } from "@/lib/store";
import { getMarketStatus } from "@/lib/nse-client";
import type { Alert, ScanResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const useIntraday = body.intraday === true;

    const watchlist = getWatchlist();
    const marketOpen = await getMarketStatus().catch(() => false);

    const results = await scanMultipleStocks(watchlist, useIntraday);

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
        addAlert(alert);
        newAlerts.push(alert);
      }
    }

    const response: ScanResponse = {
      results,
      alerts: getAlerts(),
      scannedAt: new Date().toISOString(),
      marketOpen,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
