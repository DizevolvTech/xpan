import type { ManagedUser } from "@/lib/admin-users";
import {
  canAccessAnyPermission,
  canAccessPermission,
  type PermissionLevel,
  type PermissionModuleId,
} from "@/lib/permission-modules";

type AuthorizationOptions = {
  permission?: PermissionModuleId;
  anyOfPermissions?: PermissionModuleId[];
  minimumLevel?: PermissionLevel;
};

export type AuthorizationDecision =
  | {
      kind: "authorized";
      user: ManagedUser;
    }
  | {
      kind: "unauthorized";
      reason: "missing-session";
      permission?: PermissionModuleId;
      anyOfPermissions?: PermissionModuleId[];
      minimumLevel?: PermissionLevel;
    }
  | {
      kind: "forbidden";
      reason: "missing-permission" | "missing-any-permission";
      user: ManagedUser;
      permission?: PermissionModuleId;
      anyOfPermissions?: PermissionModuleId[];
      minimumLevel: PermissionLevel;
    };

export function resolveAuthorizationDecision(
  user: ManagedUser | null,
  options: AuthorizationOptions = {},
): AuthorizationDecision {
  if (!user) {
    return {
      kind: "unauthorized",
      reason: "missing-session",
      permission: options.permission,
      anyOfPermissions: options.anyOfPermissions,
      minimumLevel: options.minimumLevel,
    };
  }

  if (options.permission) {
    const minimumLevel = options.minimumLevel ?? "visualizar";

    if (!canAccessPermission(user.permissions, options.permission, minimumLevel)) {
      return {
        kind: "forbidden",
        reason: "missing-permission",
        user,
        permission: options.permission,
        minimumLevel,
      };
    }
  }

  if (options.anyOfPermissions?.length) {
    const minimumLevel = options.minimumLevel ?? "visualizar";

    if (!canAccessAnyPermission(user.permissions, options.anyOfPermissions, minimumLevel)) {
      return {
        kind: "forbidden",
        reason: "missing-any-permission",
        user,
        anyOfPermissions: options.anyOfPermissions,
        minimumLevel,
      };
    }
  }

  return {
    kind: "authorized",
    user,
  };
}
