import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDefaultPermissions,
  buildEmptyPermissions,
  buildNavigationSections,
  canAccessAnyPermission,
  describeNavigationAccess,
  findPermissionModuleByPath,
  getPermissionModule,
  hasAnyNonStoreAccess,
  resolveLandingPath,
} from "@/lib/permission-modules";

test("resolveLandingPath uses the first allowed capability instead of the base role", () => {
  const permissions = buildEmptyPermissions();
  permissions["gestor-fabrica.dashboard"] = "visualizar";
  permissions["chao-fabrica.ops"] = "operar";

  assert.equal(resolveLandingPath(permissions, "loja"), "/gestor-fabrica");
});

test("buildNavigationSections groups only the modules visible to the user", () => {
  const permissions = buildDefaultPermissions("gestor-fabrica");
  const sections = buildNavigationSections(permissions);

  assert.deepEqual(
    sections.map((section) => section.group),
    ["gestor-fabrica", "chao-fabrica"],
  );
  assert.equal(sections[0]?.items[0]?.id, "gestor-fabrica.dashboard");
  assert.equal(
    sections[1]?.items.some((item) => item.id === "chao-fabrica.entregas"),
    true,
  );
});

test("route matching keeps profile pages out of dashboard permissions", () => {
  const dashboardModule = getPermissionModule("loja.dashboard");
  assert.ok(dashboardModule);
  assert.equal(findPermissionModuleByPath("/loja/perfil"), null);
  assert.equal(findPermissionModuleByPath("/loja/pedidos/abc")?.id, "loja.pedidos");
  assert.equal(findPermissionModuleByPath("/gestor-dados/linhas-producao/123")?.id, "gestor-dados.linhas");
});

test("permission helpers understand cross-module access", () => {
  const permissions = buildEmptyPermissions();
  permissions["chao-fabrica.expedicao"] = "operar";

  assert.equal(
    canAccessAnyPermission(
      permissions,
      ["gestor-fabrica.expedicao", "chao-fabrica.expedicao"],
      "visualizar",
    ),
    true,
  );
  assert.equal(hasAnyNonStoreAccess(permissions), true);
});

test("describeNavigationAccess falls back to the profile page when no module is visible", () => {
  const permissions = buildEmptyPermissions();
  const summary = describeNavigationAccess(permissions, "gestor-dados");

  assert.equal(summary.landingPath, "/gestor-dados/perfil");
  assert.equal(summary.visibleModuleCount, 0);
  assert.equal(summary.visibleGroupCount, 0);
});
