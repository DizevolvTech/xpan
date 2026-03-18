import "server-only";

import type { ProductionItemStatus } from "@/lib/order-planning";
import { productionStageProgress } from "@/lib/order-planning";
import { canTransitionProductionItemStatus } from "@/lib/production-workflow";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isSupabaseMissingSchemaError,
  isUuid,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface PersistedWorkflowState {
  releasedOrders: string[];
  productionItemStatuses: Record<string, ProductionItemStatus>;
}

export async function getPersistedWorkflowState(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<PersistedWorkflowState> {
  const [releasesResult, statusesResult, ordersResult] = await Promise.all([
    supabase.from("workflow_order_releases").select("order_id"),
    supabase.from("workflow_production_items").select("production_item_key, status"),
    supabase.from("store_orders").select("id, legacy_id"),
  ]);

  const orderRows = assertSupabaseResult(ordersResult, "Failed to load order ids");
  const releaseRows = isSupabaseMissingSchemaError(releasesResult.error, ["workflow_order_releases"])
    ? []
    : assertSupabaseResult(releasesResult, "Failed to load workflow releases");
  const statusRows = isSupabaseMissingSchemaError(statusesResult.error, ["workflow_production_items"])
    ? []
    : assertSupabaseResult(statusesResult, "Failed to load workflow statuses");

  const orderLegacyById = new Map(orderRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  return {
    releasedOrders: releaseRows
      .map((row) => orderLegacyById.get(row.order_id) ?? row.order_id)
      .filter((value, index, all) => all.indexOf(value) === index),
    productionItemStatuses: statusRows.reduce<Record<string, ProductionItemStatus>>((acc, row) => {
      acc[row.production_item_key] = row.status;
      return acc;
    }, {}),
  };
}

export async function releaseOrder(
  orderId: string,
  releasedByProfileId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const releasedByDatabaseId = await resolveProfileDatabaseId(supabase, releasedByProfileId ?? null);
  const orderQuery = supabase
    .from("store_orders")
    .select("id")
  const orderResult = await (isUuid(orderId)
    ? orderQuery.eq("id", orderId)
    : orderQuery.eq("legacy_id", orderId)).maybeSingle();
  const orderRow = assertSupabaseResult({ data: orderResult.data, error: orderResult.error }, "Failed to resolve order for release");

  const upsertResult = await supabase.from("workflow_order_releases").upsert(
    {
      order_id: orderRow.id,
      released_at: new Date().toISOString(),
      released_by_profile_id: releasedByDatabaseId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "order_id",
    },
  );

  if (upsertResult.error) {
    throw new Error(`Failed to release order: ${upsertResult.error.message}`);
  }
}

export async function updateProductionItemStatus(
  productionItemKey: string,
  status: ProductionItemStatus,
  updatedByProfileId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const updatedByDatabaseId = await resolveProfileDatabaseId(supabase, updatedByProfileId ?? null);
  const currentResult = await supabase
    .from("workflow_production_items")
    .select("status")
    .eq("production_item_key", productionItemKey)
    .maybeSingle();
  const currentRow = assertSupabaseResult(
    { data: currentResult.data, error: currentResult.error },
    "Failed to load current production item status",
  );
  const currentStatus = currentRow?.status ?? "nao_iniciado";

  if (!canTransitionProductionItemStatus(currentStatus, status)) {
    throw new Error("Invalid production workflow transition");
  }

  const upsertResult = await supabase.from("workflow_production_items").upsert(
    {
      production_item_key: productionItemKey,
      status,
      progress: productionStageProgress[status],
      updated_at: new Date().toISOString(),
      updated_by_profile_id: updatedByDatabaseId,
    },
    {
      onConflict: "production_item_key",
    },
  );

  if (upsertResult.error) {
    throw new Error(`Failed to update production item status: ${upsertResult.error.message}`);
  }
}
