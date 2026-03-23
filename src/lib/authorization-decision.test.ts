import assert from "node:assert/strict";
import test from "node:test";

import type { ManagedUser } from "@/lib/admin-users";
import { resolveAuthorizationDecision } from "@/lib/authorization-decision";
import { buildDefaultPermissions, buildEmptyPermissions } from "@/lib/permission-modules";

function buildManagedUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id: "user-1",
    tenantId: null,
    name: "Usuario Teste",
    email: "teste@empresa.com",
    role: "loja",
    status: "ativo",
    updatedAt: "2026-03-19T10:00:00.000Z",
    permissions: buildDefaultPermissions("loja"),
    profile: {
      avatarUrl: "",
      phone: "",
      address: {
        zipCode: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        country: "Brasil",
      },
      passwordUpdatedAt: "-",
    },
    storeIds: [],
    ...overrides,
  };
}

test("authorization is unauthorized when session is missing", () => {
  const decision = resolveAuthorizationDecision(null, {
    permission: "loja.pedidos",
    minimumLevel: "operar",
  });

  assert.deepEqual(decision, {
    kind: "unauthorized",
    reason: "missing-session",
    permission: "loja.pedidos",
    minimumLevel: "operar",
    anyOfPermissions: undefined,
  });
});

test("authorization uses delegated permissions instead of the base role", () => {
  const permissions = buildEmptyPermissions();
  permissions["gestor-fabrica.dashboard"] = "visualizar";
  const user = buildManagedUser({
    role: "loja",
    permissions,
  });

  const decision = resolveAuthorizationDecision(user, {
    permission: "gestor-fabrica.dashboard",
    minimumLevel: "visualizar",
  });

  assert.equal(decision.kind, "authorized");
});

test("authorization accepts any-of permissions for shared operational endpoints", () => {
  const permissions = buildEmptyPermissions();
  permissions["chao-fabrica.expedicao"] = "operar";
  const user = buildManagedUser({
    role: "loja",
    permissions,
  });

  const decision = resolveAuthorizationDecision(user, {
    anyOfPermissions: ["gestor-fabrica.expedicao", "chao-fabrica.expedicao"],
    minimumLevel: "operar",
  });

  assert.equal(decision.kind, "authorized");
});

test("authorization returns a forbidden reason when permission is missing", () => {
  const user = buildManagedUser({
    role: "gestor-dados",
    permissions: buildDefaultPermissions("gestor-dados"),
  });

  const decision = resolveAuthorizationDecision(user, {
    permission: "gestor-fabrica.pedidos",
    minimumLevel: "operar",
  });

  assert.equal(decision.kind, "forbidden");
  assert.equal(decision.reason, "missing-permission");
});
