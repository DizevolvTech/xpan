import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE_NAME,
  decodeSession,
  getRoleForPath,
  roleHomePath,
} from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSession(sessionToken);
  const role = session?.role;

  if (pathname === "/") {
    return NextResponse.redirect(new URL(role ? roleHomePath[role] : "/login", request.url));
  }

  if (pathname === "/login") {
    if (role) {
      return NextResponse.redirect(new URL(roleHomePath[role], request.url));
    }
    return NextResponse.next();
  }

  const requiredRole = getRoleForPath(pathname);
  if (!requiredRole) {
    return NextResponse.next();
  }

  if (!role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (role === "administrador") {
    return NextResponse.next();
  }

  if (requiredRole !== role) {
    return NextResponse.redirect(new URL(roleHomePath[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
