import "server-only";

import type {
  ManagedUser,
  ManagedUserProfileInput,
  UserFormState,
} from "@/lib/admin-users";
import {
  buildProfile,
  formatDateTimeLabel,
} from "@/lib/admin-users";
import { buildTemporaryPassword } from "@/lib/auth-credentials";
import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isUuid,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import {
  buildDefaultPermissions,
  permissionModules,
  type PermissionMap,
  type PermissionModuleId,
} from "@/lib/permission-modules";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type UserPermissionRow = Database["public"]["Tables"]["user_permissions"]["Row"];
type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
type ProfileStoreAccessRow = Database["public"]["Tables"]["profile_store_access"]["Row"];
type AuthUserSummary = {
  id: string;
  email?: string;
};

type QueryOptions = {
  supabase?: SupabaseDataClient;
};

export type CreateManagedUserResult = {
  user: ManagedUser;
  temporaryPassword?: string;
};

function buildPermissionMap(
  role: ManagedUser["role"],
  rows: UserPermissionRow[],
): PermissionMap {
  const permissions = buildDefaultPermissions(role);

  rows.forEach((row) => {
    permissions[row.module_key as PermissionModuleId] = row.access_level;
  });

  return permissions;
}

function mapManagedUser(
  profile: ProfileRow,
  permissions: UserPermissionRow[],
  storeLegacyIds: string[],
): ManagedUser {
  return {
    id: profile.legacy_id ?? profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    updatedAt: formatDateTimeLabel(profile.updated_at),
    permissions: buildPermissionMap(profile.role, permissions),
    profile: buildProfile({
      avatarUrl: profile.avatar_path ?? "",
      phone: profile.phone ?? "",
      address: {
        zipCode: profile.zip_code ?? "",
        street: profile.street ?? "",
        number: profile.number ?? "",
        complement: profile.complement ?? "",
        neighborhood: profile.neighborhood ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        country: profile.country ?? "Brasil",
      },
      passwordUpdatedAt: formatDateTimeLabel(profile.password_updated_at),
    }),
    storeIds: storeLegacyIds,
  };
}

async function findAuthUserByEmail(email: string): Promise<AuthUserSummary | null> {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (result.error) {
      throw new Error(`Failed to list auth users: ${result.error.message}`);
    }

    const matched = result.data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (matched) {
      return {
        id: matched.id,
        email: matched.email,
      };
    }

    totalPages = result.data.total_pages;
    page += 1;
  }

  return null;
}

async function syncProfileAuthUser(
  profile: Pick<ProfileRow, "id" | "legacy_id" | "auth_user_id" | "email" | "name" | "role">,
  overrides?: {
    email?: string;
    name?: string;
    role?: ManagedUser["role"];
    newPassword?: string;
  },
) {
  const supabase = createSupabaseAdminClient();
  const email = (overrides?.email ?? profile.email).trim().toLowerCase();
  const name = (overrides?.name ?? profile.name).trim();
  const role = overrides?.role ?? profile.role;
  const newPassword = overrides?.newPassword?.trim() ?? "";

  let authUserId = profile.auth_user_id;

  if (!authUserId) {
    const existingAuthUser = await findAuthUserByEmail(email);
    authUserId = existingAuthUser?.id ?? null;
  }

  const resolvedPassword = newPassword || buildTemporaryPassword(email, role);
  let createdAuthUser = false;

  if (!authUserId) {
    const createResult = await supabase.auth.admin.createUser({
      email,
      password: resolvedPassword,
      email_confirm: true,
      user_metadata: {
        legacyId: profile.legacy_id ?? profile.id,
        role,
        name,
      },
    });

    if (createResult.error) {
      throw new Error(`Failed to create auth user ${email}: ${createResult.error.message}`);
    }

    authUserId = createResult.data.user?.id ?? null;
    createdAuthUser = true;
  } else {
    const authUpdate: Parameters<typeof supabase.auth.admin.updateUserById>[1] = {
      email,
      email_confirm: true,
      user_metadata: {
        legacyId: profile.legacy_id ?? profile.id,
        role,
        name,
      },
    };

    if (newPassword) {
      authUpdate.password = newPassword;
    }

    const authResult = await supabase.auth.admin.updateUserById(authUserId, authUpdate);

    if (authResult.error) {
      throw new Error(`Failed to sync auth user ${email}: ${authResult.error.message}`);
    }
  }

  if (!authUserId) {
    throw new Error(`Failed to provision auth user ${email}: missing auth user id`);
  }

  if (profile.auth_user_id !== authUserId || createdAuthUser || Boolean(newPassword)) {
    const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
      auth_user_id: authUserId,
      updated_at: new Date().toISOString(),
    };

    if (createdAuthUser || Boolean(newPassword)) {
      profileUpdate.password_updated_at = new Date().toISOString();
    }

    const linkResult = await supabase.from("profiles").update(profileUpdate).eq("id", profile.id);

    if (linkResult.error) {
      throw new Error(`Failed to link auth user ${email}: ${linkResult.error.message}`);
    }
  }

  return {
    authUserId,
    createdAuthUser,
  };
}

