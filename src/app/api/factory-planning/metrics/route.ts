import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { computeFactoryMetrics } from "@/lib/supabase-data/factory-metrics";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import { getTodayDateKey } from "@/lib/order-planning";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/factory-planning/metrics",
    anyOfPermissions: ["gestor-fabrica.dashboard", "chao-fabrica.dashboard"],
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const referenceDate =
    searchParams.get("referenceDate") ?? getTodayDateKey();
  const windowDaysParam = searchParams.get("windowDays");
  const windowDays = windowDaysParam ? Number.parseInt(windowDaysParam, 10) : 7;

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const metrics = await computeFactoryMetrics(
      {
        referenceDate,
        windowDays: Number.isFinite(windowDays) ? windowDays : 7,
        tenantId: authorization.effectiveTenantId,
      },
      supabase,
    );
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Failed to compute factory metrics", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to compute factory metrics",
      },
      { status: 500 },
    );
  }
}
