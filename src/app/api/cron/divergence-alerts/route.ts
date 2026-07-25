import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import type { FactoryAlertSeverity } from "@/lib/supabase-data/factory-alerts";
import { computeFactoryMetrics } from "@/lib/supabase-data/factory-metrics";
import {
  buildAutoOccurrenceDedupMarker,
  createSystemDivergenceOccurrence,
  listStoreOccurrences,
} from "@/lib/supabase-data/store-occurrences";
import { listActiveTenantIds } from "@/lib/supabase-data/tenants";
import { getTodayDateKey } from "@/lib/order-planning";

/**
 * 2.6-F — Alertas automáticos para inconsistências e falhas operacionais.
 *
 * Hoje as ocorrências só são abertas MANUALMENTE. Este endpoint roda como
 * Vercel Cron (ou scheduler externo) e abre ocorrências AUTOMATICAMENTE quando
 * o monitor de divergências de fábrica detecta um sinal relevante — sem humano
 * no loop.
 *
 * Autenticação: mesmo padrão de `auto-release` — header
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Por tenant (data de referência = hoje):
 *  1. computa métricas/alertas via `computeFactoryMetrics` (que já chama a
 *     função pura `computeFactoryAlerts`) — NÃO reimplementamos a lógica.
 *  2. filtra os alertas com severidade >= AUTO_ALERT_MIN_SEVERITY.
 *  3. para cada alerta qualificado, abre uma ocorrência do SISTEMA via
 *     `createSystemDivergenceOccurrence` (reusa o caminho de criação de
 *     ocorrências — sem inserts à mão).
 *
 * DEDUPLICAÇÃO (crítico p/ não spammar): cada ocorrência automática carrega a
 * marca determinística `[auto:<alertId>@<data>]` na descrição. Antes de criar,
 * verificamos se já existe uma ocorrência ABERTA (status `aberta` ou
 * `em_analise`) com a mesma marca para o tenant. Se existir, pulamos. Assim
 * execuções repetidas do cron (de hora em hora) não geram duplicatas; uma
 * ocorrência só reabre no dia seguinte (a data faz parte da chave) ou se a
 * anterior já foi resolvida/fechada.
 *
 * Limitações:
 *  - GET-only (exigência do Vercel Cron).
 *  - Erros por tenant são isolados (não interrompem o batch).
 */

/**
 * Severidade mínima que dispara abertura automática de ocorrência.
 * `danger` apenas seria muito restritivo; incluímos `warning` para cobrir
 * divergências relevantes (produção abaixo do planejado, lojas sem pedido,
 * falhas de entrega). Ajuste aqui para subir/baixar o corte.
 */
const AUTO_ALERT_MIN_SEVERITY: FactoryAlertSeverity = "warning";

const SEVERITY_RANK: Record<FactoryAlertSeverity, number> = {
  info: 0,
  warning: 1,
  danger: 2,
};

const OPEN_STATUSES = new Set(["aberta", "em_analise"]);

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error("[cron/divergence-alerts] CRON_SECRET não configurado — request rejeitada.");
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
  const minRank = SEVERITY_RANK[AUTO_ALERT_MIN_SEVERITY];

  let tenantIds: string[];
  try {
    tenantIds = await listActiveTenantIds(adminClient);
  } catch (error) {
    console.error("[cron/divergence-alerts] failed to list tenants", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to list tenants" },
      { status: 500 },
    );
  }

  const perTenant: Array<{
    tenantId: string;
    alertsDetected: number;
    occurrencesCreated: number;
    skippedDuplicates: number;
    skippedNoAnchor: number;
    error?: string;
  }> = [];

  for (const tenantId of tenantIds) {
    let alertsDetected = 0;
    let occurrencesCreated = 0;
    let skippedDuplicates = 0;
    let skippedNoAnchor = 0;

    try {
      const scopedClient = createTenantScopedSupabaseClient(tenantId, adminClient);

      const metrics = await computeFactoryMetrics({ referenceDate, tenantId }, scopedClient);
      const qualifyingAlerts = metrics.alerts.filter(
        (alert) => SEVERITY_RANK[alert.severity] >= minRank,
      );
      alertsDetected = qualifyingAlerts.length;

      // Dedup: carrega ocorrências do tenant uma vez e indexa as marcas das que
      // ainda estão abertas. Mais barato que uma query por alerta.
      const existingOccurrences = await listStoreOccurrences({}, scopedClient);
      const openAutoMarkers = new Set(
        existingOccurrences
          .filter((occurrence) => OPEN_STATUSES.has(occurrence.status))
          .map((occurrence) => occurrence.description),
      );
      const hasOpenAutoOccurrence = (marker: string) =>
        Array.from(openAutoMarkers).some((description) => description.includes(marker));

      for (const alert of qualifyingAlerts) {
        const marker = buildAutoOccurrenceDedupMarker(alert.id, referenceDate);
        if (hasOpenAutoOccurrence(marker)) {
          skippedDuplicates += 1;
          continue;
        }

        const created = await createSystemDivergenceOccurrence(
          {
            alertId: alert.id,
            referenceDate,
            title: alert.title,
            detail: alert.detail,
            metric: alert.metric,
          },
          scopedClient,
        );

        if (!created) {
          // Tenant sem pedido para ancorar — não conseguimos abrir a ocorrência.
          skippedNoAnchor += 1;
          continue;
        }

        occurrencesCreated += 1;
        // Mantém o índice consistente caso dois alertas resolvam para a mesma marca.
        openAutoMarkers.add(created.description);
      }

      perTenant.push({
        tenantId,
        alertsDetected,
        occurrencesCreated,
        skippedDuplicates,
        skippedNoAnchor,
      });
    } catch (error) {
      console.error(`[cron/divergence-alerts] tenant ${tenantId} falhou`, error);
      perTenant.push({
        tenantId,
        alertsDetected,
        occurrencesCreated,
        skippedDuplicates,
        skippedNoAnchor,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const totals = perTenant.reduce(
    (acc, row) => ({
      alertsDetected: acc.alertsDetected + row.alertsDetected,
      occurrencesCreated: acc.occurrencesCreated + row.occurrencesCreated,
      skippedDuplicates: acc.skippedDuplicates + row.skippedDuplicates,
      skippedNoAnchor: acc.skippedNoAnchor + row.skippedNoAnchor,
    }),
    { alertsDetected: 0, occurrencesCreated: 0, skippedDuplicates: 0, skippedNoAnchor: 0 },
  );

  return NextResponse.json({
    ok: true,
    referenceDate,
    minSeverity: AUTO_ALERT_MIN_SEVERITY,
    tenantsProcessed: tenantIds.length,
    alertsDetected: totals.alertsDetected,
    occurrencesCreated: totals.occurrencesCreated,
    skippedDuplicates: totals.skippedDuplicates,
    skippedNoAnchor: totals.skippedNoAnchor,
    perTenant,
  });
}
