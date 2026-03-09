import { NextResponse } from "next/server";

import { authorizeApiRequest, canAccessStore, getAllowedStoreIds } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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
    const supabase = await createSupabaseServerClient();
    const planning = await getFactoryPlanningSnapshot(getReferenceDate(request), { supabase });
    const allowedStoreIds = getAllowedStoreIds(authorization.user);
    const orders = planning.orders
      .filter((order) => (allowedStoreIds ? allowedStoreIds.includes(order.storeId) : true))
      .map((order) => ({
      id: order.id,
      code: order.code,
      date: formatDateTimeBr(order.orderedAt),
      deliveryDate: order.deliveryDateLabel,
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
    const supabase = await createSupabaseServerClient();

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
