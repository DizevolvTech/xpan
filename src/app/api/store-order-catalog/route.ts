import { NextResponse } from "next/server";

import { authorizeApiRequest, buildStoreScopeResponse, canAccessStore } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildStoreOrderCatalog } from "@/lib/store-order-catalog";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-order-catalog",
    permission: "loja.pedidos",
    minimumLevel: "operar",
    includeStoreScope: true,
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");
    const orderedAt = searchParams.get("orderedAt");
    // AJ-A10: opcional. Quando a loja preenche um pedido aberto p/ data futura, a UI
    // passa a entrega comprometida (X) para ancorar a disponibilidade nessa data.
    const targetDeliveryDate = searchParams.get("targetDeliveryDate");

    if (!storeId || !orderedAt) {
      return NextResponse.json([]);
    }

    if (!canAccessStore(authorization, storeId)) {
      return buildStoreScopeResponse();
    }

    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const snapshot = await getMasterDataSnapshot({
      supabase,
      includeProfileNames: false,
      tenantId: authorization.effectiveTenantId,
    });
    const catalog = buildStoreOrderCatalog(snapshot, {
      storeId,
      orderedAt,
      targetDeliveryDate: targetDeliveryDate ?? null,
    });

    return NextResponse.json(catalog);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load store order catalog",
      },
      { status: 500 },
    );
  }
}
