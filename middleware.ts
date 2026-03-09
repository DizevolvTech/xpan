import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  getRoleForPath,
  roleHomePath,
  type UserRole,
} from "@/lib/auth";
import { createSupabaseRequestClient } from "@/lib/supabase-request-client";

function resolveRoleFromAuthUser(user: User | null): UserRole | null {
  const metadataRole = user?.user_metadata?.role ?? user?.app_metadata?.role;

  if (typeof metadataRole !== "string") {
    return null;
  }

  const role = metadataRole as UserRole;
  return role in roleHomePath ? role : null;
}

function buildRedirectResponse(
  request: NextRequest,
  pathname: string,
  applyResponseCookies: (response: NextResponse) => NextResponse,
) {
  return applyResponseCookies(NextResponse.redirect(new URL(pathname, request.url)));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const { supabase, applyResponseCookies } = createSupabaseRequestClient(request);
  const authResult = await supabase.auth.getUser();
  const supabaseRole = resolveRoleFromAuthUser(authResult.data.user);
  const role = supabaseRole;

  if (pathname === "/") {
    return buildRedirectResponse(request, role ? roleHomePath[role] : "/login", applyResponseCookies);
  }

  if (pathname === "/login") {
    if (role) {
      return buildRedirectResponse(request, roleHomePath[role], applyResponseCookies);
    }

    return applyResponseCookies(NextResponse.next());
  }

  const requiredRole = getRoleForPath(pathname);
  if (!requiredRole) {
    return applyResponseCookies(NextResponse.next());
  }

  if (!role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return applyResponseCookies(NextResponse.redirect(loginUrl));
  }

  if (role === "administrador") {
    return applyResponseCookies(NextResponse.next());
  }

  if (requiredRole !== role) {
    return buildRedirectResponse(request, roleHomePath[role], applyResponseCookies);
  }

  return applyResponseCookies(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
