import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { isFactoryOpensOrdersEnabled } from "@/lib/feature-flags";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { openStoreOrders } from "@/lib/supabase-data/store-orders";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

// AJ-0009 Fase 4a: a fábrica abre pedidos (status `aberto`) para as lojas preencherem.
export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/store-orders/open",
    permission: "gestor-fabrica.pedidos",
    minimumLevel: "operar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isFactoryOpensOrdersEnabled()) {
    return NextResponse.json(
      { message: "Recurso 'fábrica abre o pedido' está desligado (FACTORY_OPENS_ORDERS)." },
      { status: 409 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | { deliveryDate?: string; storeIds?: string[] }
    | null;

  if (!payload?.deliveryDate || !Array.isArray(payload.storeIds) || payload.storeIds.length === 0) {
    return NextResponse.json(
      { message: "Informe a data de entrega e ao menos uma loja." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const result = await openStoreOrders(
      {
        deliveryDate: payload.deliveryDate,
        storeIds: payload.storeIds,
        openedByProfileId: authorization.user.id,
        tenantId: authorization.effectiveTenantId,
      },
      supabase,
    );
    invalidatePlanningCaches(authorization.effectiveTenantId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Falha ao abrir pedidos." },
      { status: 500 },
    );
  }
}
