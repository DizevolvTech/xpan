import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";
import { listProductionOrderEvents } from "@/lib/supabase-data/production-order-events";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function GET(
  request: Request,
  context: { params: Promise<{ opId: string }> },
) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/factory-planning/ops/[opId]/timeline",
    anyOfPermissions: ["gestor-fabrica.ops", "chao-fabrica.ops"],
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { opId } = await context.params;
  const { searchParams } = new URL(request.url);
  const referenceDate =
    searchParams.get("referenceDate") ?? new Date().toISOString().slice(0, 10);

  if (!opId) {
    return NextResponse.json(
      { message: "Invalid request: opId é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    // O opId que chega via URL é o opCode (instável entre runs). Resolvemos
    // para a planning_key estável re-rodando o engine com o referenceDate.
    const planning = await getFactoryPlanningSnapshot(referenceDate, {
      supabase,
      includeProfileNames: false,
      tenantId: authorization.effectiveTenantId,
    });

    // Match por id (interno) OU code (mais comum vindo da URL).
    const op =
      planning.productionOrders.find((row) => row.id === opId) ??
      planning.productionOrders.find((row) => row.code === opId) ??
      null;

    if (!op) {
      return NextResponse.json(
        { message: "OP não encontrada para a janela operacional informada." },
        { status: 404 },
      );
    }

    const planningKey = [
      op.productionDate,
      op.sectorId,
      op.lineId,
      op.scheduleId ?? "sem-linha",
    ].join("|");

    const events = await listProductionOrderEvents(
      {
        tenantId: authorization.effectiveTenantId,
        planningKey,
      },
      supabase,
    );

    return NextResponse.json({
      opCode: op.code,
      planningKey,
      events,
    });
  } catch (error) {
    console.error("Failed to load OP timeline", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to load OP timeline",
      },
      { status: 500 },
    );
  }
}
