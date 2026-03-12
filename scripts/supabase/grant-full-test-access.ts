import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

import { demoCredentialPresets } from "../../src/lib/demo-credentials";
import {
  buildEmptyPermissions,
  permissionModules,
  type PermissionGroup,
  type PermissionMap,
} from "../../src/lib/permission-modules";

type AuthUserSummary = {
  id: string;
  email?: string;
};

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase environment variables for test access grant.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function listAllAuthUsers() {
  const supabase = createSupabaseAdminClient();
  const users: AuthUserSummary[] = [];
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

    users.push(...result.data.users.map((user) => ({ id: user.id, email: user.email })));
    totalPages = result.data.total_pages;
    page += 1;
  }

  return users;
}

async function grantFullTestAccess() {
  const supabase = createSupabaseAdminClient();
  const [profilesResult, storesResult] = await Promise.all([
    supabase.from("profiles").select("id, email, auth_user_id, name, role, legacy_id"),
    supabase.from("stores").select("id"),
  ]);

  if (profilesResult.error) {
    throw new Error(`Failed to load profiles: ${profilesResult.error.message}`);
  }
  if (storesResult.error) {
    throw new Error(`Failed to load stores: ${storesResult.error.message}`);
  }

  const profiles = profilesResult.data ?? [];
  const stores = storesResult.data ?? [];
  const authUsers = await listAllAuthUsers();
  const authUserByEmail = new Map(authUsers.map((user) => [user.email?.toLowerCase() ?? "", user]));
  const presetByLegacyId = new Map(demoCredentialPresets.map((preset) => [preset.legacyId, preset]));
  const presetByEmail = new Map(demoCredentialPresets.map((preset) => [preset.email.toLowerCase(), preset]));
  const now = new Date().toISOString();

  const profileIds = profiles.map((profile) => profile.id);
  const resolvedProfiles = profiles.map((profile) => {
    const preset =
      (profile.legacy_id ? presetByLegacyId.get(profile.legacy_id) : undefined) ??
      presetByEmail.get(profile.email.toLowerCase());

    const role = preset?.role ?? profile.role;

    return {
      ...profile,
      targetRole: role,
    };
  });

  const fullPermissionGroupsByRole: Record<typeof resolvedProfiles[number]["targetRole"], PermissionGroup[]> = {
    administrador: ["administrador", "gestor-dados", "gestor-fabrica", "chao-fabrica", "loja"],
    "gestor-dados": ["gestor-dados"],
    "gestor-fabrica": ["gestor-fabrica", "chao-fabrica"],
    "chao-fabrica": ["chao-fabrica"],
    loja: ["loja"],
  };

  function buildRoleScopedPermissions(role: typeof resolvedProfiles[number]["targetRole"]): PermissionMap {
    const permissions = buildEmptyPermissions();
    const allowedGroups = new Set(fullPermissionGroupsByRole[role]);

    permissionModules.forEach((module) => {
      if (allowedGroups.has(module.group)) {
        permissions[module.id] = "gerenciar";
      }
    });

    return permissions;
  }

  for (const profile of resolvedProfiles) {
    const profileUpdateResult = await supabase
      .from("profiles")
      .update({
        role: profile.targetRole,
        status: "ativo",
        updated_at: now,
      })
      .eq("id", profile.id);

    if (profileUpdateResult.error) {
      throw new Error(`Failed to update profile ${profile.email}: ${profileUpdateResult.error.message}`);
    }
  }

  const deletePermissionsResult = await supabase
    .from("user_permissions")
    .delete()
    .in("profile_id", profileIds);

  if (deletePermissionsResult.error) {
    throw new Error(`Failed to reset user permissions: ${deletePermissionsResult.error.message}`);
  }

  const permissionPayload = resolvedProfiles.flatMap((profile) => {
    const permissions = buildRoleScopedPermissions(profile.targetRole);

    return permissionModules.map((module) => ({
      profile_id: profile.id,
      module_key: module.id,
      access_level: permissions[module.id],
    }));
  });

  if (permissionPayload.length > 0) {
    const permissionInsertResult = await supabase
      .from("user_permissions")
      .insert(permissionPayload);

    if (permissionInsertResult.error) {
      throw new Error(`Failed to insert full permissions: ${permissionInsertResult.error.message}`);
    }
  }

  const deleteStoreAccessResult = await supabase
    .from("profile_store_access")
    .delete()
    .in("profile_id", profileIds);

  if (deleteStoreAccessResult.error) {
    throw new Error(`Failed to reset store access: ${deleteStoreAccessResult.error.message}`);
  }

  const storeAccessPayload = resolvedProfiles
    .filter((profile) => profile.targetRole === "loja")
    .flatMap((profile) =>
      stores.map((store) => ({
        profile_id: profile.id,
        store_id: store.id,
      })),
    );

  if (storeAccessPayload.length > 0) {
    const storeAccessInsertResult = await supabase
      .from("profile_store_access")
      .insert(storeAccessPayload);

    if (storeAccessInsertResult.error) {
      throw new Error(`Failed to grant store access: ${storeAccessInsertResult.error.message}`);
    }
  }

  for (const profile of resolvedProfiles) {
    const authUserId = profile.auth_user_id ?? authUserByEmail.get(profile.email.toLowerCase())?.id ?? null;

    if (!authUserId) {
      console.warn(`SKIP ${profile.email} -> auth user not linked`);
      continue;
    }

    const updateResult = await supabase.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        legacyId: profile.legacy_id ?? profile.id,
        role: profile.targetRole,
        name: profile.name,
      },
      app_metadata: {
        role: profile.targetRole,
      },
    });

    if (updateResult.error) {
      throw new Error(`Failed to sync auth user ${profile.email}: ${updateResult.error.message}`);
    }

    console.log(`SYNC ${profile.email} -> ${profile.targetRole}`);
  }

  console.log(`DONE profiles=${profiles.length} stores=${stores.length} permissions=${permissionPayload.length}`);
}

grantFullTestAccess().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
