import { NextResponse } from "next/server";

import { authorizeApiRequest, buildStoreScopeResponse, canAccessStore } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getStoreOrderWeekdaySuggestions } from "@/lib/supabase-data/store-order-suggestions";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-order-suggestions",
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
    const now = searchParams.get("now") ?? undefined;

    if (!storeId) {
      return NextResponse.json({});
    }

    if (!canAccessStore(authorization, storeId)) {
      return buildStoreScopeResponse();
    }

    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const suggestions = await getStoreOrderWeekdaySuggestions(
      { storeId, now },
      supabase,
    );

    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load store order suggestions",
      },
      { status: 500 },
    );
  }
}
