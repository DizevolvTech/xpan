import assert from "node:assert/strict";
import test from "node:test";

import { resolveAreaAccess } from "@/lib/navigation-access";
import { buildDefaultPermissions, buildEmptyPermissions } from "@/lib/permission-modules";

test("admin keeps access when navigating to another module area", () => {
  const access = resolveAreaAccess({
    permissions: buildDefaultPermissions("administrador"),
    baseRole: "administrador",
    areaGroup: "loja",
    currentPath: "/loja/pedidos",
  });

  assert.equal(access.canAccessCurrentPath, true);
  assert.equal(access.landingPath, "/administrador");
  assert.equal(
    access.sections.some(
      (section) =>
        section.group === "administrador" &&
        section.items.some((item) => item.id === "administrador.usuarios"),
    ),
    true,
  );
});

test("foreign profile pages are blocked even when other modules are visible", () => {
  const access = resolveAreaAccess({
    permissions: buildDefaultPermissions("gestor-fabrica"),
    baseRole: "gestor-fabrica",
    areaGroup: "loja",
    currentPath: "/loja/perfil",
  });

  assert.equal(access.canAccessCurrentPath, false);
  assert.equal(access.profilePath, "/gestor-fabrica/perfil");
  assert.equal(access.accessDeniedReason, "foreign-profile");
});

test("users without permission for an area are redirected to their landing path", () => {
  const permissions = buildEmptyPermissions();
  permissions["loja.pedidos"] = "operar";

  const access = resolveAreaAccess({
    permissions,
    baseRole: "loja",
    areaGroup: "gestor-dados",
    currentPath: "/gestor-dados",
  });

  assert.equal(access.canAccessCurrentPath, false);
  assert.equal(access.landingPath, "/loja/pedidos");
  assert.equal(access.accessDeniedReason, "missing-module-access");
});

test("unknown routes inside an allowed area remain accessible to preserve nested pages", () => {
  const access = resolveAreaAccess({
    permissions: buildDefaultPermissions("gestor-dados"),
    baseRole: "gestor-dados",
    areaGroup: "gestor-dados",
    currentPath: "/gestor-dados/nao-mapeado",
  });

  assert.equal(access.canAccessCurrentPath, true);
});

test("unknown routes inside a denied area stay blocked", () => {
  const access = resolveAreaAccess({
    permissions: buildDefaultPermissions("loja"),
    baseRole: "loja",
    areaGroup: "gestor-dados",
    currentPath: "/gestor-dados/nao-mapeado",
  });

  assert.equal(access.canAccessCurrentPath, false);
  assert.equal(access.accessDeniedReason, "missing-area-access");
});
