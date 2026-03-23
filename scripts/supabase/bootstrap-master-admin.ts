import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

import { demoCredentialPresets } from "../../src/lib/demo-credentials";
import {
  buildDefaultPermissions,
  permissionModules,
} from "../../src/lib/permission-modules";

type AuthUserSummary = {
  id: string;
  email?: string;
};

const masterPreset =
  demoCredentialPresets.find((preset) => preset.legacyId === "user-master") ??
  (() => {
    throw new Error("Master credential preset not found.");
  })();

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase environment variables for master bootstrap.");
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
    totalPages =
      "total_pages" in result.data && typeof result.data.total_pages === "number"
        ? result.data.total_pages
        : page;
    page += 1;
  }

  return users;
}

async function bootstrapMasterAdmin() {
  const supabase = createSupabaseAdminClient();
  const issuedAt = new Date().toISOString();

  const modulesSyncResult = await supabase.from("permission_modules").upsert(
    permissionModules.map((module) => ({
      module_key: module.id,
      label: module.label,
      route: module.route,
      group_key: module.group,
    })),
    {
      onConflict: "module_key",
    },
  );

  if (modulesSyncResult.error) {
    throw new Error(`Failed to sync permission modules: ${modulesSyncResult.error.message}`);
  }

  const profileUpsertResult = await supabase
    .from("profiles")
    .upsert(
      {
        legacy_id: masterPreset.legacyId,
        role: masterPreset.role,
        status: "ativo",
        name: masterPreset.name,
        email: masterPreset.email,
        phone: "(85) 98888-0999",
        zip_code: "60160-230",
        street: "Av. Santos Dumont",
        number: "2200",
        complement: "Sala 900",
        neighborhood: "Aldeota",
        city: "Fortaleza",
        state: "CE",
        country: "Brasil",
        tenant_id: null,
        updated_at: issuedAt,
      },
      {
        onConflict: "legacy_id",
      },
    )
    .select("id, auth_user_id")
    .single();

  if (profileUpsertResult.error) {
    throw new Error(`Failed to upsert master profile: ${profileUpsertResult.error.message}`);
  }

  const profile = profileUpsertResult.data;
  const permissions = buildDefaultPermissions(masterPreset.role);
  const permissionsUpsertResult = await supabase.from("user_permissions").upsert(
    permissionModules.map((module) => ({
      tenant_id: null,
      profile_id: profile.id,
      module_key: module.id,
      access_level: permissions[module.id],
    })),
    {
      onConflict: "profile_id,module_key",
    },
  );

  if (permissionsUpsertResult.error) {
    throw new Error(`Failed to upsert master permissions: ${permissionsUpsertResult.error.message}`);
  }

  const authUsers = await listAllAuthUsers();
  const existingAuthUser = authUsers.find(
    (user) => user.email?.toLowerCase() === masterPreset.email.toLowerCase(),
  );

  let authUserId = existingAuthUser?.id ?? profile.auth_user_id ?? null;

  if (existingAuthUser) {
    const updateResult = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
      email: masterPreset.email,
      password: masterPreset.password,
      email_confirm: true,
      user_metadata: {
        legacyId: masterPreset.legacyId,
        role: masterPreset.role,
        name: masterPreset.name,
        tenantId: null,
      },
      app_metadata: {
        role: masterPreset.role,
      },
    });

    if (updateResult.error) {
      throw new Error(`Failed to update master auth user: ${updateResult.error.message}`);
    }

    authUserId = updateResult.data.user?.id ?? existingAuthUser.id;
  } else {
    const createResult = await supabase.auth.admin.createUser({
      email: masterPreset.email,
      password: masterPreset.password,
      email_confirm: true,
      user_metadata: {
        legacyId: masterPreset.legacyId,
        role: masterPreset.role,
        name: masterPreset.name,
        tenantId: null,
      },
      app_metadata: {
        role: masterPreset.role,
      },
    });

    if (createResult.error) {
      throw new Error(`Failed to create master auth user: ${createResult.error.message}`);
    }

    authUserId = createResult.data.user?.id ?? null;
  }

  if (!authUserId) {
    throw new Error("Master auth user id is missing after bootstrap.");
  }

  const profileLinkResult = await supabase
    .from("profiles")
    .update({
      auth_user_id: authUserId,
      password_updated_at: issuedAt,
      updated_at: issuedAt,
    })
    .eq("id", profile.id);

  if (profileLinkResult.error) {
    throw new Error(`Failed to link master profile to auth user: ${profileLinkResult.error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        email: masterPreset.email,
        password: masterPreset.password,
        role: masterPreset.role,
        profileId: profile.id,
        authUserId,
      },
      null,
      2,
    ),
  );
}

bootstrapMasterAdmin().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
