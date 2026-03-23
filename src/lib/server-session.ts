import "server-only";

import { cookies } from "next/headers";

import type { ManagedUser } from "@/lib/admin-users";
import type { SessionUser } from "@/lib/auth";
import { buildEmptyPermissions, permissionModules, type PermissionMap } from "@/lib/permission-modules";
import { findManagedUserByAuthUserId } from "@/lib/supabase-data/admin-users";
import { getTenantByIdentifier } from "@/lib/supabase-data/tenants";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  MASTER_TENANT_COOKIE_NAME,
  isMasterRole,
  type AccessMode,
  type TenantSummary,
} from "@/lib/tenant";

export type ResolvedServerSession = SessionUser & {
  profileId?: string;
  authUserId?: string | null;
};

export type ResolvedAccessUser = ManagedUser & {
  authUserId: string | null;
};

export type ResolvedServerAccess = {
  user: ResolvedAccessUser;
  actorRole: ManagedUser["role"];
  actorTenantId: string | null;
  effectiveTenantId: string | null;
  accessMode: AccessMode;
  permissions: PermissionMap;
  selectedTenant: TenantSummary | null;
};

type ResolveManagedUserOptions = {
  includeStoreAccess?: boolean;
};

function buildSessionUser(name: string, email: string, role: SessionUser["role"]): SessionUser {
  return {
    name,
    email,
    role,
  };
}

async function resolveManagedUserFromSession(
  authUserId: string,
  options: ResolveManagedUserOptions = {},
): Promise<ManagedUser | null> {
  const supabase = await createSupabaseServerClient();
  return findManagedUserByAuthUserId(authUserId, {
    supabase,
    includeStoreAccess: options.includeStoreAccess ?? false,
  });
}

export async function resolveServerSession(): Promise<ResolvedServerSession | null> {
  const access = await resolveServerAccess();

  if (!access) {
    return null;
  }

  return {
    ...buildSessionUser(access.user.name, access.user.email, access.user.role),
    tenantId: access.effectiveTenantId,
    profileId: access.user.id,
    authUserId: access.user.authUserId ?? undefined,
  };
}

export async function resolveCurrentManagedUser(options: ResolveManagedUserOptions = {}) {
  const supabase = await createSupabaseServerClient();
  const authResult = await supabase.auth.getUser();
  const authUser = authResult.data.user;

  if (!authUser) {
    return null;
  }

  return resolveManagedUserFromSession(authUser.id, options);
}

export function buildMasterTenantReadOnlyPermissions() {
  const permissions = buildEmptyPermissions();

  permissionModules.forEach((module) => {
    if (module.group !== "administrador-master") {
      permissions[module.id] = "gerenciar";
    }
  });

  return permissions;
}

export async function resolveServerAccess(
  options: ResolveManagedUserOptions = {},
): Promise<ResolvedServerAccess | null> {
  const supabase = await createSupabaseServerClient();
  const authResult = await supabase.auth.getUser();
  const authUser = authResult.data.user;

  if (!authUser) {
    return null;
  }

  const managedUser = await resolveManagedUserFromSession(authUser.id, options);

  if (!managedUser || managedUser.status !== "ativo") {
    return null;
  }

  if (!isMasterRole(managedUser.role)) {
    return {
      user: {
        ...managedUser,
        authUserId: authUser.id,
      },
      actorRole: managedUser.role,
      actorTenantId: managedUser.tenantId,
      effectiveTenantId: managedUser.tenantId,
      accessMode: "tenant",
      permissions: managedUser.permissions,
      selectedTenant: null,
    };
  }

  const cookieStore = await cookies();
  const selectedTenantIdentifier = cookieStore.get(MASTER_TENANT_COOKIE_NAME)?.value ?? null;
  const selectedTenantRecord = selectedTenantIdentifier
    ? await getTenantByIdentifier(selectedTenantIdentifier)
    : null;
  const selectedTenant = selectedTenantRecord
    ? {
        id: selectedTenantRecord.id,
        legacyId: selectedTenantRecord.legacyId,
        name: selectedTenantRecord.name,
        slug: selectedTenantRecord.slug,
        status: selectedTenantRecord.status,
      }
    : null;
  const accessMode: AccessMode = selectedTenant ? "read-only-tenant" : "master";

  return {
    user: {
      ...managedUser,
      authUserId: authUser.id,
    },
    actorRole: managedUser.role,
    actorTenantId: managedUser.tenantId,
    effectiveTenantId: selectedTenant?.id ?? null,
    accessMode,
    permissions: selectedTenant ? buildMasterTenantReadOnlyPermissions() : managedUser.permissions,
    selectedTenant,
  };
}
