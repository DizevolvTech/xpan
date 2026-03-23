import { NextResponse } from "next/server";

import { authorizeApiRequest, canAccessStore } from "@/lib/api-auth";
import { formatDateBr } from "@/lib/production-planning";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { buildStoreOrderCapabilities, resolveStoreVisibleOrderStatus } from "@/lib/store-order-workflow";
import { cancelOrder } from "@/lib/supabase-data/workflow";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPersistedDeliveryExecutions } from "@/lib/supabase-data/delivery";
import { assertSupabaseResult, isUuid } from "@/lib/supabase-data/common";
import { listStoreOrderEvents } from "@/lib/supabase-data/store-order-events";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";
import { updateStoreOrder } from "@/lib/supabase-data/store-orders";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

function formatDateTimeBr(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getReferenceDate(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("referenceDate") ?? new Date().toISOString().slice(0, 10);
}

function isClientValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("cannot") ||
    normalized.includes("invalid") ||
    normalized.includes("sublinha") ||
    normalized.includes("cronograma") ||
    normalized.includes("dia de entrega") ||
    normalized.includes("whole numbers")
  );
}

async function loadOrderAccessContext(orderId: string, tenantId: string | null | undefined) {
  const supabase = createTenantScopedSupabaseClient(tenantId, createSupabaseAdminClient());
  const orderQuery = supabase
    .from("store_orders")
    .select("id, legacy_id, code, store_id, ordered_at, delivery_date, note, receive_window_snapshot, expedition_lead_days_snapshot, management_status");
  const [orderResult, storeRowsResult, settingsResult] = await Promise.all([
    (isUuid(orderId) ? orderQuery.eq("id", orderId) : orderQuery.eq("legacy_id", orderId)).maybeSingle(),
    supabase.from("stores").select("id, legacy_id, name, receiving_days"),
    supabase.from("operational_settings").select("order_cutoff_time").limit(1).maybeSingle(),
  ]);

  const orderRow = assertSupabaseResult(
    { data: orderResult.data, error: orderResult.error },
    "Failed to load store order detail",
  );
  const storeRows = assertSupabaseResult(storeRowsResult, "Failed to load stores for order detail");
  const settingsRow = assertSupabaseResult(
    { data: settingsResult.data, error: settingsResult.error },
    "Failed to load operational settings for order detail",
  );

  const releaseResult = await supabase
    .from("workflow_order_releases")
    .select("id")
    .eq("order_id", orderRow.id)
    .maybeSingle();

  if (releaseResult.error) {
    throw new Error(`Failed to load release state for order detail: ${releaseResult.error.message}`);
  }

  const storeRow = storeRows.find((row) => row.id === orderRow.store_id);
  const resolvedStoreId = storeRow?.legacy_id ?? storeRow?.id ?? orderRow.store_id;

  return {
    supabase,
    orderRow,
    storeRow,
    resolvedStoreId,
    settingsRow,
    isReleased: Boolean(releaseResult.data),
  };
}

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-orders/[orderId]",
    permission: "loja.pedidos",
    minimumLevel: "operar",
    includeStoreScope: true,
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const { orderId } = await context.params;
    const { supabase, orderRow, storeRow, resolvedStoreId, settingsRow, isReleased } =
      await loadOrderAccessContext(orderId, authorization.effectiveTenantId);

    if (!canAccessStore(authorization, resolvedStoreId)) {
      return NextResponse.json(
        { message: "O usuário autenticado não tem acesso a este pedido." },
        { status: 403 },
      );
    }

    const referenceDate = getReferenceDate(request);
    const [planning, itemRowsResult, productRowsResult, lineRowsResult, categoryRowsResult, deliveryExecutions, events] = await Promise.all([
      getFactoryPlanningSnapshot(referenceDate, {
        supabase,
        includeProfileNames: false,
        tenantId: authorization.effectiveTenantId,
      }),
      supabase
        .from("store_order_items")
        .select("id, legacy_id, order_id, product_id, product_code_snapshot, product_name_snapshot, requested_quantity, requested_unit, operational_unit_snapshot")
        .order("created_at", { ascending: true }),
      supabase.from("products").select("id, legacy_id, subcategory_id, operational_subcategory_id"),
      supabase.from("subcategories").select("id, category_id"),
      supabase.from("categories").select("id, name"),
      getPersistedDeliveryExecutions({
        tenantId: authorization.effectiveTenantId,
        supabase,
      }),
      listStoreOrderEvents(orderRow.legacy_id ?? orderRow.id, supabase),
    ]);

    const itemRows = assertSupabaseResult(itemRowsResult, "Failed to load store order items for detail");
    const productRows = assertSupabaseResult(productRowsResult, "Failed to load products for order detail");
    const lineRows = assertSupabaseResult(lineRowsResult, "Failed to load subcategories for order detail");
    const categoryRows = assertSupabaseResult(categoryRowsResult, "Failed to load categories for order detail");

    const productById = new Map(productRows.map((row) => [row.id, row]));
    const lineById = new Map(lineRows.map((row) => [row.id, row]));
    const categoryNameById = new Map(categoryRows.map((row) => [row.id, row.name]));

    const planningOrder = planning.orders.find((item) => item.id === (orderRow.legacy_id ?? orderRow.id));
    const execution = deliveryExecutions[orderRow.legacy_id ?? orderRow.id];
    const resolvedOrderStatus = planningOrder?.status ?? "em_espera";
    const visibleStatus = resolveStoreVisibleOrderStatus(
      resolvedOrderStatus,
      execution?.status,
    );
    const capabilities = buildStoreOrderCapabilities({
      orderStatus: resolvedOrderStatus,
      managementStatus: orderRow.management_status,
      isReleasedToProduction: isReleased,
      executionStatus: execution?.status,
    });

    const items = itemRows
      .filter((row) => row.order_id === orderRow.id)
      .map((row) => {
        const product = productById.get(row.product_id);
        const line = product
          ? lineById.get(product.operational_subcategory_id ?? product.subcategory_id)
          : undefined;
        const category = line ? categoryNameById.get(line.category_id) ?? "-" : "-";

        return {
          id: row.legacy_id ?? row.id,
          productId: product?.legacy_id ?? product?.id ?? row.product_id,
          code: row.product_code_snapshot,
          name: row.product_name_snapshot,
          category,
          unit: row.requested_unit,
          operationalUnit: row.operational_unit_snapshot,
          quantity: Number(row.requested_quantity),
        };
      });

    return NextResponse.json({
      id: orderRow.legacy_id ?? orderRow.id,
      code: orderRow.code,
      storeId: resolvedStoreId,
      date: formatDateTimeBr(orderRow.ordered_at),
      orderedAtIso: orderRow.ordered_at,
      orderedAtKey: orderRow.ordered_at.slice(0, 10),
      deliveryDate: formatDateBr(orderRow.delivery_date),
      deliveryDateKey: orderRow.delivery_date,
      status: visibleStatus,
      store: storeRow?.name ?? "-",
      dPlusLabel: `D+${orderRow.expedition_lead_days_snapshot}`,
      cutoffTime: String(settingsRow.order_cutoff_time).slice(0, 5),
      receivesSunday: Boolean(storeRow?.receiving_days.includes("domingo")),
      receiveWindow: orderRow.receive_window_snapshot,
      note: orderRow.note,
      canEdit: capabilities.canEdit,
      canCancel: capabilities.canCancel,
      canOpenOccurrence: capabilities.canOpenOccurrence,
      items,
      events: events.map((event) => ({
        ...event,
        createdAt: formatDateTimeBr(event.createdAt),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load store order detail",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/store-orders/[orderId]",
    permission: "loja.pedidos",
    minimumLevel: "operar",
    includeStoreScope: true,
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const { orderId } = await context.params;
    const { supabase, resolvedStoreId } = await loadOrderAccessContext(
      orderId,
      authorization.effectiveTenantId,
    );

    if (!canAccessStore(authorization, resolvedStoreId)) {
      return NextResponse.json(
        { message: "O usuário autenticado não tem acesso a este pedido." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Parameters<typeof updateStoreOrder>[1];
    const updated = await updateStoreOrder(
      orderId,
      {
        ...body,
        tenantId: authorization.effectiveTenantId,
        updatedByProfileId: authorization.user.id,
      },
      supabase,
    );
    invalidatePlanningCaches(authorization.effectiveTenantId);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update store order";
    return NextResponse.json(
      {
        message,
      },
      { status: isClientValidationError(message) ? 400 : 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const authorization = await authorizeApiRequest({
    contextLabel: "DELETE /api/store-orders/[orderId]",
    permission: "loja.pedidos",
    minimumLevel: "operar",
    includeStoreScope: true,
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const { orderId } = await context.params;
    const { supabase, resolvedStoreId } = await loadOrderAccessContext(
      orderId,
      authorization.effectiveTenantId,
    );

    if (!canAccessStore(authorization, resolvedStoreId)) {
      return NextResponse.json(
        { message: "O usuário autenticado não tem acesso a este pedido." },
        { status: 403 },
      );
    }

    await cancelOrder(orderId, authorization.user.id, supabase);
    invalidatePlanningCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel store order";
    return NextResponse.json(
      {
        message,
      },
      { status: isClientValidationError(message) ? 400 : 500 },
    );
  }
}
