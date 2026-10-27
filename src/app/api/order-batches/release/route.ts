import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { closeFinishedBatches, getOrderBatchOverview } from "@/lib/supabase-data/order-batch-overview";
import { OrderReleaseValidationError } from "@/lib/supabase-data/release-validation";
import { releaseOrder } from "@/lib/supabase-data/workflow";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

/**
 * "Liberar lote" (reunião 22/10, bloco 7): manda para a produção, de uma vez, todos os pedidos
 * do lote naquela data de entrega. Lote ainda esperando lojas dentro do prazo só vai com
 * `force` (o gestor confirma sabendo quais lojas faltam). Lote todo liberado sai do painel.
 */
export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/order-batches/release",
    permission: "gestor-fabrica.pedidos",
    minimumLevel: "operar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });
  if ("response" in authorization) {
    return authorization.response;
  }
  const body = (await request.json().catch(() => null)) as
    | { batchId?: unknown; deliveryDate?: unknown; force?: unknown }
    | null;
  // Quadro #3 (27/10): um cartão por data de entrega — a data identifica o lote a liberar.
  const deliveryDate = typeof body?.deliveryDate === "string" ? body.deliveryDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    return NextResponse.json({ message: "Informe a data de entrega do lote." }, { status: 400 });
  }

  const tenantId = authorization.effectiveTenantId as string;
  const supabase = createTenantScopedSupabaseClient(tenantId, createSupabaseAdminClient());
  try {
    const overview = await getOrderBatchOverview(tenantId, supabase, { includeMissing: false });
    const group = overview.groups.find((item) => item.deliveryDate === deliveryDate);
    if (!group) {
      return NextResponse.json({ message: "Lote não encontrado ou já liberado." }, { status: 404 });
    }
    // Quadro #4 (Lucas, 27/10): dentro do prazo das lojas o lote não é liberado (sem "forçar").
    if (group.state === "aguardando_lojas") {
      return NextResponse.json(
        {
          message: `As lojas ainda podem pedir até ${group.deadline.dateKey.split("-").reverse().slice(0, 2).join("/")} às ${group.deadline.time} (faltam ${group.missingStoreIds.length} loja(s)).`,
          reason: "batch_stores_pending",
          missingStoreNames: group.missingStoreNames,
        },
        { status: 409 },
      );
    }

    const released: string[] = [];
    const failed: Array<{ orderCode: string; message: string }> = [];
    for (const order of group.orders.filter((item) => !item.released)) {
      try {
        await releaseOrder(order.orderId, authorization.user.id, supabase, {
          tenantId,
          // Lote completo ou prazo encerrado (aguardando_lojas foi recusado acima).
          force: false,
          referenceDate: overview.now.dateKey,
        });
        released.push(order.orderCode);
      } catch (error) {
        failed.push({
          orderCode: order.orderCode,
          message:
            error instanceof OrderReleaseValidationError || error instanceof Error
              ? error.message
              : "Falha ao liberar.",
        });
      }
    }
    invalidatePlanningCaches(tenantId);
    const after = await getOrderBatchOverview(tenantId, supabase, { includeMissing: false });
    const closed = await closeFinishedBatches(after.groups, supabase);
    return NextResponse.json({ released, failed, closedBatchIds: closed });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Falha ao liberar o lote." },
      { status: 500 },
    );
  }
}
