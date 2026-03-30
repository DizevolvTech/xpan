import assert from "node:assert/strict";
import test from "node:test";

import { resolveAppShellCurrentPath } from "@/lib/app-shell-path";

test("app shell keeps the middleware pathname when available", () => {
  const currentPath = resolveAppShellCurrentPath(
    {
      pathname: "/gestor-dados/produtos",
      rewrittenPath: "/gestor-dados",
      nextUrl: "/gestor-dados",
    },
    "/gestor-dados",
  );

  assert.equal(currentPath, "/gestor-dados/produtos");
});

test("app shell falls back to rewritten path when middleware pathname is missing", () => {
  const currentPath = resolveAppShellCurrentPath(
    {
      pathname: null,
      rewrittenPath: "/gestor-fabrica/pedidos?status=aberto",
      nextUrl: "/gestor-fabrica",
    },
    "/gestor-fabrica",
  );

  assert.equal(currentPath, "/gestor-fabrica/pedidos");
});

test("app shell uses next-url before falling back to the area root", () => {
  const currentPath = resolveAppShellCurrentPath(
    {
      pathname: null,
      rewrittenPath: null,
      nextUrl: "https://example.com/loja/pedidos?tab=ativos",
    },
    "/loja",
  );

  assert.equal(currentPath, "/loja/pedidos");
});

test("app shell returns the area fallback when all candidates are invalid", () => {
  const currentPath = resolveAppShellCurrentPath(
    {
      pathname: "",
      rewrittenPath: "gestor-fabrica/pedidos",
      nextUrl: null,
    },
    "/gestor-fabrica",
  );

  assert.equal(currentPath, "/gestor-fabrica");
});
