import { NextResponse } from "next/server";

import { authorizeApiRequest, canAccessStore, getAllowedStoreIds } from "@/lib/api-auth";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createStoreOrder, listFactoryStoreOrders } from "@/lib/supabase-data/store-orders";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";

function getReferenceDate(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("referenceDate") ?? new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-orders",
    permission: "loja.pedidos",
    minimumLevel: "operar",
    includeStoreScope: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const referenceDate = getReferenceDate(request);
    const [planning, storeOrders] = await Promise.all([
      getFactoryPlanningSnapshot(referenceDate, {
        supabase,
        includeProfileNames: false,
      }),
      listFactoryStoreOrders(supabase),
    ]);
    const allowedStoreIds = getAllowedStoreIds(authorization.user);
    const orderedAtByOrderId = new Map(
      storeOrders.map((order) => [order.id, order.orderedAt.slice(0, 10)]),
    );
    const orders = planning.orders
      .filter((order) => (allowedStoreIds ? allowedStoreIds.includes(order.storeId) : true))
      .map((order) => ({
        id: order.id,
        code: order.code,
        storeId: order.storeId,
        date: order.orderedAt,
        orderedAtKey: orderedAtByOrderId.get(order.id) ?? referenceDate,
        deliveryDate: order.deliveryDateLabel,
        deliveryDateKey: order.deliveryDate,
        status: order.status,
        store: order.storeName,
      }));

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
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const body = (await request.json()) as Parameters<typeof createStoreOrder>[0];
    const supabase = createSupabaseAdminClient();

    if (!canAccessStore(authorization.user, body.storeId)) {
      return NextResponse.json(
        { message: "O usuário autenticado não tem acesso à loja selecionada." },
        { status: 403 },
      );
    }

    const created = await createStoreOrder({
      ...body,
      createdByProfileId: authorization.user.id,
    }, supabase);
    invalidatePlanningCaches();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to create store order",
      },
      { status: 500 },
    );
  }
}
