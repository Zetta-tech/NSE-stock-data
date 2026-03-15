import { NextResponse } from "next/server";
import { getRegistrations } from "@/lib/registrations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const registrations = await getRegistrations();
    return NextResponse.json({
      registrations,
      count: registrations.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load registrations" },
      { status: 500 }
    );
  }
}
