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
export const maxDuration = 10;

export async function GET() {
  const [watchlist, alerts] = await Promise.all([
    getWatchlist(),
    getAlerts(),
  ]);
  return NextResponse.json({ watchlist, alerts });
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
      const watchlist = await addToWatchlist({
        symbol: parsed.data.symbol,
        name: parsed.data.name,
        closeWatch: false,
      });
      logger.info(`Watchlist ADD: ${parsed.data.symbol}`, { symbol: parsed.data.symbol, name: parsed.data.name }, 'StocksRoute');
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
      const watchlist = await removeFromWatchlist(parsed.data.symbol);
      logger.info(`Watchlist REMOVE: ${parsed.data.symbol}`, { symbol: parsed.data.symbol }, 'StocksRoute');
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
      const watchlist = await toggleCloseWatch(parsed.data.symbol);
      logger.info(`CloseWatch TOGGLE: ${parsed.data.symbol}`, { symbol: parsed.data.symbol }, 'StocksRoute');
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
        await markAlertRead(parsed.data.alertId);
      } else {
        await markAllAlertsRead();
      }
      return NextResponse.json({ alerts: await getAlerts() });
    }

    logger.warn(`Unknown action attempted`, { action: body?.action }, 'StocksRoute');
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logger.error(`Stocks route error`, { error }, 'StocksRoute');
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
