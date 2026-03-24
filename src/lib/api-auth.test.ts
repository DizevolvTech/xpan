import assert from "node:assert/strict";
import test from "node:test";

import { resolveApiPermissionMap } from "@/lib/api-permission-context";
import {
  buildDefaultPermissions,
  buildEmptyPermissions,
  canAccessPermission,
} from "@/lib/permission-modules";
import { hasStoreAccess, resolveAllowedStoreIds } from "@/lib/store-access";

test("store scope applies to any user with explicit store assignments", () => {
  const allowedStoreIds = resolveAllowedStoreIds(["store-a", "store-c"]);

  assert.deepEqual(allowedStoreIds, ["store-a", "store-c"]);
  assert.equal(hasStoreAccess("store-a", allowedStoreIds), true);
  assert.equal(hasStoreAccess("store-b", allowedStoreIds), false);
});

test("empty store scope keeps unrestricted access regardless of base role", () => {
  const allowedStoreIds = resolveAllowedStoreIds([]);

  assert.equal(allowedStoreIds, null);
  assert.equal(hasStoreAccess("store-a", allowedStoreIds), true);
});

test("master APIs keep master permissions while reading a tenant", () => {
  const access = {
    actorRole: "administrador-master" as const,
    user: {
      permissions: buildDefaultPermissions("administrador-master"),
    },
    permissions: {
      ...buildEmptyPermissions(),
      "administrador.dashboard": "gerenciar" as const,
    },
  };

  const permissionMap = resolveApiPermissionMap(access, {
    permission: "administrador-master.clientes",
  });

  assert.ok(permissionMap);
  assert.equal(
    canAccessPermission(permissionMap, "administrador-master.clientes", "visualizar"),
    true,
  );
});

test("tenant APIs keep delegated read-only permissions for master users", () => {
  const access = {
    actorRole: "administrador-master" as const,
    user: {
      permissions: buildDefaultPermissions("administrador-master"),
    },
    permissions: {
      ...buildEmptyPermissions(),
      "administrador.dashboard": "gerenciar" as const,
    },
  };

  const permissionMap = resolveApiPermissionMap(access, {
    permission: "administrador.dashboard",
  });

  assert.ok(permissionMap);
  assert.equal(
    canAccessPermission(permissionMap, "administrador-master.clientes", "visualizar"),
    false,
  );
  assert.equal(canAccessPermission(permissionMap, "administrador.dashboard", "visualizar"), true);
});
