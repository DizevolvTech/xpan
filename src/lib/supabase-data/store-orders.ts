import "server-only";

import { isDiscreteUnit, type UnitCode } from "@/lib/factory-planning/units";
import type { FactoryPlanningInput, StoreOrder, StoreProfile } from "@/lib/order-planning";
import { getOperationalOrderWindow } from "@/lib/order-planning";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildStoreOrderCatalog } from "@/lib/store-order-catalog";
import { allocateBusinessCode } from "@/lib/supabase-data/business-codes";
import { appendStoreOrderEvent } from "@/lib/supabase-data/store-order-events";
import { planStoreOrdersToOpen } from "@/lib/store-order-open-plan";
import { resolveFilledStatus, type StoreOrderLifecycleStatus } from "@/lib/store-order-lifecycle";
import {
  assertSupabaseResult,
  isUuid,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";

export interface CreateStoreOrderInput {
  storeId: string;
  createdByProfileId?: string | null;
  tenantId?: string | null;
  orderedAt?: string;
  note?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unit: UnitCode;
  }>;
}

export interface UpdateStoreOrderInput {
  note?: string;
  tenantId?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    unit: UnitCode;
  }>;
  updatedByProfileId?: string | null;
}

type OrderProductRow = {
  id: string;
  legacy_id: string | null;
  code: string;
  name: string;
  sales_unit: UnitCode;
  sales_to_kg_factor: number;
  expedition_unit: UnitCode;
  expedition_to_kg_factor: number;
  production_unit: UnitCode;
};

type ResolvedStoreOrderRow = {
  id: string;
  legacy_id: string | null;
  code: string;
  store_id: string;
  ordered_at: string;
  management_status: "ativo" | "cancelado";
  note: string;
  status: StoreOrderLifecycleStatus;
};

type ValidatedStoreOrderItem = {
  item: CreateStoreOrderInput["items"][number];
  product: OrderProductRow;
};

function dedupeItems(items: CreateStoreOrderInput["items"]) {
  const seen = new Set<string>();

  items.forEach((item) => {
    if (seen.has(item.productId)) {
      throw new Error(`Produto repetido no pedido: ${item.productId}`);
    }
    seen.add(item.productId);
  });

  return items;
}

async function resolveStoreOrderRow(
  orderId: string,
  supabase: SupabaseDataClient,
): Promise<ResolvedStoreOrderRow> {
  const query = supabase
    .from("store_orders")
    .select("id, legacy_id, code, store_id, ordered_at, management_status, note, status");
  const result = await (isUuid(orderId) ? query.eq("id", orderId) : query.eq("legacy_id", orderId)).maybeSingle();

  return assertSupabaseResult(
    { data: result.data, error: result.error },
    "Failed to resolve store order",
  ) as ResolvedStoreOrderRow;
}

async function ensureOrderIsMutable(orderId: string, supabase: SupabaseDataClient) {
  const orderRow = await resolveStoreOrderRow(orderId, supabase);

  if (orderRow.management_status === "cancelado") {
    throw new Error("Cancelled orders cannot be edited");
  }

  const releaseResult = await supabase
    .from("workflow_order_releases")
    .select("id")
    .eq("order_id", orderRow.id)
    .maybeSingle();

  if (releaseResult.error) {
    throw new Error(`Failed to verify order release state: ${releaseResult.error.message}`);
  }

  if (releaseResult.data) {
    throw new Error("Orders already released to production cannot be edited");
  }

  return orderRow;
}

async function resolveStoreDatabaseId(
  legacyStoreId: string,
  supabase: SupabaseDataClient,
) {
  const result = await supabase.from("stores").select("id").eq("legacy_id", legacyStoreId).maybeSingle();
  const row = assertSupabaseResult(
    { data: result.data, error: result.error },
    "Failed to resolve store id",
  );
  return row.id;
}

async function loadOrderProductRows(supabase: SupabaseDataClient) {
  const productsResult = await supabase
    .from("products")
    .select("id, legacy_id, code, name, sales_unit, sales_to_kg_factor, expedition_unit, expedition_to_kg_factor, production_unit");

  return assertSupabaseResult(productsResult, "Failed to resolve product ids") as OrderProductRow[];
}

