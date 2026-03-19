import { isProtectedAppPath } from "@/lib/permission-modules";

export type MiddlewareRoutingDecision =
  | {
      kind: "next";
    }
  | {
      kind: "redirect";
      pathname: string;
      reason: "missing-session";
    };

export function buildLoginRedirectPath(pathname: string, search: string) {
  if (pathname === "/") {
    return "/login";
  }

  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`;
}

export function resolveMiddlewareRouting(input: {
  pathname: string;
  search: string;
  hasSession: boolean;
}): MiddlewareRoutingDecision {
  const { pathname, search, hasSession } = input;

  if (pathname === "/login") {
    return { kind: "next" };
  }

  if (!hasSession && (pathname === "/" || isProtectedAppPath(pathname))) {
    return {
      kind: "redirect",
      pathname: buildLoginRedirectPath(pathname, search),
      reason: "missing-session",
    };
  }

  return { kind: "next" };
}
