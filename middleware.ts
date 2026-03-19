import { NextResponse, type NextRequest } from "next/server";

import { logMiddlewareRedirect } from "@/lib/access-audit";
import { resolveMiddlewareRouting } from "@/lib/middleware-routing";
import { createSupabaseRequestClient } from "@/lib/supabase-request-client";

function buildNextResponse(
  request: NextRequest,
  applyResponseCookies: (response: NextResponse) => NextResponse,
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-app-pathname", request.nextUrl.pathname);

  return applyResponseCookies(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const { supabase, applyResponseCookies } = createSupabaseRequestClient(request);
  const authResult = await supabase.auth.getUser();
  const hasSession = Boolean(authResult.data.user);
  const decision = resolveMiddlewareRouting({ pathname, search, hasSession });

  if (decision.kind === "redirect") {
    logMiddlewareRedirect({
      currentPath: `${pathname}${search}`,
      redirectTo: decision.pathname,
      reason: decision.reason,
    });
    return applyResponseCookies(
      NextResponse.redirect(new URL(decision.pathname, request.url)),
    );
  }

  return buildNextResponse(request, applyResponseCookies);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
