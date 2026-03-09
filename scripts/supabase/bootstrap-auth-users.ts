import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

import { buildTemporaryPassword } from "../../src/lib/auth-credentials";
import { demoCredentialPresets } from "../../src/lib/demo-credentials";

type AuthUserSummary = {
  id: string;
  email?: string;
};

const dryRun = process.argv.includes("--dry-run");
const exportFileArgument = process.argv.find((arg) => arg.startsWith("--export="));
const exportFilePath = exportFileArgument
  ? resolve(process.cwd(), exportFileArgument.slice("--export=".length))
  : null;

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase environment variables for auth bootstrap.");
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

async function bootstrapAuthUsers() {
  const supabase = createSupabaseAdminClient();
  const profilesResult = await supabase
    .from("profiles")
    .select("id, legacy_id, email, auth_user_id, name, role");

  if (profilesResult.error) {
    throw new Error(`Failed to load profiles: ${profilesResult.error.message}`);
  }

  const profiles = profilesResult.data ?? [];
  const authUsers = await listAllAuthUsers();
  const authUserByEmail = new Map(
    authUsers.map((user) => [user.email?.toLowerCase() ?? "", user]),
  );
  const presetByLegacyId = new Map(
    demoCredentialPresets.map((preset) => [preset.legacyId, preset]),
  );
  const presetByEmail = new Map(
    demoCredentialPresets.map((preset) => [preset.email.toLowerCase(), preset]),
  );

  const summary: string[] = [];
  const issuedCredentials: Array<{
    email: string;
    role: string;
    name: string;
    password: string;
    source: "preset" | "generated";
  }> = [];

  for (const profile of profiles) {
    const preset =
      (profile.legacy_id ? presetByLegacyId.get(profile.legacy_id) : undefined) ??
      presetByEmail.get(profile.email.toLowerCase());
    const email = preset?.email ?? profile.email;
    const role = preset?.role ?? profile.role;
    const name = preset?.name ?? profile.name;
    const password = preset?.password ?? buildTemporaryPassword(email, role);
    const source = preset ? "preset" : "generated";
    const existingAuthUser = authUserByEmail.get(email.toLowerCase());

    if (dryRun) {
      summary.push(
        `${existingAuthUser ? "UPDATE" : "CREATE"} ${email} -> ${name} (${role}) [${source}]`,
      );
      continue;
    }

    let authUserId = existingAuthUser?.id ?? profile.auth_user_id ?? null;

    if (existingAuthUser) {
      const updateResult = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
        email,
        password,
        email_confirm: true,
        user_metadata: {
          legacyId: profile.legacy_id ?? profile.id,
          role,
          name,
        },
      });

      if (updateResult.error) {
        throw new Error(`Failed to update auth user ${email}: ${updateResult.error.message}`);
      }

      authUserId = updateResult.data.user?.id ?? existingAuthUser.id;
      summary.push(`UPDATE ${email} -> auth user sincronizado [${source}]`);
    } else {
      const createResult = await supabase.auth.admin.createUser({
        email,
        password,
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
      summary.push(`CREATE ${email} -> auth user criado [${source}]`);
    }

    if (!authUserId) {
      throw new Error(`Auth user id missing for ${email}`);
    }

    const profileUpdateResult = await supabase
      .from("profiles")
      .update({
        auth_user_id: authUserId,
        password_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (profileUpdateResult.error) {
      throw new Error(`Failed to link profile ${email}: ${profileUpdateResult.error.message}`);
    }

    issuedCredentials.push({
      email,
      role,
      name,
      password,
      source,
    });
  }

  for (const line of summary) {
    console.log(line);
  }

  if (exportFilePath && !dryRun) {
    await mkdir(dirname(exportFilePath), { recursive: true });
    await writeFile(exportFilePath, JSON.stringify(issuedCredentials, null, 2), "utf-8");
    console.log(`EXPORT ${exportFilePath}`);
  }
}

bootstrapAuthUsers().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
