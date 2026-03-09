import { NextResponse } from "next/server";

import { authorizeApiRequest, getAllowedStoreIds } from "@/lib/api-auth";
import { buildStoreOrderCatalog } from "@/lib/store-order-catalog";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";

export async function GET() {
  const authorization = await authorizeApiRequest({
    permission: "loja.pedidos",
    minimumLevel: "operar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const allowedStoreIds = getAllowedStoreIds(authorization.user);
    if (allowedStoreIds && allowedStoreIds.length === 0) {
      return NextResponse.json([]);
    }

    const supabase = await createSupabaseServerClient();
    const snapshot = await getMasterDataSnapshot({
      supabase,
      includeProfileNames: false,
    });
    const catalog = buildStoreOrderCatalog(snapshot);

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
