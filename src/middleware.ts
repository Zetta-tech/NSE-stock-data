import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

function expectedToken() {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update(process.env.AUTH_PASSWORD ?? "")
    .digest("hex");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let the login page and auth API through unauthenticated
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const session = request.cookies.get("session")?.value;
  if (session !== expectedToken()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
