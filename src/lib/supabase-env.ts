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

export const supabaseUrl = getEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = getEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const supabaseServiceRoleKey = getEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
export const supabaseProjectRef = process.env.SUPABASE_PROJECT_REF ?? "";
export const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN ?? "";
