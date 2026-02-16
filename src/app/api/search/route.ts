import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/nse-client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() || "";

    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    logger.api(`GET /api/search?q=${q}`, { query: q }, 'SearchRoute');
    const results = await searchStocks(q);

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    logger.error(`Search failed: ${message}`, { error: message }, 'SearchRoute');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
