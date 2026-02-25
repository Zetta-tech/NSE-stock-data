import { NextRequest, NextResponse } from "next/server";

async function sessionToken(): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.AUTH_SECRET ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(process.env.AUTH_PASSWORD ?? ""),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// POST /api/auth — validate credentials and set session cookie
export async function POST(request: NextRequest) {
  // Fail closed: refuse to issue a session if auth env vars are not configured
  if (
    !process.env.AUTH_USERNAME ||
    !process.env.AUTH_PASSWORD ||
    !process.env.AUTH_SECRET
  ) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const { username, password } = await request.json();

  if (
    username !== process.env.AUTH_USERNAME ||
    password !== process.env.AUTH_PASSWORD
  ) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", await sessionToken(), {
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
