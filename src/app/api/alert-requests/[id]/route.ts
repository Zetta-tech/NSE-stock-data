import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateAlertRequestStatus } from "@/lib/alert-requests";
import { addActivity } from "@/lib/activity";
import type { AlertRequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const FINAL_STATUSES = new Set<AlertRequestStatus>(["implemented", "rejected"]);

const PatchSchema = z.object({
  status: z.enum(["pending", "issue_created", "pr_created", "implemented", "rejected"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { status } = parsed.data;
    const { id } = params;

    await updateAlertRequestStatus(id, status as AlertRequestStatus);

    await addActivity("system", `alert-request-${status}`, `Alert request manually marked ${status}`, {
      detail: { requestId: id },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update alert request" }, { status: 500 });
  }
}
