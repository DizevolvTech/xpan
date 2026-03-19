import type { UserRole } from "@/lib/auth";
import {
  buildNavigationSections,
  canAccessPermission,
  findPermissionModuleByPath,
  hasVisibleNavigationInGroup,
  resolveLandingPath,
  roleProfilePath,
  type NavigationSectionDefinition,
  type PermissionGroup,
  type PermissionMap,
} from "@/lib/permission-modules";

export type ResolvedAreaAccess = {
  currentPath: string;
  landingPath: string;
  profilePath: string;
  sections: NavigationSectionDefinition[];
  canAccessCurrentPath: boolean;
  accessDeniedReason: "foreign-profile" | "missing-module-access" | "missing-area-access" | null;
};

export function resolveAreaAccess(input: {
  permissions: PermissionMap;
  baseRole: UserRole;
  areaGroup: PermissionGroup;
  currentPath: string;
}): ResolvedAreaAccess {
  const { permissions, baseRole, areaGroup, currentPath } = input;
  const landingPath = resolveLandingPath(permissions, baseRole);
  const sections = buildNavigationSections(permissions);
  const profilePath = roleProfilePath[baseRole];
  const isForeignProfilePath =
    Object.values(roleProfilePath).includes(currentPath) && currentPath !== profilePath;
  const currentModule = findPermissionModuleByPath(currentPath);
  let canAccessCurrentPath = false;
  let accessDeniedReason: ResolvedAreaAccess["accessDeniedReason"] = null;

  if (isForeignProfilePath) {
    accessDeniedReason = "foreign-profile";
  } else if (currentPath === profilePath) {
    canAccessCurrentPath = areaGroup === baseRole;
    if (!canAccessCurrentPath) {
      accessDeniedReason = "foreign-profile";
    }
  } else if (currentModule) {
    canAccessCurrentPath = canAccessPermission(
      permissions,
      currentModule.id,
      currentModule.minimumNavLevel,
    );
    if (!canAccessCurrentPath) {
      accessDeniedReason = "missing-module-access";
    }
  } else {
    canAccessCurrentPath = hasVisibleNavigationInGroup(permissions, areaGroup);
    if (!canAccessCurrentPath) {
      accessDeniedReason = "missing-area-access";
    }
  }

  return {
    currentPath,
    landingPath,
    profilePath,
    sections,
    canAccessCurrentPath,
    accessDeniedReason,
  };
}
