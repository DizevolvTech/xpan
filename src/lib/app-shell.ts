import "server-only";

import { headers } from "next/headers";

import { resolveAreaAccess } from "@/lib/navigation-access";
import { permissionGroupMeta } from "@/lib/permission-modules";
import {
  type AppShellNavigationContext,
  type PermissionGroup,
} from "@/lib/permission-modules";
import { resolveCurrentManagedUser } from "@/lib/server-session";

export type ResolvedAppShellContext = AppShellNavigationContext & {
  currentPath: string;
  canAccessCurrentPath: boolean;
  accessDeniedReason: ReturnType<typeof resolveAreaAccess>["accessDeniedReason"];
};

function buildCurrentPath(fallbackPath: string, pathnameHeader: string | null) {
  if (!pathnameHeader || !pathnameHeader.startsWith("/")) {
    return fallbackPath;
  }

  return pathnameHeader;
}

export async function getAppShellContext(
  areaGroup: PermissionGroup,
): Promise<ResolvedAppShellContext | null> {
  const user = await resolveCurrentManagedUser();

  if (!user) {
    return null;
  }

  const headerStore = await headers();
  const currentPath = buildCurrentPath(
    permissionGroupMeta[areaGroup].route,
    headerStore.get("x-app-pathname"),
  );
  const access = resolveAreaAccess({
    permissions: user.permissions,
    baseRole: user.role,
    areaGroup,
    currentPath,
  });

  return {
    currentUser: {
      name: user.name,
      email: user.email,
      baseRole: user.role,
      baseRoleLabel: permissionGroupMeta[user.role].label,
      profilePath: access.profilePath,
    },
    landingPath: access.landingPath,
    sections: access.sections,
    currentPath: access.currentPath,
    canAccessCurrentPath: access.canAccessCurrentPath,
    accessDeniedReason: access.accessDeniedReason,
  };
}
