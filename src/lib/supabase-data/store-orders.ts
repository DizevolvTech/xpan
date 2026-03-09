import "server-only";

import type { UnitCode } from "@/lib/factory-planning/units";
import type { FactoryPlanningInput, StoreOrder, StoreProfile } from "@/lib/order-planning";
import { getBaseDateByCutoff, getDeliveryDateByStoreRule } from "@/lib/order-planning";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";

export interface CreateStoreOrderInput {
  storeId: string;
  createdByProfileId?: string | null;
  orderedAt?: string;
  note?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unit: UnitCode;
  }>;
}

function formatDatePart(dateIso: string) {
  return dateIso.slice(2, 10).replaceAll("-", "");
}

export async function listFactoryStoreOrders(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<StoreOrder[]> {
  const [ordersResult, itemsResult, storesResult, productsResult] = await Promise.all([
    supabase.from("store_orders").select("id, legacy_id, code, store_id, ordered_at").order("ordered_at", { ascending: false }),
    supabase
      .from("store_order_items")
      .select("id, legacy_id, order_id, product_id, requested_quantity, requested_unit")
      .order("created_at", { ascending: true }),
    supabase.from("stores").select("id, legacy_id"),
    supabase.from("products").select("id, legacy_id"),
  ]);

  const orderRows = assertSupabaseResult(ordersResult, "Failed to load store orders");
  const itemRows = assertSupabaseResult(itemsResult, "Failed to load store order items");
  const storeRows = assertSupabaseResult(storesResult, "Failed to load store ids");
  const productRows = assertSupabaseResult(productsResult, "Failed to load product ids");

  const storeLegacyById = new Map(storeRows.map((row) => [row.id, row.legacy_id ?? row.id]));
  const productLegacyById = new Map(productRows.map((row) => [row.id, row.legacy_id ?? row.id]));
  const itemsByOrderId = itemRows.reduce<Map<string, StoreOrder["items"]>>((acc, row) => {
    const current = acc.get(row.order_id) ?? [];
    current.push({
      id: row.legacy_id ?? row.id,
      productId: productLegacyById.get(row.product_id) ?? row.product_id,
      quantity: Number(row.requested_quantity),
      unit: row.requested_unit as UnitCode,
    });
    acc.set(row.order_id, current);
    return acc;
  }, new Map());

  return orderRows.map((row) => ({
    id: row.legacy_id ?? row.id,
    code: row.code,
    storeId: storeLegacyById.get(row.store_id) ?? row.store_id,
    orderedAt: row.ordered_at,
    items: itemsByOrderId.get(row.id) ?? [],
  }));
}

export async function buildFactoryInputFromDb(
  options: {
    supabase?: SupabaseDataClient;
    includeProfileNames?: boolean;
  } = {},
): Promise<FactoryPlanningInput> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const [snapshot, storeOrders] = await Promise.all([
    getMasterDataSnapshot({
      supabase,
      includeProfileNames: options.includeProfileNames,
    }),
    listFactoryStoreOrders(supabase),
  ]);

  return {
    stores: snapshot.stores.map<StoreProfile>((store) => ({
      id: store.id,
      code: store.code,
      name: store.name,
      orderingDays: store.orderingDays,
      receivingDays: store.receivingDays,
      receiveWindow: store.receiveWindow,
    })),
    storeOrders,
    settings: snapshot.operationalSettings,
    sectors: snapshot.sectors,
    lines: snapshot.lines,
    products: snapshot.products,
    schedules: snapshot.schedules,
  };
}

export async function createStoreOrder(
  input: CreateStoreOrderInput,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<{ orderId: string; code: string }> {
  const snapshot = await getMasterDataSnapshot({
    supabase,
    includeProfileNames: false,
  });
  const store = snapshot.stores.find((row) => row.id === input.storeId);

  if (!store) {
    throw new Error("Store not found");
  }

  if (input.items.length === 0) {
    throw new Error("Store order must contain at least one item");
  }

  const orderedAt = input.orderedAt ?? new Date().toISOString();
  const createdByProfileDatabaseId = await resolveProfileDatabaseId(supabase, input.createdByProfileId ?? null);
  const baseDate = getBaseDateByCutoff(orderedAt, snapshot.operationalSettings.orderCutoffTime);
  const deliveryDate = getDeliveryDateByStoreRule(baseDate, {
    id: store.id,
    code: store.code,
    name: store.name,
    orderingDays: store.orderingDays,
    receivingDays: store.receivingDays,
    receiveWindow: store.receiveWindow,
  }, snapshot.operationalSettings);

  const existingOrdersResult = await supabase.from("store_orders").select("code");
  const existingOrders = assertSupabaseResult(existingOrdersResult, "Failed to load existing store orders");
  const nextSequence = existingOrders.length + 1;
  const code = `PD-${formatDatePart(orderedAt)}-${String(nextSequence).padStart(4, "0")}`;

  const storeIdResult = await supabase
    .from("stores")
    .select("id")
    .eq("legacy_id", input.storeId)
    .maybeSingle();
  const storeIdRow = assertSupabaseResult({ data: storeIdResult.data, error: storeIdResult.error }, "Failed to resolve store id");

  const productIdsResult = await supabase
    .from("products")
    .select("id, legacy_id, code, name, sales_to_kg_factor, expedition_unit, expedition_to_kg_factor, production_unit");
  const productRows = assertSupabaseResult(productIdsResult, "Failed to resolve product ids");
  const productByLegacyId = new Map(productRows.map((row) => [row.legacy_id ?? row.id, row]));

  const insertOrderResult = await supabase
    .from("store_orders")
    .insert({
      legacy_id: `order-${crypto.randomUUID()}`,
      code,
      store_id: storeIdRow.id,
      created_by_profile_id: createdByProfileDatabaseId,
      ordered_at: orderedAt,
      base_date: baseDate,
      delivery_date: deliveryDate,
      receive_window_snapshot: store.receiveWindow,
      expedition_lead_days_snapshot: snapshot.operationalSettings.expeditionLeadDays,
      note: input.note ?? "",
    })
    .select("id, legacy_id, code")
    .single();
  const insertedOrder = assertSupabaseResult(insertOrderResult, "Failed to create store order");

  const orderItems = input.items.map((item, index) => {
    const product = productByLegacyId.get(item.productId);
    if (!product) {
      throw new Error(`Product not found for store order item: ${item.productId}`);
    }

    return {
      legacy_id: `${insertedOrder.legacy_id ?? insertedOrder.id}-item-${index + 1}`,
      order_id: insertedOrder.id,
      product_id: product.id,
      product_code_snapshot: product.code,
      product_name_snapshot: product.name,
      requested_quantity: item.quantity,
      requested_unit: item.unit,
      sales_to_kg_factor_snapshot: product.sales_to_kg_factor,
      internal_kg_snapshot: Number((item.quantity * Number(product.sales_to_kg_factor)).toFixed(3)),
      expedition_unit_snapshot: product.expedition_unit,
      expedition_to_kg_factor_snapshot: product.expedition_to_kg_factor,
      operational_unit_snapshot: product.production_unit,
    };
  });

  const insertItemsResult = await supabase.from("store_order_items").insert(orderItems);
  if (insertItemsResult.error) {
    throw new Error(`Failed to create store order items: ${insertItemsResult.error.message}`);
  }

  return {
    orderId: insertedOrder.legacy_id ?? insertedOrder.id,
    code: insertedOrder.code,
  };
}
