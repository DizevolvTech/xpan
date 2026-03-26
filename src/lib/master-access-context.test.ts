import assert from "node:assert/strict";
import test from "node:test";

import { buildDefaultPermissions } from "@/lib/permission-modules";
import { resolveMasterAccessContext } from "@/lib/master-access-context";
import type { TenantSummary } from "@/lib/tenant";

const masterPermissions = buildDefaultPermissions("administrador-master");
const selectedTenant: TenantSummary = {
  id: "tenant-1",
  legacyId: "101",
  slug: "cliente-alpha",
  name: "Cliente Alpha",
  status: "ativo",
};

test("master read-only context keeps tenant access delegated and blocks master modules", () => {
  const access = resolveMasterAccessContext(
    {
      role: "administrador-master",
      tenantId: null,
      permissions: masterPermissions,
    },
    selectedTenant,
  );

  assert.equal(access.accessMode, "read-only-tenant");
  assert.equal(access.effectiveTenantId, selectedTenant.id);
  assert.deepEqual(access.selectedTenant, selectedTenant);
  assert.equal(access.permissions["administrador.dashboard"], "gerenciar");
  assert.equal(access.permissions["administrador-master.clientes"], "sem_acesso");
});

test("master context is restored after leaving read-only tenant mode", () => {
  const access = resolveMasterAccessContext(
    {
      role: "administrador-master",
      tenantId: null,
      permissions: masterPermissions,
    },
    null,
  );

  assert.equal(access.accessMode, "master");
  assert.equal(access.effectiveTenantId, null);
  assert.equal(access.selectedTenant, null);
  assert.equal(access.permissions["administrador-master.clientes"], "gerenciar");
  assert.equal(access.permissions["administrador.dashboard"], "sem_acesso");
  assert.deepEqual(access.permissions, masterPermissions);
});
