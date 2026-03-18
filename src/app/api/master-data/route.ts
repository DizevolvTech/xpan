import { NextResponse } from "next/server";

import { authorizeApiRequest, getAllowedStoreIds } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";

export async function GET() {
  const authorization = await authorizeApiRequest();

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const snapshot = await getMasterDataSnapshot({
      supabase,
      includeProfileNames: authorization.user.role !== "loja",
    });
    const allowedStoreIds = getAllowedStoreIds(authorization.user);

    return NextResponse.json({
      ...snapshot,
      stores:
        allowedStoreIds === null
          ? snapshot.stores
          : snapshot.stores.filter((store) => allowedStoreIds.includes(store.id)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load master data snapshot",
      },
      { status: 500 },
    );
  }
}
