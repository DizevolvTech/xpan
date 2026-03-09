import "server-only";

import type { DeliveryExecutionStatus } from "@/lib/delivery-execution";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isUuid,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface PersistedDeliveryExecutionEntry {
  status: DeliveryExecutionStatus;
  updatedAt: string;
}

export type PersistedDeliveryExecutionState = Record<string, PersistedDeliveryExecutionEntry>;

export async function getPersistedDeliveryExecutions(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<PersistedDeliveryExecutionState> {
  const [executionRowsResult, orderRowsResult] = await Promise.all([
    supabase.from("delivery_executions").select("order_id, status, updated_at"),
    supabase.from("store_orders").select("id, legacy_id"),
  ]);

  const executionRows = assertSupabaseResult(executionRowsResult, "Failed to load delivery executions");
  const orderRows = assertSupabaseResult(orderRowsResult, "Failed to load order ids for delivery executions");
  const orderLegacyById = new Map(orderRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  return executionRows.reduce<PersistedDeliveryExecutionState>((acc, row) => {
    const key = orderLegacyById.get(row.order_id) ?? row.order_id;
    acc[key] = {
      status: row.status,
      updatedAt: row.updated_at,
    };
    return acc;
  }, {});
}

export async function updateDeliveryExecution(
  orderId: string,
  status: DeliveryExecutionStatus,
  updatedByProfileId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const updatedByDatabaseId = await resolveProfileDatabaseId(supabase, updatedByProfileId ?? null);
  const orderQuery = supabase
    .from("store_orders")
    .select("id")
  const orderResult = await (isUuid(orderId)
    ? orderQuery.eq("id", orderId)
    : orderQuery.eq("legacy_id", orderId)).maybeSingle();
  const orderRow = assertSupabaseResult({ data: orderResult.data, error: orderResult.error }, "Failed to resolve order for delivery execution");

  const upsertResult = await supabase.from("delivery_executions").upsert(
    {
      order_id: orderRow.id,
      status,
      updated_at: new Date().toISOString(),
      updated_by_profile_id: updatedByDatabaseId,
    },
    {
      onConflict: "order_id",
    },
  );

  if (upsertResult.error) {
    throw new Error(`Failed to update delivery execution: ${upsertResult.error.message}`);
  }
}
