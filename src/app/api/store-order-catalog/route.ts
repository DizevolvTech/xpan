import { NextResponse } from "next/server";

import { authorizeApiRequest, buildStoreScopeResponse, canAccessStore } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildStoreOrderCatalog } from "@/lib/store-order-catalog";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-order-catalog",
    permission: "loja.pedidos",
    minimumLevel: "operar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");
    const orderedAt = searchParams.get("orderedAt");

    if (!storeId || !orderedAt) {
      return NextResponse.json([]);
    }

    if (!canAccessStore(authorization.user, storeId)) {
      return buildStoreScopeResponse();
    }

    const supabase = createSupabaseAdminClient();
    const snapshot = await getMasterDataSnapshot({
      supabase,
      includeProfileNames: false,
    });
    const catalog = buildStoreOrderCatalog(snapshot, {
      storeId,
      orderedAt,
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
