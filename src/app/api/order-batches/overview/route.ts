import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getOrderBatchOverview } from "@/lib/supabase-data/order-batch-overview";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

/** Painel de lotes do gestor (reunião 22/10, bloco 7). Só leitura. */
export async function GET() {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/order-batches/overview",
    permission: "gestor-fabrica.pedidos",
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });
  if ("response" in authorization) {
    return authorization.response;
  }
  try {
    const supabase = createTenantScopedSupabaseClient(authorization.effectiveTenantId, createSupabaseAdminClient());
    const overview = await getOrderBatchOverview(authorization.effectiveTenantId as string, supabase);
    return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Falha ao carregar os lotes." },
      { status: 500 },
    );
  }
}
