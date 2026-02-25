import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

function sessionToken() {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(process.env.AUTH_PASSWORD ?? "")
    .digest("hex");
}

// POST /api/auth — validate credentials and set session cookie
export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (
    username !== process.env.AUTH_USERNAME ||
    password !== process.env.AUTH_PASSWORD
  ) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}

// DELETE /api/auth — clear session cookie (logout)
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("session");
  return response;
}
