import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import { captureReleaseRecipeSnapshot } from "@/lib/supabase-data/release-recipe-snapshot";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";

/**
 * BACKFILL do snapshot de receita dos pedidos JÁ LIBERADOS (XPAN #6 / call 24/07).
 *
 * A tabela `workflow_release_recipe_snapshots` nasceu sem backfill: pedido liberado ANTES da
 * migration segue expandindo a receita AO VIVO, então editar a receita hoje ainda muda a OP
 * dele. Como não existe caminho de "re-liberar" (o botão some depois de liberado e
 * `updateStoreOrder` bloqueia pedido liberado), esses pedidos nunca seriam congelados.
 *
 * ⚠️ APROXIMAÇÃO ACEITA: congela a receita ATUAL, não a do momento da liberação — essa
 * informação não existe em lugar nenhum. Decisão registrada em
 * `Docs/superpowers/specs/2026-07-24-ajustes-call-cliente-design.md`.
 *
 * É uma rota (e não um script) porque `release-recipe-snapshot.ts` é `server-only` e o pacote
 * não resolve fora do bundler do Next. Reusa `captureReleaseRecipeSnapshot`, a mesma função da
 * liberação, em vez de reimplementar a árvore de receita em SQL.
 *
 * Uso (mesma autenticação das rotas de cron):
 *   GET  → dry-run, lista o que seria congelado
 *   POST → aplica
 *   curl -H "Authorization: Bearer $CRON_SECRET" .../api/admin/backfill-release-recipes
 *
 * Idempotente: pedido que já tem snapshot é pulado. Falha por pedido é isolada.
 */

type OrderRow = {
  id: string;
  legacy_id: string | null;
  tenant_id: string;
  code: string | null;
};

function unauthorized(request: Request): NextResponse | null {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error("[backfill-release-recipes] CRON_SECRET não configurado — request rejeitada.");
    return NextResponse.json({ message: "Cron secret not configured on the server." }, { status: 503 });
  }
  if (request.headers.get("Authorization") !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Pedidos liberados que ainda não têm receita congelada. */
async function findPendingOrders(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  // A liberação referencia `store_orders.id` (uuid); o snapshot usa o espaço `legacy_id ?? id`.
  const releases = await supabase.from("workflow_order_releases").select("order_id");
  if (releases.error) {
    throw new Error(`Falha ao listar liberações: ${releases.error.message}`);
  }
  const releasedOrderIds = (releases.data ?? []).map((row) => (row as { order_id: string }).order_id);
  if (releasedOrderIds.length === 0) {
    return { pending: [] as OrderRow[], released: 0 };
  }

  const orders = await supabase
    .from("store_orders")
    .select("id, legacy_id, tenant_id, code")
    .in("id", releasedOrderIds);
  if (orders.error) {
    throw new Error(`Falha ao carregar pedidos liberados: ${orders.error.message}`);
  }
  const orderRows = (orders.data ?? []) as OrderRow[];

  const existing = await supabase.from("workflow_release_recipe_snapshots").select("order_id");
  if (existing.error) {
    throw new Error(
      `Falha ao ler snapshots existentes (migration 20260724170000 aplicada?): ${existing.error.message}`,
    );
  }
  const alreadyFrozen = new Set((existing.data ?? []).map((row) => (row as { order_id: string }).order_id));

  return {
    pending: orderRows.filter((order) => !alreadyFrozen.has(order.legacy_id ?? order.id)),
    released: orderRows.length,
  };
}

export async function GET(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;

  try {
    const { pending, released } = await findPendingOrders(createSupabaseAdminClient());
    return NextResponse.json({
      ok: true,
      dryRun: true,
      released,
      alreadyFrozen: released - pending.length,
      pending: pending.map((order) => ({
        orderId: order.legacy_id ?? order.id,
        code: order.code,
        tenantId: order.tenant_id,
      })),
    });
  } catch (error) {
    console.error("[backfill-release-recipes] dry-run falhou", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Backfill dry-run failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = unauthorized(request);
  if (denied) return denied;

  const adminClient = createSupabaseAdminClient();

  let pending: OrderRow[];
  let released: number;
  try {
    ({ pending, released } = await findPendingOrders(adminClient));
  } catch (error) {
    console.error("[backfill-release-recipes] falha ao listar pendentes", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to list pending orders" },
      { status: 500 },
    );
  }

  const results: Array<{ orderId: string; code: string | null; ok: boolean; error?: string }> = [];
  const touchedTenants = new Set<string>();

  for (const order of pending) {
    const orderId = order.legacy_id ?? order.id;
    try {
      // Client escopado: injeta tenant_id na escrita (sem ele o insert falha em NOT NULL) e
      // impede a leitura de vazar entre tenants.
      const scopedClient = createTenantScopedSupabaseClient(order.tenant_id, adminClient);
      await captureReleaseRecipeSnapshot(
        { id: order.id, legacy_id: order.legacy_id },
        order.tenant_id,
        scopedClient,
      );
      touchedTenants.add(order.tenant_id);
      results.push({ orderId, code: order.code, ok: true });
    } catch (error) {
      // Falha por pedido é isolada — os outros seguem.
      console.error(`[backfill-release-recipes] pedido ${orderId} falhou`, error);
      results.push({
        orderId,
        code: order.code,
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  for (const tenantId of touchedTenants) {
    invalidatePlanningCaches(tenantId);
  }

  const frozen = results.filter((result) => result.ok).length;
  return NextResponse.json({
    ok: results.every((result) => result.ok),
    released,
    attempted: pending.length,
    frozen,
    failed: pending.length - frozen,
    results,
  });
}
