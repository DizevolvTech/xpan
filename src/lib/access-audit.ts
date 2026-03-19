import type { UserRole } from "@/lib/auth";
import type { PermissionGroup, PermissionLevel, PermissionModuleId } from "@/lib/permission-modules";

type AccessAuditEvent = {
  source: "middleware" | "layout" | "api";
  event: "redirect" | "forbidden" | "unauthorized";
  reason: string;
  currentPath?: string;
  redirectTo?: string;
  areaGroup?: PermissionGroup;
  baseRole?: UserRole;
  userEmail?: string;
  permission?: PermissionModuleId;
  anyOfPermissions?: PermissionModuleId[];
  minimumLevel?: PermissionLevel;
  contextLabel?: string;
};

function buildAccessAuditPayload(event: AccessAuditEvent) {
  return {
    timestamp: new Date().toISOString(),
    ...Object.fromEntries(
      Object.entries(event).filter(([, value]) => {
        if (value === undefined || value === null) {
          return false;
        }

        return !Array.isArray(value) || value.length > 0;
      }),
    ),
  };
}

function emitAccessAudit(event: AccessAuditEvent) {
  console.warn(`[access-control] ${JSON.stringify(buildAccessAuditPayload(event))}`);
}

export function logMiddlewareRedirect(input: {
  currentPath: string;
  redirectTo: string;
  reason: string;
}) {
  emitAccessAudit({
    source: "middleware",
    event: "redirect",
    reason: input.reason,
    currentPath: input.currentPath,
    redirectTo: input.redirectTo,
  });
}

export function logAreaRedirect(input: {
  currentPath: string;
  redirectTo: string;
  reason: string;
  areaGroup: PermissionGroup;
  baseRole?: UserRole;
  userEmail?: string;
}) {
  emitAccessAudit({
    source: "layout",
    event: "redirect",
    reason: input.reason,
    currentPath: input.currentPath,
    redirectTo: input.redirectTo,
    areaGroup: input.areaGroup,
    baseRole: input.baseRole,
    userEmail: input.userEmail,
  });
}

export function logApiAuthorizationFailure(input: {
  event: "forbidden" | "unauthorized";
  reason: string;
  permission?: PermissionModuleId;
  anyOfPermissions?: PermissionModuleId[];
  minimumLevel?: PermissionLevel;
  baseRole?: UserRole;
  userEmail?: string;
  contextLabel?: string;
}) {
  emitAccessAudit({
    source: "api",
    event: input.event,
    reason: input.reason,
    permission: input.permission,
    anyOfPermissions: input.anyOfPermissions,
    minimumLevel: input.minimumLevel,
    baseRole: input.baseRole,
    userEmail: input.userEmail,
    contextLabel: input.contextLabel,
  });
}
