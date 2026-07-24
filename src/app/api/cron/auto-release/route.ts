import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import { listActiveTenantIds } from "@/lib/supabase-data/tenants";
import { autoReleaseEligibleOrders } from "@/lib/supabase-data/workflow";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { getTodayDateKey } from "@/lib/order-planning";

/**
 * AJ-A6.2 — endpoint para Vercel Cron / scheduler externo executar o
 * auto-release sem sessão de usuário.
 *
 * Autenticação: header `Authorization: Bearer ${CRON_SECRET}`. Vercel
 * Cron envia esse header automaticamente quando `CRON_SECRET` está
 * definido no dashboard. Para scheduler externo, mande o mesmo header.
 *
 * Comportamento:
 *  - Lista tenants ativos (admin client, bypassando RLS).
 *  - Para cada tenant, cria cliente tenant-scoped e dispara
 *    `autoReleaseEligibleOrders` com referenceDate = hoje.
 *  - Erros por tenant são isolados (não interrompem o batch).
 *  - Resposta JSON com agregado por tenant para inspeção via logs.
 *
 * Limitações:
 *  - GET-only (Vercel Cron exige GET). Não use esse endpoint via UI.
 *  - Sem `triggeredByProfileId` (ação do sistema, não de um humano).
 *    Eventos `liberacao_producao` ficam sem profile vinculado — OK.
 */
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    // Sem secret configurado, o endpoint é hostil — não rodamos por
    // segurança. Logamos para o operador identificar a config faltando.
    console.error("[cron/auto-release] CRON_SECRET não configurado — request rejeitada.");
    return NextResponse.json(
      { message: "Cron secret not configured on the server." },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const referenceDate = getTodayDateKey();
  const adminClient = createSupabaseAdminClient();

  let tenantIds: string[];
  try {
    tenantIds = await listActiveTenantIds(adminClient);
  } catch (error) {
    console.error("[cron/auto-release] failed to list tenants", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to list tenants",
      },
      { status: 500 },
    );
  }

  const perTenant: Array<{
    tenantId: string;
    released: number;
    skipped: number;
    failed: number;
    error?: string;
  }> = [];

  for (const tenantId of tenantIds) {
    try {
      const scopedClient = createTenantScopedSupabaseClient(tenantId, adminClient);
      const result = await autoReleaseEligibleOrders(
        {
          referenceDate,
          tenantId,
          // Cron é uma ação do sistema; sem profile humano vinculado.
          triggeredByProfileId: null,
        },
        scopedClient,
      );
      invalidatePlanningCaches(tenantId);
      perTenant.push({
        tenantId,
        released: result.released.length,
        skipped: result.skipped.length,
        failed: result.failed.length,
      });
    } catch (error) {
      // Isolamos falha por tenant — outros podem ser processados normalmente.
      console.error(`[cron/auto-release] tenant ${tenantId} falhou`, error);
      perTenant.push({
        tenantId,
        released: 0,
        skipped: 0,
        failed: 0,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const totals = perTenant.reduce(
    (acc, row) => ({
      released: acc.released + row.released,
      skipped: acc.skipped + row.skipped,
      failed: acc.failed + row.failed,
    }),
    { released: 0, skipped: 0, failed: 0 },
  );

  return NextResponse.json({
    ok: true,
    referenceDate,
    tenantsProcessed: tenantIds.length,
    totals,
    perTenant,
  });
}
