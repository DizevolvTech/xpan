import "server-only";

import type { ManagedUser } from "@/lib/admin-users";
import type { SessionUser } from "@/lib/auth";
import { findManagedUserByAuthUserId } from "@/lib/supabase-data/admin-users";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type ResolvedServerSession = SessionUser & {
  profileId?: string;
  authUserId?: string | null;
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
  const supabase = await createSupabaseServerClient();
  const authResult = await supabase.auth.getUser();
  const authUser = authResult.data.user;

  if (!authUser) {
    return null;
  }

  const managedUser = await resolveManagedUserFromSession(authUser.id);

  if (!managedUser || managedUser.status !== "ativo") {
    return null;
  }

  return {
    ...buildSessionUser(managedUser.name, managedUser.email, managedUser.role),
    profileId: managedUser.id,
    authUserId: authUser.id,
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
