import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildTenantScopedKey } from "@/lib/tenant";
export {
  assertSupabaseResult,
  resolveOptionalSupabaseResult,
  type SupabaseError,
} from "@/lib/supabase-data/result-helpers";
import type { SupabaseError } from "@/lib/supabase-data/result-helpers";

export type SupabaseDataClient = ReturnType<typeof createSupabaseAdminClient>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export function assertTenantId(tenantId?: string | null) {
  if (!tenantId) {
    throw new Error("Tenant context is required for this operation.");
  }

  return tenantId;
}

export function scopeTenantQuery<T extends { eq(column: string, value: string): T }>(
  query: T,
  tenantId: string,
) {
  return query.eq("tenant_id", tenantId);
}

export function buildTenantCacheKey(tenantId: string | null | undefined, ...parts: string[]) {
  return buildTenantScopedKey(["tenant", tenantId ?? "global", ...parts]);
}

export async function resolveProfileDatabaseId(
  supabase: SupabaseDataClient,
  identifier?: string | null,
  options: {
    tenantId?: string | null;
    allowMasterProfile?: boolean;
  } = {},
) {
  if (!identifier) {
    return null;
  }

  let query = supabase.from("profiles").select("id");
  if (options.tenantId) {
    query = query.eq("tenant_id", options.tenantId);
  } else if (!options.allowMasterProfile) {
    query = query.not("tenant_id", "is", null);
  }
  const result = await (isUuid(identifier) ? query.eq("id", identifier) : query.eq("legacy_id", identifier)).maybeSingle();

  if (result.error) {
    throw new Error(`Failed to resolve profile id: ${result.error.message}`);
  }

  return result.data?.id ?? null;
}

export function isSupabaseMissingSchemaError(
  error: SupabaseError | null | undefined,
  identifiers: string[] = [],
) {
  if (!error) {
    return false;
  }

  const text = [error.code, error.message, error.details, error.hint]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  const looksLikeMissingSchema =
    error.code === "42P01" ||
    error.code === "42703" ||
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("could not find");

  if (!looksLikeMissingSchema) {
    return false;
  }

  if (identifiers.length === 0) {
    return true;
  }

  return identifiers.some((identifier) => text.includes(identifier.toLowerCase()));
}
