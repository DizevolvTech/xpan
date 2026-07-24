import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import { getTodayDateKey } from "@/lib/order-planning";

function getReferenceDate(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("referenceDate") ?? getTodayDateKey();
}

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/factory-planning",
    anyOfPermissions: ["gestor-fabrica.dashboard", "chao-fabrica.dashboard"],
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const planning = await getFactoryPlanningSnapshot(getReferenceDate(request), {
      supabase,
      includeProfileNames: false,
      tenantId: authorization.effectiveTenantId,
    });
    return NextResponse.json(planning);
  } catch (error) {
    console.error("Failed to load factory planning snapshot", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load factory planning snapshot",
      },
      { status: 500 },
    );
  }
}
