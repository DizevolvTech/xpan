import "server-only";

import {
  buildStoreOccurrenceStatusUpdate,
  canOpenOccurrenceForDeliveryStatus,
  canTransitionStoreOccurrenceStatus,
  normalizeStoreOccurrenceComment,
  type StoreOccurrenceActorRole,
  validateStoreOccurrenceDraft,
} from "@/lib/store-occurrence-workflow";
import { resolveEffectiveDeliveryExecutionStatus } from "@/lib/delivery-workflow";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { allocateBusinessCode } from "@/lib/supabase-data/business-codes";
import { resolveOrderDeliveryExecutionContext } from "@/lib/supabase-data/delivery";
import { appendStoreOccurrenceEvent, listStoreOccurrenceEvents } from "@/lib/supabase-data/store-occurrence-events";
import {
  assertSupabaseResult,
  isUuid,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface StoreOccurrenceRecord {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  orderItemId: string | null;
  productId: string | null;
  productName: string;
  problemType: string;
  quantityType: "percentual" | "kg" | "operacional";
  quantity: number;
  quantityUnit: string;
  description: string;
  status: "aberta" | "em_analise" | "resolvida" | "fechada";
  createdAt: string;
  updatedAt: string;
  storeId: string;
}

export interface StoreOccurrenceDetail extends StoreOccurrenceRecord {
  canComment: boolean;
  events: Awaited<ReturnType<typeof listStoreOccurrenceEvents>>;
}

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

async function resolveOccurrenceRow(
  occurrenceId: string,
  supabase: SupabaseDataClient,
) {
  const query = supabase.from("store_occurrences").select("*");
  const result = await (isUuid(occurrenceId) ? query.eq("id", occurrenceId) : query.eq("legacy_id", occurrenceId)).maybeSingle();

  return assertSupabaseResult(
    { data: result.data, error: result.error },
    "Failed to resolve occurrence",
  );
}

async function resolveOrderStoreScope(
  orderStoreDatabaseId: string,
  scope: StoreOccurrenceScope,
  supabase: SupabaseDataClient,
) {
  if (!scope.allowedStoreIds) {
    return;
  }

  const storesResult = await supabase.from("stores").select("id, legacy_id");
  const storeRows = assertSupabaseResult(storesResult, "Failed to resolve store scope for occurrence");
  const storeLegacyById = new Map(storeRows.map((row) => [row.id, row.legacy_id ?? row.id]));
  const orderStoreId = storeLegacyById.get(orderStoreDatabaseId) ?? orderStoreDatabaseId;

  if (!scope.allowedStoreIds.includes(orderStoreId)) {
    throw new Error("Authenticated store does not have access to this order");
  }
}

async function assertOccurrenceCanBeOpened(
  orderDatabaseId: string,
  supabase: SupabaseDataClient,
) {
  const { orderStatus } = await resolveOrderDeliveryExecutionContext(orderDatabaseId, supabase);
  const executionResult = await supabase
    .from("delivery_executions")
    .select("status")
    .eq("order_id", orderDatabaseId)
    .maybeSingle();

  if (executionResult.error) {
    throw new Error(`Failed to resolve delivery execution for occurrence: ${executionResult.error.message}`);
  }

  const effectiveExecutionStatus = resolveEffectiveDeliveryExecutionStatus(
    orderStatus,
    executionResult.data?.status ?? null,
  );

  if (!canOpenOccurrenceForDeliveryStatus(effectiveExecutionStatus)) {
    throw new Error("Occurrences can only be opened for orders already on route or delivered");
  }
}

function mapOccurrenceRows(
  occurrenceRows: Array<Record<string, unknown>>,
  orderRows: Array<Record<string, unknown>>,
  storeRows: Array<Record<string, unknown>>,
): StoreOccurrenceRecord[] {
  const orderById = new Map(orderRows.map((row) => [String(row.id), row]));
  const storeLegacyById = new Map(storeRows.map((row) => [String(row.id), String(row.legacy_id ?? row.id)]));

  return occurrenceRows.map((row) => {
    const orderRow = orderById.get(String(row.order_id));
    const storeId = orderRow ? storeLegacyById.get(String(orderRow.store_id)) ?? String(orderRow.store_id) : "";

    return {
      id: String(row.legacy_id ?? row.id),
      code: String(row.code),
      orderId: orderRow ? String(orderRow.legacy_id ?? orderRow.id) : String(row.order_id),
      orderCode: orderRow ? String(orderRow.code) : "-",
      orderItemId: row.order_item_id ? String(row.order_item_id) : null,
      productId: row.product_id ? String(row.product_id) : null,
      productName: String(row.product_name_snapshot),
      problemType: String(row.problem_type),
      quantityType: row.quantity_type as StoreOccurrenceRecord["quantityType"],
      quantity: Number(row.quantity),
      quantityUnit: String(row.quantity_unit_snapshot),
      description: String(row.description),
      status: row.status as StoreOccurrenceRecord["status"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      storeId,
    };
  });
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

  return filterByStoreScope(mapOccurrenceRows(occurrenceRows, orderRows, storeRows), scope.allowedStoreIds);
}

export async function getStoreOccurrenceDetail(
  occurrenceId: string,
  scope: StoreOccurrenceScope = {},
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<StoreOccurrenceDetail> {
  const allOccurrences = await listStoreOccurrences(scope, supabase);
  const occurrence = allOccurrences.find((item) => item.id === occurrenceId);

  if (!occurrence) {
    throw new Error("Occurrence not found");
  }

  return {
    ...occurrence,
    canComment: true,
    events: await listStoreOccurrenceEvents(occurrence.id, supabase),
  };
}

export async function createStoreOccurrence(
  input: CreateStoreOccurrenceInput,
  scope: StoreOccurrenceScope = {},
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const normalizedInput = validateStoreOccurrenceDraft({
    problemType: input.problemType,
    quantityType: input.quantityType,
    quantity: input.quantity,
    quantityUnitSnapshot: input.quantityUnitSnapshot,
    productNameSnapshot: input.productNameSnapshot,
    description: input.description,
  });
  const orderQuery = supabase.from("store_orders").select("id, legacy_id, store_id");
  const productQuery = supabase.from("products").select("id, legacy_id");
  const itemQuery = supabase.from("store_order_items").select("id, legacy_id, order_id, product_id");
  const [ordersResult, productsResult, itemsResult] = await Promise.all([
    isUuid(input.orderId) ? orderQuery.eq("id", input.orderId) : orderQuery.eq("legacy_id", input.orderId),
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
  ]);

  const orderRows = assertSupabaseResult(ordersResult, "Failed to resolve order for occurrence");
  const productRows = assertSupabaseResult(
    productsResult as { data: Array<{ id: string; legacy_id: string | null }>; error: { message: string } | null },
    "Failed to resolve product for occurrence",
  );
  const itemRows = assertSupabaseResult(
    itemsResult as {
      data: Array<{ id: string; legacy_id: string | null; order_id: string; product_id: string }>;
      error: { message: string } | null;
    },
    "Failed to resolve order item for occurrence",
  );

  const orderRow = orderRows[0];
  if (!orderRow) {
    throw new Error("Order not found for occurrence");
  }

  const productRow = productRows[0] ?? null;
  const itemRow = itemRows[0] ?? null;

  if (input.productId && !productRow) {
    throw new Error("Product not found for occurrence");
  }

  if (input.orderItemId && !itemRow) {
    throw new Error("Order item not found for occurrence");
  }

  if (itemRow && itemRow.order_id !== orderRow.id) {
    throw new Error("Selected order item does not belong to the informed order");
  }

  if (itemRow && productRow && itemRow.product_id !== productRow.id) {
    throw new Error("Selected product does not match the informed order item");
  }

  await resolveOrderStoreScope(orderRow.store_id, scope, supabase);
  await assertOccurrenceCanBeOpened(orderRow.id, supabase);

  const createdAtIso = new Date().toISOString();
  const nextCode = input.code ?? (await allocateBusinessCode("OC", createdAtIso, supabase));
  const openedByProfileId = await resolveProfileDatabaseId(supabase, input.openedByProfileId ?? null);
  const legacyId = `occ-${crypto.randomUUID()}`;
  const insertResult = await supabase.from("store_occurrences").insert({
    legacy_id: legacyId,
    code: nextCode,
    order_id: orderRow.id,
    order_item_id: itemRow?.id ?? null,
    product_id: productRow?.id ?? itemRow?.product_id ?? null,
    product_name_snapshot: normalizedInput.productNameSnapshot,
    problem_type: normalizedInput.problemType,
    quantity_type: normalizedInput.quantityType,
    quantity: normalizedInput.quantity,
    quantity_unit_snapshot: normalizedInput.quantityUnitSnapshot,
    description: normalizedInput.description,
    status: input.status ?? "aberta",
    opened_by_profile_id: openedByProfileId,
  });

  if (insertResult.error) {
    throw new Error(`Failed to create occurrence: ${insertResult.error.message}`);
  }

  await appendStoreOccurrenceEvent(
    {
      occurrenceId: legacyId,
      type: "criacao",
      content: `Ocorrência ${nextCode} aberta: ${normalizedInput.problemType}.`,
      createdByProfileId: input.openedByProfileId ?? null,
      metadata: {
        quantity: normalizedInput.quantity,
        quantityType: normalizedInput.quantityType,
      },
    },
    supabase,
  );

  return getStoreOccurrenceDetail(legacyId, scope, supabase);
}

export async function updateStoreOccurrenceStatus(
  input: {
    occurrenceId: string;
    status: StoreOccurrenceRecord["status"];
    actorRole: StoreOccurrenceActorRole;
    updatedByProfileId?: string | null;
  },
  scope: StoreOccurrenceScope = {},
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const occurrenceRow = await resolveOccurrenceRow(input.occurrenceId, supabase);
  const orderRowsResult = await supabase
    .from("store_orders")
    .select("id, store_id")
    .eq("id", occurrenceRow.order_id);
  const orderRows = assertSupabaseResult(orderRowsResult, "Failed to resolve occurrence order");
  const orderRow = orderRows[0];

  if (!orderRow) {
    throw new Error("Order not found for occurrence");
  }

  await resolveOrderStoreScope(orderRow.store_id, scope, supabase);

  const currentStatus = occurrenceRow.status as StoreOccurrenceRecord["status"];
  if (!canTransitionStoreOccurrenceStatus(currentStatus, input.status, input.actorRole)) {
    throw new Error("Invalid occurrence status transition");
  }

  const updatedByProfileDatabaseId = await resolveProfileDatabaseId(
    supabase,
    input.updatedByProfileId ?? null,
  );
  const updatePayload = buildStoreOccurrenceStatusUpdate(
    currentStatus,
    input.status,
    updatedByProfileDatabaseId,
  );

  const updateResult = await supabase
    .from("store_occurrences")
    .update(updatePayload)
    .eq("id", occurrenceRow.id);

  if (updateResult.error) {
    throw new Error(`Failed to update occurrence: ${updateResult.error.message}`);
  }

  await appendStoreOccurrenceEvent(
    {
      occurrenceId: occurrenceRow.legacy_id ?? occurrenceRow.id,
      type: "mudanca_status",
      content: `Status alterado de "${currentStatus}" para "${input.status}".`,
      createdByProfileId: input.updatedByProfileId ?? null,
      metadata: {
        from: currentStatus,
        to: input.status,
      },
    },
    supabase,
  );

  return getStoreOccurrenceDetail(occurrenceRow.legacy_id ?? occurrenceRow.id, scope, supabase);
}

export async function addStoreOccurrenceComment(
  input: {
    occurrenceId: string;
    content: string;
    createdByProfileId?: string | null;
  },
  scope: StoreOccurrenceScope = {},
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const occurrenceRow = await resolveOccurrenceRow(input.occurrenceId, supabase);
  const orderRowsResult = await supabase
    .from("store_orders")
    .select("id, store_id")
    .eq("id", occurrenceRow.order_id);
  const orderRows = assertSupabaseResult(orderRowsResult, "Failed to resolve occurrence order");
  const orderRow = orderRows[0];

  if (!orderRow) {
    throw new Error("Order not found for occurrence");
  }

  await resolveOrderStoreScope(orderRow.store_id, scope, supabase);
  const content = normalizeStoreOccurrenceComment(input.content);

  const touchResult = await supabase
    .from("store_occurrences")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", occurrenceRow.id);

  if (touchResult.error) {
    throw new Error(`Failed to update occurrence activity: ${touchResult.error.message}`);
  }

  await appendStoreOccurrenceEvent(
    {
      occurrenceId: occurrenceRow.legacy_id ?? occurrenceRow.id,
      type: "comentario",
      content,
      createdByProfileId: input.createdByProfileId ?? null,
    },
    supabase,
  );

  return getStoreOccurrenceDetail(occurrenceRow.legacy_id ?? occurrenceRow.id, scope, supabase);
}
