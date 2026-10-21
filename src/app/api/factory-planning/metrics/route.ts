import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { computeFactoryMetrics } from "@/lib/supabase-data/factory-metrics";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import { getTodayDateKey } from "@/lib/order-planning";
import { getCachedServerData } from "@/lib/server-data-cache";
import { buildTenantCacheKey } from "@/lib/supabase-data/common";

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
    const safeWindowDays = Number.isFinite(windowDays) ? windowDays : 7;
    // Os dois cards da Visão Geral (métricas e alertas) pedem o mesmo endpoint ao mesmo tempo:
    // cada chamada refazia ~20 consultas. Chave sob ":planning:" para a invalidação de
    // planejamento limpar também; chamadas simultâneas dividem a mesma carga.
    const metrics = await getCachedServerData(
      buildTenantCacheKey(
        authorization.effectiveTenantId,
        "planning",
        "metrics",
        referenceDate,
        String(safeWindowDays),
      ),
      15_000,
      () =>
        computeFactoryMetrics(
          {
            referenceDate,
            windowDays: safeWindowDays,
            tenantId: authorization.effectiveTenantId,
          },
          supabase,
        ),
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
