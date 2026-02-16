import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  toggleCloseWatch,
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
} from "@/lib/store";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    watchlist: getWatchlist(),
    alerts: getAlerts(),
  });
}

const addStockSchema = z.object({
  action: z.literal("add"),
  symbol: z
    .string()
    .min(1)
    .transform((s) => s.toUpperCase().trim()),
  name: z.string().min(1).trim(),
});

const removeStockSchema = z.object({
  action: z.literal("remove"),
  symbol: z
    .string()
    .min(1)
    .transform((s) => s.toUpperCase().trim()),
});

const toggleCloseWatchSchema = z.object({
  action: z.literal("toggleCloseWatch"),
  symbol: z
    .string()
    .min(1)
    .transform((s) => s.toUpperCase().trim()),
});

const markReadSchema = z.object({
  action: z.literal("markRead"),
  alertId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "add") {
      const parsed = addStockSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const watchlist = addToWatchlist({
        symbol: parsed.data.symbol,
        name: parsed.data.name,
        closeWatch: false,
      });
      logger.info(
        `Added ${parsed.data.name} (${parsed.data.symbol}) to watchlist`,
        { symbol: parsed.data.symbol, name: parsed.data.name },
        'Watchlist',
        `"${parsed.data.name}" has been added to your watchlist. It will now be included in every scan cycle. You'll receive a breakout alert if its price and volume both exceed recent highs.`,
      );
      return NextResponse.json({ watchlist });
    }

    if (body.action === "remove") {
      const parsed = removeStockSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const watchlist = removeFromWatchlist(parsed.data.symbol);
      logger.info(
        `Removed ${parsed.data.symbol} from watchlist`,
        { symbol: parsed.data.symbol },
        'Watchlist',
        `"${parsed.data.symbol}" has been removed from your watchlist. It will no longer be scanned for breakout signals.`,
      );
      return NextResponse.json({ watchlist });
    }

    if (body.action === "toggleCloseWatch") {
      const parsed = toggleCloseWatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const watchlist = toggleCloseWatch(parsed.data.symbol);
      logger.info(
        `Toggled Close Watch for ${parsed.data.symbol}`,
        { symbol: parsed.data.symbol },
        'Watchlist',
        `The "Close Watch" status for ${parsed.data.symbol} has been toggled. Stocks on Close Watch appear in the live ticker at the top of the dashboard and can be scanned separately for quick checks.`,
      );
      return NextResponse.json({ watchlist });
    }

    if (body.action === "markRead") {
      const parsed = markReadSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten() },
          { status: 400 }
        );
      }
      if (parsed.data.alertId) {
        markAlertRead(parsed.data.alertId);
      } else {
        markAllAlertsRead();
      }
      return NextResponse.json({ alerts: getAlerts() });
    }

    logger.warn(
      `Unknown action: "${body?.action || '(none)'}"`,
      { action: body?.action },
      'Watchlist',
      `The system received a request with an unrecognised action type. This usually indicates a bug in the frontend code or an outdated browser cache. The request was ignored.`,
    );
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logger.error(
      `Watchlist request failed`,
      { error },
      'Watchlist',
      `A request to modify the watchlist couldn't be processed. This is usually caused by malformed data being sent. No changes were made to your watchlist.`,
    );
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
