import "server-only";

import {
  formatFallbackBusinessCode,
  formatMonotonicBusinessCode,
  getBusinessCodeScopeKey,
  type BusinessCodePrefix,
} from "@/lib/business-code";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isSupabaseMissingSchemaError,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export async function allocateBusinessCode(
  prefix: BusinessCodePrefix,
  dateIso: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const scopeKey = getBusinessCodeScopeKey(dateIso);
  const result = await supabase.rpc("next_business_code_number", {
    p_prefix: prefix,
    p_scope_key: scopeKey,
  });

  if (isSupabaseMissingSchemaError(result.error, ["next_business_code_number", "business_code_sequences"])) {
    return formatFallbackBusinessCode(prefix, dateIso);
  }

  const nextValue = Number(
    assertSupabaseResult(
      { data: result.data, error: result.error },
      "Failed to allocate monotonic business code",
    ),
  );

  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    throw new Error("Failed to allocate monotonic business code: invalid sequence value");
  }

  return formatMonotonicBusinessCode(prefix, nextValue, dateIso);
}
