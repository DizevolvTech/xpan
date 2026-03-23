import { NextResponse } from "next/server";

import { resolveAuthorizationDecision } from "@/lib/authorization-decision";
import { logApiAuthorizationFailure } from "@/lib/access-audit";
import {
  resolveServerAccess,
  type ResolvedServerAccess,
} from "@/lib/server-session";
import { hasStoreAccess, resolveAllowedStoreIds } from "@/lib/store-access";
import type { PermissionLevel, PermissionModuleId } from "@/lib/permission-modules";
import { canWriteInAccessMode } from "@/lib/tenant";

type AuthorizeApiOptions = {
  permission?: PermissionModuleId;
  anyOfPermissions?: PermissionModuleId[];
  minimumLevel?: PermissionLevel;
  contextLabel?: string;
  includeStoreScope?: boolean;
  requireTenantContext?: boolean;
  requireWritableTenant?: boolean;
};

function buildUnauthorizedResponse() {
  return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
}

function buildForbiddenResponse(message = "Você não tem permissão para esta operação.") {
  return NextResponse.json({ message }, { status: 403 });
}

function buildMissingTenantContextResponse() {
  return NextResponse.json(
    { message: "Selecione um cliente no painel master para acessar este ecossistema." },
    { status: 403 },
  );
}

function buildReadOnlyTenantResponse() {
  return NextResponse.json(
    { message: "O cliente selecionado está aberto em modo leitura." },
    { status: 403 },
  );
}

export async function authorizeApiRequest(
  options: AuthorizeApiOptions = {},
): Promise<ResolvedServerAccess | { response: NextResponse }> {
  const access = await resolveServerAccess({
    includeStoreAccess: options.includeStoreScope ?? false,
  });
  const decision = resolveAuthorizationDecision(
    access
      ? {
          ...access.user,
          permissions: access.permissions,
        }
      : null,
    options,
  );

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

  if (options.requireTenantContext && !access?.effectiveTenantId) {
    return {
      response: buildMissingTenantContextResponse(),
    };
  }

  if (options.requireWritableTenant && access && !canWriteInAccessMode(access.accessMode)) {
    return {
      response: buildReadOnlyTenantResponse(),
    };
  }

  return access as ResolvedServerAccess;
}

export function getAllowedStoreIds(access: Pick<ResolvedServerAccess, "user" | "accessMode">): string[] | null {
  if (access.accessMode !== "tenant") {
    return null;
  }

  return resolveAllowedStoreIds(access.user.storeIds);
}

export function canAccessStore(
  access: Pick<ResolvedServerAccess, "user" | "accessMode">,
  storeId: string,
) {
  return hasStoreAccess(storeId, getAllowedStoreIds(access));
}

export function buildStoreScopeResponse() {
  return buildForbiddenResponse("O usuário autenticado não tem acesso a este registro.");
}
