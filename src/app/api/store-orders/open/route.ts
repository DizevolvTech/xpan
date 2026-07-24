import { NextResponse } from "next/server";

import { authorizeApiRequest, getAllowedStoreIds } from "@/lib/api-auth";
import { isFactoryOpensOrdersEnabled } from "@/lib/feature-flags";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { listOpenBatches, openOrderBatch } from "@/lib/supabase-data/order-batches";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

// Rejeições de regra de negócio → HTTP 400 (não 500). Substrings das mensagens lançadas
// (gotcha store-orders-http-status).
function isClientValidationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("cronograma") ||
    normalized.includes("nenhuma loja") ||
    normalized.includes("informe") ||
    normalized.includes("data de entrega") ||
    normalized.includes("não há") ||
    normalized.includes("slot") ||
    normalized.includes("lote") ||
    normalized.includes("invalid") ||
    normalized.includes("not found")
  );
}

// XPAN-Lote: a LOJA lista os LOTES abertos — os slots (loja × data) para os quais ela pode
// CRIAR um pedido. Substitui a antiga listagem de pedidos vazios pré-criados.
export async function GET() {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-orders/open",
    // A LOJA lê para montar pedidos; o GESTOR lê para ver o status do lote (X/Y).
    anyOfPermissions: ["loja.pedidos", "gestor-fabrica.pedidos"],
    minimumLevel: "operar",
    includeStoreScope: true,
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isFactoryOpensOrdersEnabled()) {
    // Flag off: sem lotes — a loja cria pedido livre ("Novo Pedido").
    return NextResponse.json([]);
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const batches = await listOpenBatches(getAllowedStoreIds(authorization), supabase);
    return NextResponse.json(batches);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Falha ao carregar lotes abertos." },
      { status: 500 },
    );
  }
}

// XPAN-Lote: a FÁBRICA abre um LOTE (1 registro order_batches), não N pedidos vazios.
export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/store-orders/open",
    permission: "gestor-fabrica.pedidos",
    minimumLevel: "operar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isFactoryOpensOrdersEnabled()) {
    return NextResponse.json(
      { message: "Recurso 'fábrica abre o pedido' está desligado (FACTORY_OPENS_ORDERS)." },
      { status: 409 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | { mode?: string; deliveryDate?: string; referenceDate?: string; storeIds?: string[] }
    | null;

  if (!Array.isArray(payload?.storeIds) || payload.storeIds.length === 0) {
    return NextResponse.json({ message: "Informe ao menos uma loja." }, { status: 400 });
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const batch = await openOrderBatch(
      {
        mode: payload.mode === "week" ? "week" : "manual",
        referenceDate: payload.referenceDate,
        deliveryDate: payload.deliveryDate,
        storeIds: payload.storeIds,
        openedByProfileId: authorization.user.id,
        tenantId: authorization.effectiveTenantId,
      },
      supabase,
    );
    invalidatePlanningCaches(authorization.effectiveTenantId);
    return NextResponse.json(
      { batchId: batch.id, referenceDate: batch.referenceDate, slots: batch.slots },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao abrir o lote.";
    return NextResponse.json({ message }, { status: isClientValidationError(message) ? 400 : 500 });
  }
}
