import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAlertRequests, addAlertRequest, updateAlertRequestStatus } from "@/lib/alert-requests";
import { addActivity } from "@/lib/activity";
import { createAlertIssue } from "@/lib/github";
import type { AlertRequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const PostSchema = z.object({
  text: z
    .string()
    .min(15, "Alert request must be at least 15 characters")
    .max(500, "Alert request must be at most 500 characters")
    .refine((t) => t.startsWith("Create Alert:"), {
      message: 'Text must start with "Create Alert:"',
    }),
});

export async function GET() {
  try {
    const requests = await getAlertRequests();
    return NextResponse.json(requests);
  } catch {
    return NextResponse.json({ error: "Failed to load alert requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = PostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const alertRequest = {
      id,
      text: parsed.data.text,
      status: "pending" as AlertRequestStatus,
      createdAt: new Date().toISOString(),
    };

    await addAlertRequest(alertRequest);

    await addActivity("user", "alert-request-submitted", parsed.data.text, {
      detail: { requestId: id },
    });

    try {
      const { issueNumber, issueUrl } = await createAlertIssue(alertRequest);
      await updateAlertRequestStatus(id, "issue_created", {
        githubIssueNumber: issueNumber,
        githubIssueUrl: issueUrl,
      });
      alertRequest.status = "issue_created";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateAlertRequestStatus(id, "pending", {
        errorMessage: message,
      });
    }

    return NextResponse.json({ ok: true, request: alertRequest });
  } catch {
    return NextResponse.json({ error: "Failed to create alert request" }, { status: 500 });
  }
}
