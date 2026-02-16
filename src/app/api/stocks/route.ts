import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
} from "@/lib/store";

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
      });
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

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