async function validateStoreOrderItems(
  items: CreateStoreOrderInput["items"],
  options: {
    storeId: string;
    orderedAt: string;
    tenantId: string;
    supabase: SupabaseDataClient;
  },
) {
  const normalizedItems = dedupeItems(items);
  if (normalizedItems.length === 0) {
    throw new Error("Store order must contain at least one item");
  }

  const snapshot = await getMasterDataSnapshot({
    supabase: options.supabase,
    includeProfileNames: false,
    tenantId: options.tenantId,
    // AJ-0024: valida/salva pedido sempre contra dados frescos — o snapshot tem
    // TTL de 15s e o 1º pedido de um tenant novo caía num cache vazio/defasado.
    forceRefresh: true,
  });
  const store = snapshot.stores.find((row) => row.id === options.storeId);

  if (!store) {
    throw new Error("Store not found");
  }

  const orderWindow = getOperationalOrderWindow(
    options.orderedAt,
    {
      id: store.id,
      code: store.code,
      name: store.name,
      orderingDays: store.orderingDays,
      receivingDays: store.receivingDays,
      orderingBlockedDays: store.orderingBlockedDays,
      receivingBlockedDays: store.receivingBlockedDays,
      receiveWindow: store.receiveWindow,
    },
    snapshot.operationalSettings,
  );
  const availableCatalog = buildStoreOrderCatalog(snapshot, {
    storeId: store.id,
    orderedAt: options.orderedAt,
  });
  const catalogByProductId = new Map(availableCatalog.map((product) => [product.productId, product]));
  const productRows = await loadOrderProductRows(options.supabase);
  const productByLegacyId = new Map(productRows.map((row) => [row.legacy_id ?? row.id, row]));

  const validatedItems = normalizedItems.map<ValidatedStoreOrderItem>((item) => {
    const product = productByLegacyId.get(item.productId);
    const catalogEntry = catalogByProductId.get(item.productId);

    if (!product) {
      throw new Error(`Product not found for store order item: ${item.productId}`);
    }

    if (!catalogEntry) {
      throw new Error(`Product unavailable for the operational order window: ${product.code}`);
    }

    if (!catalogEntry.available) {
      throw new Error(
        catalogEntry.blockedReason
          ? `${catalogEntry.blockedReason} (${product.code})`
          : `Product unavailable for the operational order window: ${product.code}`,
      );
    }

    if (item.unit !== catalogEntry.unit || item.unit !== product.sales_unit) {
      throw new Error(`Invalid unit for store order item: ${product.code}`);
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error(`Invalid quantity for store order item: ${product.code}`);
    }

    if (isDiscreteUnit(catalogEntry.unit) && !Number.isInteger(item.quantity)) {
      throw new Error(`Discrete units only accept whole numbers: ${product.code}`);
    }

    return { item, product };
  });

  return {
    snapshot,
    store,
    orderWindow,
    validatedItems,
  };
}

async function replaceStoreOrderItems(
  orderDatabaseId: string,
  orderLegacyId: string,
  validatedItems: ValidatedStoreOrderItem[],
  supabase: SupabaseDataClient,
) {
  const deleteResult = await supabase.from("store_order_items").delete().eq("order_id", orderDatabaseId);
  if (deleteResult.error) {
    throw new Error(`Failed to replace store order items: ${deleteResult.error.message}`);
  }

  const orderItems = validatedItems.map(({ item, product }, index) => ({
    legacy_id: `${orderLegacyId}-item-${index + 1}`,
    order_id: orderDatabaseId,
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
  }));

  const insertItemsResult = await supabase.from("store_order_items").insert(orderItems);
  if (insertItemsResult.error) {
    throw new Error(`Failed to create store order items: ${insertItemsResult.error.message}`);
  }
}

