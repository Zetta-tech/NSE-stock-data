import { NextResponse } from "next/server";
import { getCanonicalChartData, warmupRemainingYears } from "@/lib/chart-store";
import { aggregateToWeekly, aggregateToMonthly } from "@/lib/chart-aggregations";
import { after } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") || "1Y"; // 1M, 3M, 1Y, 5Y, MAX
  const interval = searchParams.get("interval") || "1D"; // 1D, 1W, 1M

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  // 1. Fetch canonical data (this covers up to latest, gap-filling if necessary)
  let rawData = await getCanonicalChartData(symbol);
  
  if (rawData.length === 0) {
    return NextResponse.json({ error: "Data unavailable" }, { status: 404 });
  }

  // 2. Trigger Async cache warming if it looks like a cold-start (less than 400 days in our cache)
  if (rawData.length < 400) {
    after(() => {
      warmupRemainingYears(symbol, rawData[0].date).catch(console.error);
    });
  }

  // 3. Filter by Range
  const cutoffDate = new Date();
  switch (range.toUpperCase()) {
    case "1M":
      cutoffDate.setMonth(cutoffDate.getMonth() - 1);
      break;
    case "3M":
      cutoffDate.setMonth(cutoffDate.getMonth() - 3);
      break;
    case "1Y":
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      break;
    case "5Y":
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);
      break;
    case "MAX":
    default:
      cutoffDate.setTime(0); // All time
      break;
  }
  
  const cutOffTime = cutoffDate.getTime();
  let filtered = rawData.filter(d => new Date(d.date).getTime() >= cutOffTime);

  // 4. Group by Interval
  switch (interval.toUpperCase()) {
    case "1W":
    case "W":
      filtered = aggregateToWeekly(filtered);
      break;
    case "1M":
    case "M":
      filtered = aggregateToMonthly(filtered);
      break;
    default: // 1D
      break;
  }

  const isCachingSafe = rawData.length > 500 || ["1M", "3M", "1Y"].includes(range.toUpperCase());

  return NextResponse.json(filtered, {
    headers: {
      "Cache-Control": isCachingSafe
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "no-store, max-age=0",
    },
  });
}
