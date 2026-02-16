import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/nse-client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  try {

    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    logger.api(
      `Searching for stocks matching "${q}"`,
      { query: q },
      'Stock Search',
      `A user searched for "${q}" in the stock search bar. The system is now querying the NSE to find stocks whose name or ticker symbol matches this term.`,
    );
    const results = await searchStocks(q);

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    logger.error(
      `Stock search failed for "${q || '(empty)'}"`,
      { error: message },
      'Stock Search',
      `The stock search couldn't be completed. Error: "${message}". This is usually a temporary issue with the NSE website. Try searching again in a moment.`,
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