async function resolveProfileByIdentifier(
  identifier: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {

  const legacyResult = await supabase
    .from("profiles")
    .select("*")
    .eq("legacy_id", identifier)
    .maybeSingle();

  if (legacyResult.error) {
    throw new Error(`Failed to resolve profile by legacy id: ${legacyResult.error.message}`);
  }

  if (legacyResult.data) {
    return legacyResult.data as ProfileRow;
  }

  if (!isUuid(identifier)) {
    throw new Error("User not found");
  }

  const idResult = await supabase.from("profiles").select("*").eq("id", identifier).maybeSingle();

  if (idResult.error) {
    throw new Error(`Failed to resolve profile by id: ${idResult.error.message}`);
  }

  if (!idResult.data) {
    throw new Error("User not found");
  }

  return idResult.data as ProfileRow;
}

async function resolveStoreRows(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const storesResult = await supabase.from("stores").select("id, legacy_id, status");
  return assertSupabaseResult(storesResult, "Failed to load stores") as Pick<
    StoreRow,
    "id" | "legacy_id" | "status"
  >[];
}

async function syncStoreAccess(
  profileId: string,
  role: ManagedUser["role"],
  storeIds?: string[],
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const deleteResult = await supabase.from("profile_store_access").delete().eq("profile_id", profileId);
  if (deleteResult.error) {
    throw new Error(`Failed to reset store access: ${deleteResult.error.message}`);
  }

  if (role !== "loja") {
    return;
  }

  const storeRows = await resolveStoreRows(supabase);
  const storeIdsToAssign =
    storeIds && storeIds.length > 0
      ? storeRows
          .filter((row) => storeIds.includes(row.legacy_id ?? row.id))
          .map((row) => row.id)
      : [];

  if (storeIdsToAssign.length === 0) {
    return;
  }

  const insertResult = await supabase.from("profile_store_access").insert(
    storeIdsToAssign.map((storeId) => ({
      profile_id: profileId,
      store_id: storeId,
    })),
  );

  if (insertResult.error) {
    throw new Error(`Failed to assign store access: ${insertResult.error.message}`);
  }
}

async function upsertPermissions(
  profileId: string,
  permissions: PermissionMap,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const payload = permissionModules.map((module) => ({
    profile_id: profileId,
    module_key: module.id,
    access_level: permissions[module.id],
  }));

  const result = await supabase.from("user_permissions").upsert(payload, {
    onConflict: "profile_id,module_key",
  });

  if (result.error) {
    throw new Error(`Failed to save user permissions: ${result.error.message}`);
  }
}

async function loadManagedUserByProfile(
  profile: ProfileRow,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<ManagedUser> {
  const [permissionsResult, storeAccessResult, storesResult] = await Promise.all([
    supabase.from("user_permissions").select("*").eq("profile_id", profile.id),
    supabase.from("profile_store_access").select("*").eq("profile_id", profile.id),
    supabase.from("stores").select("id, legacy_id"),
  ]);

  const permissions = assertSupabaseResult(
    permissionsResult,
    "Failed to load user permissions",
  ) as UserPermissionRow[];
  const storeAccessRows = assertSupabaseResult(
    storeAccessResult,
    "Failed to load profile store access",
  ) as ProfileStoreAccessRow[];
  const stores = assertSupabaseResult(storesResult, "Failed to load store ids") as Pick<
    StoreRow,
    "id" | "legacy_id"
  >[];
  const storeLegacyById = new Map(stores.map((row) => [row.id, row.legacy_id ?? row.id]));
  const storeIds = storeAccessRows.map((row) => storeLegacyById.get(row.store_id) ?? row.store_id);

  return mapManagedUser(profile, permissions, storeIds);
}

async function resolveProfileByAuthUserId(
  authUserId: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<ProfileRow | null> {
  const result = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Failed to resolve profile by auth user id: ${result.error.message}`);
  }

  return (result.data as ProfileRow | null) ?? null;
}

export async function listManagedUsers(options: QueryOptions = {}): Promise<ManagedUser[]> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const [profilesResult, permissionsResult, storeAccessResult, storesResult] = await Promise.all([
    supabase.from("profiles").select("*").order("updated_at", { ascending: false }),
    supabase.from("user_permissions").select("*"),
    supabase.from("profile_store_access").select("*"),
    supabase.from("stores").select("id, legacy_id"),
  ]);

  const profiles = assertSupabaseResult(profilesResult, "Failed to load profiles") as ProfileRow[];
  const permissions = assertSupabaseResult(permissionsResult, "Failed to load user permissions") as UserPermissionRow[];
  const storeAccessRows = assertSupabaseResult(
    storeAccessResult,
    "Failed to load profile store access",
  ) as ProfileStoreAccessRow[];
  const stores = assertSupabaseResult(storesResult, "Failed to load store ids") as Pick<
    StoreRow,
    "id" | "legacy_id"
  >[];

  const permissionsByProfileId = permissions.reduce<Map<string, UserPermissionRow[]>>((acc, row) => {
    const current = acc.get(row.profile_id) ?? [];
    current.push(row);
    acc.set(row.profile_id, current);
    return acc;
  }, new Map());

  const storeLegacyById = new Map(stores.map((row) => [row.id, row.legacy_id ?? row.id]));
  const storeIdsByProfileId = storeAccessRows.reduce<Map<string, string[]>>((acc, row) => {
    const current = acc.get(row.profile_id) ?? [];
    current.push(storeLegacyById.get(row.store_id) ?? row.store_id);
    acc.set(row.profile_id, current);
    return acc;
  }, new Map());

  return profiles.map((profile) =>
    mapManagedUser(
      profile,
      permissionsByProfileId.get(profile.id) ?? [],
      storeIdsByProfileId.get(profile.id) ?? [],
    ),
  );
}

export async function getManagedUserByIdentifier(
  identifier: string,
  options: QueryOptions = {},
): Promise<ManagedUser | null> {
  const supabase = options.supabase ?? createSupabaseAdminClient();

  try {
    const profile = await resolveProfileByIdentifier(identifier, supabase);
    return await loadManagedUserByProfile(profile, supabase);
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return null;
    }
    throw error;
  }
}

export async function findManagedUserByAuthUserId(
  authUserId: string,
  options: QueryOptions = {},
): Promise<ManagedUser | null> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const profile = await resolveProfileByAuthUserId(authUserId, supabase);

  if (!profile) {
    return null;
  }

  return loadManagedUserByProfile(profile, supabase);
}

export async function createManagedUser(
  input: UserFormState,
  options: QueryOptions = {},
): Promise<CreateManagedUserResult> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const insertResult = await supabase
    .from("profiles")
    .insert({
      legacy_id: `user-${crypto.randomUUID()}`,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      status: input.status,
      country: "Brasil",
    })
    .select("*")
    .single();

  const profile = assertSupabaseResult(insertResult, "Failed to create user") as ProfileRow;
  await upsertPermissions(profile.id, buildDefaultPermissions(input.role), supabase);
  await syncStoreAccess(profile.id, input.role, input.storeIds, supabase);
  const authProvisioning = await syncProfileAuthUser(profile, {
    email: profile.email,
    name: profile.name,
    role: profile.role,
  });

  const createdUser = await getManagedUserByIdentifier(profile.id, { supabase });

  if (!createdUser) {
    throw new Error("Created user could not be loaded");
  }

  return {
    user: createdUser,
    temporaryPassword: authProvisioning?.createdAuthUser
      ? buildTemporaryPassword(profile.email, profile.role)
      : undefined,
  };
}

export async function updateManagedUser(
  identifier: string,
  input: UserFormState & { resetPermissionsToRoleDefault?: boolean },
  options: QueryOptions = {},
): Promise<ManagedUser> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const profile = await resolveProfileByIdentifier(identifier, supabase);

  const updateResult = await supabase
    .from("profiles")
    .update({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)
    .select("*")
    .single();

  const updatedProfile = assertSupabaseResult(updateResult, "Failed to update user") as ProfileRow;

  if (input.resetPermissionsToRoleDefault) {
    await upsertPermissions(updatedProfile.id, buildDefaultPermissions(input.role), supabase);
  }

  if (input.storeIds || profile.role !== input.role) {
    await syncStoreAccess(updatedProfile.id, input.role, input.storeIds, supabase);
  }
  await syncProfileAuthUser(updatedProfile, {
    email: updatedProfile.email,
    name: updatedProfile.name,
    role: updatedProfile.role,
  });

  const managedUser = await getManagedUserByIdentifier(updatedProfile.id, { supabase });

  if (!managedUser) {
    throw new Error("Updated user could not be loaded");
  }

  return managedUser;
}

export async function saveManagedUserPermissions(
  identifier: string,
  permissions: PermissionMap,
  options: QueryOptions = {},
): Promise<ManagedUser> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const profile = await resolveProfileByIdentifier(identifier, supabase);
  await upsertPermissions(profile.id, permissions, supabase);
  const managedUser = await getManagedUserByIdentifier(profile.id, { supabase });

  if (!managedUser) {
    throw new Error("Updated user could not be loaded");
  }

  return managedUser;
}

export async function saveManagedUserProfile(
  identifier: string,
  input: ManagedUserProfileInput,
  options: QueryOptions = {},
): Promise<ManagedUser> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const profile = await resolveProfileByIdentifier(identifier, supabase);

  const updateResult = await supabase
    .from("profiles")
    .update({
      name: input.name?.trim() || profile.name,
      email: input.email?.trim().toLowerCase() || profile.email,
      avatar_path: input.avatarUrl.trim() || null,
      phone: input.phone.trim(),
      zip_code: input.address.zipCode.trim() || null,
      street: input.address.street.trim() || null,
      number: input.address.number.trim() || null,
      complement: input.address.complement.trim() || null,
      neighborhood: input.address.neighborhood.trim() || null,
      city: input.address.city.trim() || null,
      state: input.address.state.trim().toUpperCase() || null,
      country: input.address.country.trim() || "Brasil",
      password_updated_at:
        input.markPasswordUpdated || Boolean(input.newPassword?.trim())
          ? new Date().toISOString()
          : profile.password_updated_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)
    .select("*")
    .single();

  const updatedProfile = assertSupabaseResult(updateResult, "Failed to update user profile") as ProfileRow;
  await syncProfileAuthUser(updatedProfile, {
    email: updatedProfile.email,
    name: updatedProfile.name,
    role: updatedProfile.role,
    newPassword: input.newPassword,
  });

  const managedUser = await getManagedUserByIdentifier(updatedProfile.id, { supabase });

  if (!managedUser) {
    throw new Error("Updated user could not be loaded");
  }

  return managedUser;
}
