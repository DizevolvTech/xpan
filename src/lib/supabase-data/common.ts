import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export type SupabaseDataClient = ReturnType<typeof createSupabaseAdminClient>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export async function resolveProfileDatabaseId(
  supabase: SupabaseDataClient,
  identifier?: string | null,
) {
  if (!identifier) {
    return null;
  }

  const query = supabase.from("profiles").select("id");
  const result = await (isUuid(identifier) ? query.eq("id", identifier) : query.eq("legacy_id", identifier)).maybeSingle();

  if (result.error) {
    throw new Error(`Failed to resolve profile id: ${result.error.message}`);
  }

  return result.data?.id ?? null;
}

export function assertSupabaseResult<T>(result: SupabaseResult<T>, message: string): T {
  if (result.error) {
    throw new Error(`${message}: ${result.error.message}`);
  }

  if (result.data === null) {
    throw new Error(`${message}: no data returned`);
  }

  return result.data;
}
