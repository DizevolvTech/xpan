import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";
import { listProductionLeftovers } from "@/lib/supabase-data/production-leftovers";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/factory-planning/leftovers",
    anyOfPermissions: ["gestor-fabrica.sobras", "gestor-fabrica.dashboard"],
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const referenceDate =
    searchParams.get("referenceDate") ?? new Date().toISOString().slice(0, 10);
  const windowDaysParam = searchParams.get("windowDays");
  const windowDays = windowDaysParam ? Number.parseInt(windowDaysParam, 10) : 7;

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );

    const master = await getMasterDataSnapshot({
      supabase,
      tenantId: authorization.effectiveTenantId,
      includeProfileNames: false,
    });
    const productNamesById = new Map(
      master.products.map((product) => [product.id, product.name]),
    );

    const leftovers = await listProductionLeftovers(
      {
        tenantId: authorization.effectiveTenantId,
        referenceDate,
        windowDays: Number.isFinite(windowDays) ? windowDays : 7,
        productNamesById,
      },
      supabase,
    );
    return NextResponse.json(leftovers);
  } catch (error) {
    console.error("Failed to load production leftovers", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load production leftovers",
      },
      { status: 500 },
    );
  }
}
