type RequiredEnvironmentVariable =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY";

function getEnvironmentVariable(name: RequiredEnvironmentVariable) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseUrl() {
  return getEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return getEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey() {
  return getEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
}

export function getSupabaseProjectRef() {
  return process.env.SUPABASE_PROJECT_REF ?? "";
}

export function getSupabaseAccessToken() {
  return process.env.SUPABASE_ACCESS_TOKEN ?? "";
}
