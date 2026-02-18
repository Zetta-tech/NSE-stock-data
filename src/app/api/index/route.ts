import { NextResponse } from "next/server";
import { getNifty50Index } from "@/lib/nse-client";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  try {
    const nifty = await getNifty50Index();
    if (!nifty) {
      return NextResponse.json({ error: "Unavailable" }, { status: 503 });
    }
    return NextResponse.json(nifty);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Index fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