export async function listFactoryStoreOrders(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<StoreOrder[]> {
  const [ordersResult, itemsResult, storesResult, productsResult] = await Promise.all([
    supabase
      .from("store_orders")
      .select("id, legacy_id, code, store_id, ordered_at")
      .order("ordered_at", { ascending: false }),
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
    tenantId?: string | null;
  } = {},
): Promise<FactoryPlanningInput> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const [snapshot, storeOrders] = await Promise.all([
    getMasterDataSnapshot({
      supabase,
      includeProfileNames: options.includeProfileNames,
      tenantId: options.tenantId,
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
      orderingBlockedDays: store.orderingBlockedDays,
      receivingBlockedDays: store.receivingBlockedDays,
      receiveWindow: store.receiveWindow,
      deliveryZone: store.deliveryZone ?? null,
    })),
    storeOrders,
    settings: snapshot.operationalSettings,
    sectors: snapshot.sectors,
    lines: snapshot.lines,
    products: snapshot.products,
    ingredients: snapshot.ingredients,
    schedules: snapshot.schedules,
  };
}

export async function createStoreOrder(
  input: CreateStoreOrderInput,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<{ orderId: string; code: string }> {
  const orderedAt = input.orderedAt ?? new Date().toISOString();
  const createdByProfileDatabaseId = await resolveProfileDatabaseId(
    supabase,
    input.createdByProfileId ?? null,
    {
      tenantId: input.tenantId,
    },
  );
  const { snapshot, store, orderWindow, validatedItems } = await validateStoreOrderItems(input.items, {
    storeId: input.storeId,
    orderedAt,
    tenantId: input.tenantId ?? "",
    supabase,
  });
  const storeDatabaseId = await resolveStoreDatabaseId(input.storeId, supabase);

  // Check for existing active order for the same store + delivery date
  const existingOrderResult = await supabase
    .from("store_orders")
    .select("id, code")
    .eq("store_id", storeDatabaseId)
    .eq("delivery_date", orderWindow.deliveryDate)
    .eq("management_status", "ativo")
    .maybeSingle();

  if (existingOrderResult.data) {
    throw new Error(
      `Já existe um pedido ativo (${existingOrderResult.data.code}) para esta loja na data ${orderWindow.deliveryDate}. Use a opção Editar no pedido existente.`,
    );
  }

  const legacyId = `order-${crypto.randomUUID()}`;
  const code = await allocateBusinessCode("PD", orderedAt, supabase);

  const insertOrderResult = await supabase
    .from("store_orders")
    .insert({
      legacy_id: legacyId,
      code,
      store_id: storeDatabaseId,
      created_by_profile_id: createdByProfileDatabaseId,
      ordered_at: orderedAt,
      base_date: orderWindow.baseDate,
      delivery_date: orderWindow.deliveryDate,
      receive_window_snapshot: store.receiveWindow,
      expedition_lead_days_snapshot: snapshot.operationalSettings.expeditionLeadDays,
      note: input.note ?? "",
      // AJ-0009 Fase 4a: pedido criado pela loja nasce "preenchido". Deixamos o
      // DEFAULT da coluna (migration 20260530120000) cuidar disso — assim o código é
      // forward-compatible (funciona antes E depois da migration). O ciclo
      // aberto→preenchido só vale com a flag FACTORY_OPENS_ORDERS ligada (rollout gated).
    })
    .select("id, legacy_id, code")
    .single();
  const insertedOrder = assertSupabaseResult(insertOrderResult, "Failed to create store order");

  await replaceStoreOrderItems(
    insertedOrder.id,
    insertedOrder.legacy_id ?? insertedOrder.id,
    validatedItems,
    supabase,
  );
  await appendStoreOrderEvent(
    {
      orderId: insertedOrder.id,
      type: "criacao",
      title: "Pedido criado",
      description: `Pedido ${insertedOrder.code} criado com ${validatedItems.length} item(ns).`,
      createdByProfileId: input.createdByProfileId ?? null,
      metadata: {
        itemsCount: validatedItems.length,
        totalKg: Number(
          validatedItems.reduce((sum, entry) => sum + entry.item.quantity * Number(entry.product.sales_to_kg_factor), 0).toFixed(3),
        ),
      },
    },
    supabase,
  );

  return {
    orderId: insertedOrder.legacy_id ?? insertedOrder.id,
    code: insertedOrder.code,
  };
}

export interface OpenStoreOrdersInput {
  /** Data de entrega-alvo (YYYY-MM-DD) para a qual a fábrica está abrindo os pedidos. */
  deliveryDate: string;
  /** Lojas (legacy ids) para as quais abrir pedido. */
  storeIds: string[];
  openedByProfileId?: string | null;
  tenantId?: string | null;
  orderedAt?: string;
}

/**
 * AJ-0009 Fase 4a: a fábrica "abre" pedidos vazios (status `aberto`) para as lojas
 * preencherem. Pula lojas que já têm pedido ativo na data (o índice UNIQUE também barra).
 * O pedido vazio nasce com `base_date = deliveryDate` (refinado quando a loja preenche).
 */
export async function openStoreOrders(
  input: OpenStoreOrdersInput,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<{ opened: Array<{ storeId: string; code: string }>; skipped: string[] }> {
  const orderedAt = input.orderedAt ?? new Date().toISOString();
  const snapshot = await getMasterDataSnapshot({
    supabase,
    includeProfileNames: false,
    tenantId: input.tenantId,
    forceRefresh: true,
  });
  const openedByProfileDatabaseId = await resolveProfileDatabaseId(
    supabase,
    input.openedByProfileId ?? null,
    { tenantId: input.tenantId },
  );

  const requestedStoreIds = Array.from(new Set(input.storeIds));
  const storeByLegacyId = new Map(snapshot.stores.map((store) => [store.id, store]));
  // Resolve db ids das lojas pedidas (ignora ids inexistentes).
  const storeDbIdByLegacy = new Map<string, string>();
  for (const legacyId of requestedStoreIds) {
    if (!storeByLegacyId.has(legacyId)) continue;
    storeDbIdByLegacy.set(legacyId, await resolveStoreDatabaseId(legacyId, supabase));
  }

  // Lojas que já têm pedido ATIVO na data de entrega-alvo → pular.
  const dbIds = Array.from(storeDbIdByLegacy.values());
  const dbIdToLegacy = new Map(Array.from(storeDbIdByLegacy.entries()).map(([legacy, db]) => [db, legacy]));
  const storeIdsWithActiveOrder: string[] = [];
  if (dbIds.length > 0) {
    const existingResult = await supabase
      .from("store_orders")
      .select("store_id")
      .eq("delivery_date", input.deliveryDate)
      .eq("management_status", "ativo")
      .in("store_id", dbIds);
    const existing = assertSupabaseResult(existingResult, "Failed to load existing orders for open");
    for (const row of existing) {
      const legacy = dbIdToLegacy.get(row.store_id);
      if (legacy) storeIdsWithActiveOrder.push(legacy);
    }
  }

  const plan = planStoreOrdersToOpen({
    requestedStoreIds: requestedStoreIds.filter((id) => storeDbIdByLegacy.has(id)),
    storeIdsWithActiveOrder,
  });
  // Lojas pedidas mas inexistentes também contam como "puladas" (transparência).
  const unknownStores = requestedStoreIds.filter((id) => !storeByLegacyId.has(id));
  const skipped = [...plan.skipped, ...unknownStores];

  const opened: Array<{ storeId: string; code: string }> = [];
  for (const legacyStoreId of plan.toOpen) {
    const store = storeByLegacyId.get(legacyStoreId)!;
    const storeDatabaseId = storeDbIdByLegacy.get(legacyStoreId)!;
    const legacyId = `order-${crypto.randomUUID()}`;
    const code = await allocateBusinessCode("PD", orderedAt, supabase);

    const insertResult = await supabase
      .from("store_orders")
      .insert({
        legacy_id: legacyId,
        code,
        store_id: storeDatabaseId,
        opened_by_profile_id: openedByProfileDatabaseId,
        opened_at: orderedAt,
        ordered_at: orderedAt,
        base_date: input.deliveryDate,
        delivery_date: input.deliveryDate,
        receive_window_snapshot: store.receiveWindow,
        expedition_lead_days_snapshot: snapshot.operationalSettings.expeditionLeadDays,
        note: "",
        status: "aberto",
      })
      .select("legacy_id, code")
      .single();
    const inserted = assertSupabaseResult(insertResult, "Failed to open store order");

    await appendStoreOrderEvent(
      {
        orderId: inserted.legacy_id ?? legacyId,
        type: "criacao",
        title: "Pedido aberto pela fábrica",
        description: `Pedido ${inserted.code} aberto para a loja ${store.name} preencher (entrega ${input.deliveryDate}).`,
        createdByProfileId: input.openedByProfileId ?? null,
        metadata: { origin: "fabrica", deliveryDate: input.deliveryDate },
      },
      supabase,
    );

    opened.push({ storeId: legacyStoreId, code: inserted.code });
  }

  return { opened, skipped };
}

export interface OpenStoreOrderSummary {
  id: string;
  code: string;
  storeId: string;
  storeName: string;
  deliveryDate: string;
}

/**
 * AJ-0009 Fase 4a: pedidos `aberto` (abertos pela fábrica, ainda não preenchidos),
 * para a loja ver e preencher. `allowedStoreIds` (legacy) restringe ao escopo do usuário.
 */
export async function listOpenStoreOrders(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
  allowedStoreIds?: string[] | null,
): Promise<OpenStoreOrderSummary[]> {
  const [ordersResult, storesResult] = await Promise.all([
    supabase
      .from("store_orders")
      .select("id, legacy_id, code, store_id, delivery_date")
      .eq("status", "aberto")
      .eq("management_status", "ativo")
      .order("delivery_date", { ascending: true }),
    supabase.from("stores").select("id, legacy_id, name"),
  ]);

  const orderRows = assertSupabaseResult(ordersResult, "Failed to load open store orders");
  const storeRows = assertSupabaseResult(storesResult, "Failed to load stores for open orders");
  const storeById = new Map(storeRows.map((row) => [row.id, row]));
  const allowed = allowedStoreIds ? new Set(allowedStoreIds) : null;

  return orderRows
    .map((row) => {
      const store = storeById.get(row.store_id);
      const storeLegacyId = store?.legacy_id ?? row.store_id;
      return {
        id: row.legacy_id ?? row.id,
        code: row.code,
        storeId: storeLegacyId,
        storeName: store?.name ?? "Loja",
        deliveryDate: row.delivery_date,
      };
    })
    .filter((order) => (allowed ? allowed.has(order.storeId) : true));
}

export async function updateStoreOrder(
  orderId: string,
  input: UpdateStoreOrderInput,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const orderRow = await ensureOrderIsMutable(orderId, supabase);
  const storeRowsResult = await supabase.from("stores").select("id, legacy_id");
  const storeRows = assertSupabaseResult(storeRowsResult, "Failed to resolve store for order update");
  const storeLegacyId = storeRows.find((row) => row.id === orderRow.store_id)?.legacy_id ?? orderRow.store_id;
  const updatedByProfileDatabaseId = await resolveProfileDatabaseId(
    supabase,
    input.updatedByProfileId ?? null,
    {
      tenantId: input.tenantId,
    },
  );
  const { validatedItems } = await validateStoreOrderItems(input.items, {
    storeId: storeLegacyId,
    orderedAt: orderRow.ordered_at,
    tenantId: input.tenantId ?? "",
    supabase,
  });

  const updateOrderResult = await supabase
    .from("store_orders")
    .update({
      note: input.note ?? "",
      // AJ-0009 Fase 4a: preencher um pedido aberto pela fábrica o transiciona para
      // 'preenchido' (legado/'preenchido'/'enviado' permanecem como estão).
      status: resolveFilledStatus(orderRow.status),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderRow.id);

  if (updateOrderResult.error) {
    throw new Error(`Failed to update store order: ${updateOrderResult.error.message}`);
  }

  await replaceStoreOrderItems(orderRow.id, orderRow.legacy_id ?? orderRow.id, validatedItems, supabase);
  await appendStoreOrderEvent(
    {
      orderId: orderRow.id,
      type: "edicao",
      title: "Pedido atualizado",
      description: `Itens do pedido ${orderRow.code} foram atualizados antes da liberação para produção.`,
      createdByProfileId: input.updatedByProfileId ?? null,
      metadata: {
        itemsCount: validatedItems.length,
        updatedByProfileDatabaseId,
      },
    },
    supabase,
  );

  return {
    orderId: orderRow.legacy_id ?? orderRow.id,
    code: orderRow.code,
  };
}
