import type { ManagedUser } from "@/lib/admin-users";
import {
  buildEmptyPermissions,
  permissionModules,
  type PermissionMap,
} from "@/lib/permission-modules";
import { isMasterRole, type AccessMode, type TenantSummary } from "@/lib/tenant";

export type ResolvedMasterAccessContext = {
  actorRole: ManagedUser["role"];
  actorTenantId: string | null;
  effectiveTenantId: string | null;
  accessMode: AccessMode;
  permissions: PermissionMap;
  selectedTenant: TenantSummary | null;
};

export function buildMasterTenantReadOnlyPermissions() {
  const permissions = buildEmptyPermissions();

  permissionModules.forEach((module) => {
    if (module.group !== "administrador-master") {
      permissions[module.id] = "gerenciar";
    }
  });

  return permissions;
}

export function resolveMasterAccessContext(
  managedUser: Pick<ManagedUser, "role" | "tenantId" | "permissions">,
  selectedTenant: TenantSummary | null,
): ResolvedMasterAccessContext {
  if (!isMasterRole(managedUser.role)) {
    throw new Error("resolveMasterAccessContext only supports master users.");
  }

  return {
    actorRole: managedUser.role,
    actorTenantId: managedUser.tenantId,
    effectiveTenantId: selectedTenant?.id ?? null,
    accessMode: selectedTenant ? "read-only-tenant" : "master",
    permissions: selectedTenant ? buildMasterTenantReadOnlyPermissions() : managedUser.permissions,
    selectedTenant,
  };
}
