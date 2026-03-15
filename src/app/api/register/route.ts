import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addRegistration } from "@/lib/registrations";

export const dynamic = "force-dynamic";

const RegisterSchema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const { registration, isNew } = await addRegistration(
      parsed.data.email,
      parsed.data.source
    );

    return NextResponse.json({
      ok: true,
      isNew,
      registeredAt: registration.registeredAt,
    });
  } catch {
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
