import { NextResponse } from "next/server";

import { authorizeApiRequest, getAllowedStoreIds } from "@/lib/api-auth";
import { isFactoryOpensOrdersEnabled } from "@/lib/feature-flags";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  listOpenStoreOrders,
  openStoreOrders,
  openWeeklyStoreOrdersFromSchedule,
} from "@/lib/supabase-data/store-orders";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

// Rejeições de regra de negócio → HTTP 400 (não 500). Mesmo padrão de
// src/app/api/store-orders/route.ts (substrings das mensagens lançadas).
function isClientValidationError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("cronograma") ||
    normalized.includes("nenhuma loja") ||
    normalized.includes("dia de entrega") ||
    normalized.includes("não há") ||
    normalized.includes("invalid") ||
    normalized.includes("not found")
  );
}

// AJ-0009 Fase 4a: a loja lista os pedidos `aberto` (abertos pela fábrica) para preencher.
export async function GET() {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/store-orders/open",
    permission: "loja.pedidos",
    minimumLevel: "operar",
    includeStoreScope: true,
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  if (!isFactoryOpensOrdersEnabled()) {
    // Flag off: nenhum pedido aberto a preencher (fluxo legado: a loja cria).
    return NextResponse.json([]);
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const openOrders = await listOpenStoreOrders(supabase, getAllowedStoreIds(authorization));
    return NextResponse.json(openOrders);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Falha ao carregar pedidos abertos." },
      { status: 500 },
    );
  }
}

// AJ-0009 Fase 4a: a fábrica abre pedidos (status `aberto`) para as lojas preencherem.
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

  const isWeekMode = payload?.mode === "week";

  if (!Array.isArray(payload?.storeIds) || payload.storeIds.length === 0) {
    return NextResponse.json({ message: "Informe ao menos uma loja." }, { status: 400 });
  }
  if (!isWeekMode && !payload.deliveryDate) {
    return NextResponse.json(
      { message: "Informe a data de entrega e ao menos uma loja." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    // A10: mode 'week' libera os pedidos da SEMANA por dia (derivados do cronograma).
    // Caso contrário, mantém a abertura MANUAL de UMA data de entrega.
    const result = isWeekMode
      ? await openWeeklyStoreOrdersFromSchedule(
          {
            referenceDate: payload.referenceDate,
            storeIds: payload.storeIds,
            openedByProfileId: authorization.user.id,
            tenantId: authorization.effectiveTenantId,
          },
          supabase,
        )
      : await openStoreOrders(
          {
            deliveryDate: payload.deliveryDate!,
            storeIds: payload.storeIds,
            openedByProfileId: authorization.user.id,
            tenantId: authorization.effectiveTenantId,
          },
          supabase,
        );
    invalidatePlanningCaches(authorization.effectiveTenantId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao abrir pedidos.";
    return NextResponse.json({ message }, { status: isClientValidationError(message) ? 400 : 500 });
  }
}
