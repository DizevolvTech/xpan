import type { UserRole } from "@/lib/auth";
import {
  getPermissionModule,
  type PermissionMap,
  type PermissionModuleId,
} from "@/lib/permission-modules";
import { isMasterRole } from "@/lib/tenant";

type ApiPermissionOptions = {
  permission?: PermissionModuleId;
  anyOfPermissions?: PermissionModuleId[];
};

export type ApiPermissionContext = {
  actorRole: UserRole;
  permissions: PermissionMap;
  user: {
    permissions: PermissionMap;
  };
};

function shouldUseActorPermissionsForApi(
  access: ApiPermissionContext | null,
  options: ApiPermissionOptions,
) {
  if (!access || !isMasterRole(access.actorRole)) {
    return false;
  }

  const requestedPermissions = [
    ...(options.permission ? [options.permission] : []),
    ...(options.anyOfPermissions ?? []),
  ];

  if (requestedPermissions.length === 0) {
    return false;
  }

  return requestedPermissions.every(
    (permissionId) => getPermissionModule(permissionId)?.group === "administrador-master",
  );
}

export function resolveApiPermissionMap(
  access: ApiPermissionContext | null,
  options: ApiPermissionOptions,
): PermissionMap | null {
  if (!access) {
    return null;
  }

  return shouldUseActorPermissionsForApi(access, options)
    ? access.user.permissions
    : access.permissions;
}
