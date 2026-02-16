import { NextResponse } from "next/server";
import { addActivity, getActivity } from "@/lib/activity";
import { z } from "zod";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  action: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  cat: z.enum(["user", "system", "warning"]).default("user"),
  detail: z.record(z.unknown()).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "80"), 200);
  const events = await getActivity(limit);
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { cat, action, label, detail } = parsed.data;
    await addActivity(cat, action, label, detail);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
