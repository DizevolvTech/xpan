import { NextResponse } from "next/server";

import { authorizeApiRequest, canAccessStore, getAllowedStoreIds } from "@/lib/api-auth";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { resolveStoreVisibleOrderStatus } from "@/lib/store-order-workflow";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPersistedDeliveryExecutions } from "@/lib/supabase-data/delivery";
import { createStoreOrder, listFactoryStoreOrders } from "@/lib/supabase-data/store-orders";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

function getReferenceDate(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("referenceDate") ?? new Date().toISOString().slice(0, 10);
}

function isClientValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("invalid") ||
    normalized.includes("unavailable") ||
    normalized.includes("must contain at least one item") ||
    normalized.includes("produto repetido") ||
    normalized.includes("not found") ||
    normalized.includes("sublinha") ||
    normalized.includes("cronograma") ||
    normalized.includes("dia de entrega") ||
    normalized.includes("só produz") ||
    normalized.includes("já existe um pedido ativo") ||
    normalized.includes("whole numbers")
  );
}

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-orders",
    permission: "loja.pedidos",
    minimumLevel: "operar",
    includeStoreScope: true,
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const referenceDate = getReferenceDate(request);
    const [planning, storeOrders, deliveryExecutions] = await Promise.all([
      getFactoryPlanningSnapshot(referenceDate, {
        supabase,
        includeProfileNames: false,
        tenantId: authorization.effectiveTenantId,
      }),
      listFactoryStoreOrders(supabase),
      getPersistedDeliveryExecutions({
        tenantId: authorization.effectiveTenantId,
        supabase,
      }),
    ]);
    const allowedStoreIds = getAllowedStoreIds(authorization);
    const orderedAtByOrderId = new Map(
      storeOrders.map((order) => [order.id, order.orderedAt.slice(0, 10)]),
    );
    const orders = planning.orders
      .filter((order) => (allowedStoreIds ? allowedStoreIds.includes(order.storeId) : true))
      .map((order) => {
        const execution = deliveryExecutions[order.id];

        return {
          id: order.id,
          code: order.code,
          storeId: order.storeId,
          date: order.orderedAt,
          orderedAtKey: orderedAtByOrderId.get(order.id) ?? referenceDate,
          deliveryDate: order.deliveryDateLabel,
          deliveryDateKey: order.deliveryDate,
          status: resolveStoreVisibleOrderStatus(order.status, execution?.status),
          store: order.storeName,
        };
      });

    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load store order summaries",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/store-orders",
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
    const body = (await request.json()) as Parameters<typeof createStoreOrder>[0];
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );

    if (!canAccessStore(authorization, body.storeId)) {
      return NextResponse.json(
        { message: "O usuário autenticado não tem acesso à loja selecionada." },
        { status: 403 },
      );
    }

    const created = await createStoreOrder({
      ...body,
      tenantId: authorization.effectiveTenantId,
      createdByProfileId: authorization.user.id,
    }, supabase);
    invalidatePlanningCaches(authorization.effectiveTenantId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create store order";
    return NextResponse.json(
      {
        message,
      },
      { status: isClientValidationError(message) ? 400 : 500 },
    );
  }
}
