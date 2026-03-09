import { NextResponse } from "next/server";

import type { ManagedUser } from "@/lib/admin-users";
import type { UserRole } from "@/lib/auth";
import type { PermissionLevel, PermissionModuleId } from "@/lib/permission-modules";
import { resolveCurrentManagedUser } from "@/lib/server-session";

const permissionRank: Record<PermissionLevel, number> = {
  sem_acesso: 0,
  visualizar: 1,
  operar: 2,
  gerenciar: 3,
};

type AuthorizeApiOptions = {
  roles?: UserRole[];
  permission?: PermissionModuleId;
  minimumLevel?: PermissionLevel;
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

  if (!user) {
    return {
      response: buildUnauthorizedResponse(),
    };
  }

  if (user.role === "administrador") {
    return { user };
  }

  if (options.roles && !options.roles.includes(user.role)) {
    return {
      response: buildForbiddenResponse(),
    };
  }

  if (options.permission) {
    const currentLevel = user.permissions[options.permission];
    const minimumLevel = options.minimumLevel ?? "visualizar";

    if (permissionRank[currentLevel] < permissionRank[minimumLevel]) {
      return {
        response: buildForbiddenResponse(),
      };
    }
  }

  return { user };
}

export function getAllowedStoreIds(user: ManagedUser): string[] | null {
  if (user.role !== "loja") {
    return null;
  }

  return user.storeIds ?? [];
}

export function canAccessStore(user: ManagedUser, storeId: string) {
  const allowedStoreIds = getAllowedStoreIds(user);
  return allowedStoreIds === null ? true : allowedStoreIds.includes(storeId);
}

export function buildStoreScopeResponse() {
  return buildForbiddenResponse("A loja autenticada não tem acesso a este registro.");
}
