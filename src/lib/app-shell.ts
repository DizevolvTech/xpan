import "server-only";

import { headers } from "next/headers";

import { resolveAppShellCurrentPath } from "@/lib/app-shell-path";
import { resolveAreaAccess } from "@/lib/navigation-access";
import { permissionGroupMeta } from "@/lib/permission-modules";
import {
  type AppShellNavigationContext,
  type PermissionGroup,
} from "@/lib/permission-modules";
import { resolveServerAccess } from "@/lib/server-session";

export type ResolvedAppShellContext = AppShellNavigationContext & {
  currentPath: string;
  canAccessCurrentPath: boolean;
  accessDeniedReason: ReturnType<typeof resolveAreaAccess>["accessDeniedReason"];
};

export async function getAppShellContext(
  areaGroup: PermissionGroup,
): Promise<ResolvedAppShellContext | null> {
  const accessContext = await resolveServerAccess();

  if (!accessContext) {
    return null;
  }

  const headerStore = await headers();
  const currentPath = resolveAppShellCurrentPath(
    {
      pathname: headerStore.get("x-app-pathname"),
      rewrittenPath: headerStore.get("x-nextjs-rewritten-path"),
      nextUrl: headerStore.get("next-url"),
    },
    permissionGroupMeta[areaGroup].route,
  );
  const effectivePermissions =
    areaGroup === "administrador-master"
      ? accessContext.user.permissions
      : accessContext.permissions;
  const access = resolveAreaAccess({
    permissions: effectivePermissions,
    baseRole: accessContext.user.role,
    areaGroup,
    currentPath,
  });

  return {
    currentUser: {
      name: accessContext.user.name,
      email: accessContext.user.email,
      baseRole: accessContext.user.role,
      baseRoleLabel: permissionGroupMeta[accessContext.user.role].label,
      profilePath: access.profilePath,
    },
    landingPath: access.landingPath,
    sections: access.sections,
    accessMode: accessContext.accessMode,
    effectiveTenantId: accessContext.effectiveTenantId,
    selectedTenant: accessContext.selectedTenant,
    currentPath: access.currentPath,
    canAccessCurrentPath: access.canAccessCurrentPath,
    accessDeniedReason: access.accessDeniedReason,
  };
}
