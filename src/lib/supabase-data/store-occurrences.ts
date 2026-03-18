import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isUuid,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface CreateStoreOccurrenceInput {
  orderId: string;
  orderItemId?: string | null;
  productId?: string | null;
  code?: string;
  productNameSnapshot: string;
  problemType: string;
  quantityType: "percentual" | "kg" | "operacional";
  quantity: number;
  quantityUnitSnapshot: string;
  description: string;
  status?: "aberta" | "em_analise" | "resolvida" | "fechada";
  openedByProfileId?: string | null;
}

type StoreOccurrenceScope = {
  allowedStoreIds?: string[] | null;
};

function filterByStoreScope<T extends { storeId: string }>(
  rows: T[],
  allowedStoreIds?: string[] | null,
) {
  if (!allowedStoreIds) {
    return rows;
  }

  return rows.filter((row) => allowedStoreIds.includes(row.storeId));
}

export async function listStoreOccurrences(
  scope: StoreOccurrenceScope = {},
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const [occurrencesResult, ordersResult, storesResult] = await Promise.all([
    supabase.from("store_occurrences").select("*").order("created_at", { ascending: false }),
    supabase.from("store_orders").select("id, legacy_id, code, store_id"),
    supabase.from("stores").select("id, legacy_id"),
  ]);

  const occurrenceRows = assertSupabaseResult(occurrencesResult, "Failed to load store occurrences");
  const orderRows = assertSupabaseResult(ordersResult, "Failed to load order ids for occurrences");
  const storeRows = assertSupabaseResult(storesResult, "Failed to load store ids for occurrences");
  const orderById = new Map(orderRows.map((row) => [row.id, row]));
  const storeLegacyById = new Map(storeRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  const mappedRows = occurrenceRows.map((row) => ({
    id: row.legacy_id ?? row.id,
    code: row.code,
    orderId: orderById.get(row.order_id)?.legacy_id ?? row.order_id,
    orderCode: orderById.get(row.order_id)?.code ?? "-",
    orderItemId: row.order_item_id,
    productId: row.product_id,
    productName: row.product_name_snapshot,
    problemType: row.problem_type,
    quantityType: row.quantity_type,
    quantity: Number(row.quantity),
    quantityUnit: row.quantity_unit_snapshot,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storeId: storeLegacyById.get(orderById.get(row.order_id)?.store_id ?? "") ?? orderById.get(row.order_id)?.store_id ?? "",
  }));

  return filterByStoreScope(mappedRows, scope.allowedStoreIds);
}

export async function createStoreOccurrence(
  input: CreateStoreOccurrenceInput,
  scope: StoreOccurrenceScope = {},
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const orderQuery = supabase.from("store_orders").select("id, legacy_id, store_id");
  const productQuery = supabase.from("products").select("id, legacy_id");
  const itemQuery = supabase.from("store_order_items").select("id, legacy_id");
  const [ordersResult, productsResult, itemsResult, existingResult] = await Promise.all([
    (isUuid(input.orderId) ? orderQuery.eq("id", input.orderId) : orderQuery.eq("legacy_id", input.orderId)),
    input.productId
      ? (isUuid(input.productId)
          ? productQuery.eq("id", input.productId)
          : productQuery.eq("legacy_id", input.productId))
      : Promise.resolve({ data: [], error: null }),
    input.orderItemId
      ? (isUuid(input.orderItemId)
          ? itemQuery.eq("id", input.orderItemId)
          : itemQuery.eq("legacy_id", input.orderItemId))
      : Promise.resolve({ data: [], error: null }),
    supabase.from("store_occurrences").select("code"),
  ]);

  const orderRows = assertSupabaseResult(ordersResult, "Failed to resolve order for occurrence");
  const productRows = assertSupabaseResult(productsResult as { data: Array<{ id: string; legacy_id: string | null }>; error: { message: string } | null }, "Failed to resolve product for occurrence");
  const itemRows = assertSupabaseResult(itemsResult as { data: Array<{ id: string; legacy_id: string | null }>; error: { message: string } | null }, "Failed to resolve order item for occurrence");
  const existingRows = assertSupabaseResult(existingResult, "Failed to load occurrence codes");

  const orderRow = orderRows[0];
  if (!orderRow) {
    throw new Error("Order not found for occurrence");
  }

  if (scope.allowedStoreIds) {
    const storesResult = await supabase.from("stores").select("id, legacy_id");
    const storeRows = assertSupabaseResult(storesResult, "Failed to resolve store scope for occurrence");
    const storeLegacyById = new Map(storeRows.map((row) => [row.id, row.legacy_id ?? row.id]));
    const orderStoreId = storeLegacyById.get(orderRow.store_id) ?? orderRow.store_id;

    if (!scope.allowedStoreIds.includes(orderStoreId)) {
      throw new Error("Authenticated store does not have access to this order");
    }
  }

  const nextCode = input.code ?? `OC-${String(existingRows.length + 1).padStart(4, "0")}`;
  const openedByProfileId = await resolveProfileDatabaseId(supabase, input.openedByProfileId ?? null);
  const legacyId = `occ-${crypto.randomUUID()}`;
  const insertResult = await supabase.from("store_occurrences").insert({
    legacy_id: legacyId,
    code: nextCode,
    order_id: orderRow.id,
    order_item_id: itemRows[0]?.id ?? null,
    product_id: productRows[0]?.id ?? null,
    product_name_snapshot: input.productNameSnapshot,
    problem_type: input.problemType,
    quantity_type: input.quantityType,
    quantity: input.quantity,
    quantity_unit_snapshot: input.quantityUnitSnapshot,
    description: input.description,
    status: input.status ?? "aberta",
    opened_by_profile_id: openedByProfileId,
  });

  if (insertResult.error) {
    throw new Error(`Failed to create occurrence: ${insertResult.error.message}`);
  }

  const createdRows = await listStoreOccurrences(scope, supabase);
  const createdOccurrence = createdRows.find((row) => row.id === legacyId || row.code === nextCode);

  if (!createdOccurrence) {
    throw new Error("Occurrence was created but could not be reloaded");
  }

  return createdOccurrence;
}
