import { NextResponse } from "next/server";

import type { ManagedUser } from "@/lib/admin-users";
import { resolveAuthorizationDecision } from "@/lib/authorization-decision";
import { logApiAuthorizationFailure } from "@/lib/access-audit";
import { resolveCurrentManagedUser } from "@/lib/server-session";
import { hasStoreAccess, resolveAllowedStoreIds } from "@/lib/store-access";
import type { PermissionLevel, PermissionModuleId } from "@/lib/permission-modules";

type AuthorizeApiOptions = {
  permission?: PermissionModuleId;
  anyOfPermissions?: PermissionModuleId[];
  minimumLevel?: PermissionLevel;
  contextLabel?: string;
};

function buildUnauthorizedResponse() {
  return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
}

function buildForbiddenResponse(message = "Você não tem permissão para esta operação.") {
  return NextResponse.json({ message }, { status: 403 });
}

export async function authorizeApiRequest(
  options: AuthorizeApiOptions = {},
): Promise<{ user: ManagedUser } | { response: NextResponse }> {
  const user = await resolveCurrentManagedUser();
  const decision = resolveAuthorizationDecision(user, options);

  if (decision.kind === "unauthorized") {
    logApiAuthorizationFailure({
      event: "unauthorized",
      reason: decision.reason,
      permission: decision.permission,
      anyOfPermissions: decision.anyOfPermissions,
      minimumLevel: decision.minimumLevel,
      contextLabel: options.contextLabel,
    });
    return {
      response: buildUnauthorizedResponse(),
    };
  }

  if (decision.kind === "forbidden") {
    logApiAuthorizationFailure({
      event: "forbidden",
      reason: decision.reason,
      permission: decision.permission,
      anyOfPermissions: decision.anyOfPermissions,
      minimumLevel: decision.minimumLevel,
      baseRole: decision.user.role,
      userEmail: decision.user.email,
      contextLabel: options.contextLabel,
    });
    return {
      response: buildForbiddenResponse(),
    };
  }

  return { user: decision.user };
}

export function getAllowedStoreIds(user: ManagedUser): string[] | null {
  return resolveAllowedStoreIds(user.storeIds);
}

export function canAccessStore(user: ManagedUser, storeId: string) {
  return hasStoreAccess(storeId, getAllowedStoreIds(user));
}

export function buildStoreScopeResponse() {
  return buildForbiddenResponse("O usuário autenticado não tem acesso a este registro.");
}
