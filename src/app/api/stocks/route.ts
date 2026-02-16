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
import { addActivity } from "@/lib/activity";
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
      logger.info(
        `Added ${parsed.data.name} (${parsed.data.symbol}) to watchlist`,
        { symbol: parsed.data.symbol, name: parsed.data.name },
        'Watchlist',
        `"${parsed.data.name}" has been added to your watchlist. It will now be included in every scan cycle.`,
      );
      await addActivity("user", "stock-added", `Added ${parsed.data.symbol} to watchlist`, { symbol: parsed.data.symbol, name: parsed.data.name });
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
      logger.info(
        `Removed ${parsed.data.symbol} from watchlist`,
        { symbol: parsed.data.symbol },
        'Watchlist',
        `"${parsed.data.symbol}" has been removed from your watchlist. It will no longer be scanned.`,
      );
      await addActivity("user", "stock-removed", `Removed ${parsed.data.symbol} from watchlist`, { symbol: parsed.data.symbol });
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
      const isNowWatching = watchlist.find((s) => s.symbol === parsed.data.symbol)?.closeWatch ?? false;
      logger.info(
        `${isNowWatching ? 'Starred' : 'Unstarred'} ${parsed.data.symbol} for Close Watch`,
        { symbol: parsed.data.symbol, closeWatch: isNowWatching },
        'Watchlist',
        `${parsed.data.symbol} is ${isNowWatching ? 'now on' : 'no longer on'} Close Watch. ${isNowWatching ? 'It will appear in the live ticker and can be auto-scanned.' : ''}`,
      );
      await addActivity(
        "user",
        isNowWatching ? "closewatch-on" : "closewatch-off",
        `${isNowWatching ? "Starred" : "Unstarred"} ${parsed.data.symbol} for close watch`,
        { symbol: parsed.data.symbol, closeWatch: isNowWatching }
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
        await markAlertRead(parsed.data.alertId);
      } else {
        await markAllAlertsRead();
      }
      return NextResponse.json({ alerts: await getAlerts() });
    }

    logger.warn(
      `Unknown action: "${body?.action || '(none)'}"`,
      { action: body?.action },
      'Watchlist',
      `The system received an unrecognised action type. The request was ignored.`,
    );
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logger.error(
      `Watchlist request failed`,
      { error },
      'Watchlist',
      `A request to modify the watchlist couldn't be processed. No changes were made.`,
    );
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
