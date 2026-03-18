import { NextResponse } from "next/server";

import { authorizeApiRequest, canAccessStore, getAllowedStoreIds } from "@/lib/api-auth";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createStoreOrder } from "@/lib/supabase-data/store-orders";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";

function getReferenceDate(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("referenceDate") ?? new Date().toISOString().slice(0, 10);
}

function formatDateTimeBr(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    permission: "loja.pedidos",
    minimumLevel: "operar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const planning = await getFactoryPlanningSnapshot(getReferenceDate(request), {
      supabase,
      includeProfileNames: false,
    });
    const allowedStoreIds = getAllowedStoreIds(authorization.user);
    const orders = planning.orders
      .filter((order) => (allowedStoreIds ? allowedStoreIds.includes(order.storeId) : true))
      .map((order) => ({
      id: order.id,
      code: order.code,
      storeId: order.storeId,
      date: formatDateTimeBr(order.orderedAt),
      orderedAtKey: order.orderedAt.slice(0, 10),
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
    permission: "loja.pedidos",
    minimumLevel: "operar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const body = (await request.json()) as Parameters<typeof createStoreOrder>[0];
    const supabase = createSupabaseAdminClient();

    if (!canAccessStore(authorization.user, body.storeId)) {
      return NextResponse.json(
        { message: "A loja autenticada não tem acesso à loja selecionada." },
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
