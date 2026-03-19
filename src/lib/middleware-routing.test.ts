import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLoginRedirectPath,
  resolveMiddlewareRouting,
} from "@/lib/middleware-routing";

test("middleware redirects unauthenticated protected routes to login with next", () => {
  const decision = resolveMiddlewareRouting({
    pathname: "/loja/pedidos",
    search: "?ref=2026-03-19",
    hasSession: false,
  });

  assert.deepEqual(decision, {
    kind: "redirect",
    pathname: "/login?next=%2Floja%2Fpedidos%3Fref%3D2026-03-19",
    reason: "missing-session",
  });
});

test("middleware redirects unauthenticated home to login without next", () => {
  const decision = resolveMiddlewareRouting({
    pathname: "/",
    search: "",
    hasSession: false,
  });

  assert.deepEqual(decision, {
    kind: "redirect",
    pathname: "/login",
    reason: "missing-session",
  });
});

test("middleware allows authenticated login page so the page can decide the redirect", () => {
  const decision = resolveMiddlewareRouting({
    pathname: "/login",
    search: "",
    hasSession: true,
  });

  assert.deepEqual(decision, { kind: "next" });
});

test("buildLoginRedirectPath preserves nested routes and query string", () => {
  assert.equal(
    buildLoginRedirectPath("/gestor-fabrica/ordens-producao", "?ref=2026-03-19"),
    "/login?next=%2Fgestor-fabrica%2Fordens-producao%3Fref%3D2026-03-19",
  );
});
