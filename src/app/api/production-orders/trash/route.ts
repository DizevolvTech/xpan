import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { getTodayDateKey } from "@/lib/order-planning";
import { productionOrderPlanningKey } from "@/lib/production-order-trash-filter";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";
import {
  listTrashedProductionOrders,
  restoreProductionOrder,
  trashProductionOrder,
} from "@/lib/supabase-data/production-order-trash";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import { isMasterRole } from "@/lib/tenant";

/**
 * Lixeira de OPs (reunião 22/10, bloco 8). Decisão do Lucas (24/10): só o MASTER exclui,
 * com lixeira. O Master abre o cliente em modo leitura; esta é a única escrita liberada a
 * ele aqui, e só ele passa (o gestor do cliente recebe 403).
 */
async function authorizeMaster(contextLabel: string) {
  const authorization = await authorizeApiRequest({
    contextLabel,
    permission: "gestor-fabrica.ops",
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });
  if ("response" in authorization) return authorization;
  if (!isMasterRole(authorization.actorRole)) {
    return {
      response: NextResponse.json({ message: "Só o Master pode excluir ou restaurar OP." }, { status: 403 }),
    };
  }
  return authorization;
}

export async function GET() {
  const authorization = await authorizeMaster("GET /api/production-orders/trash");
  if ("response" in authorization) return authorization.response;
  const supabase = createTenantScopedSupabaseClient(authorization.effectiveTenantId, createSupabaseAdminClient());
  try {
    return NextResponse.json(
      { items: await listTrashedProductionOrders(supabase) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Falha ao carregar a lixeira." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeMaster("POST /api/production-orders/trash");
  if ("response" in authorization) return authorization.response;
  const tenantId = authorization.effectiveTenantId as string;
  const supabase = createTenantScopedSupabaseClient(tenantId, createSupabaseAdminClient());
  const body = (await request.json().catch(() => null)) as
    | { action?: unknown; planningKey?: unknown; trashId?: unknown; referenceDate?: unknown }
    | null;

  try {
    if (body?.action === "restore") {
      if (typeof body.trashId !== "string" || !body.trashId) {
        return NextResponse.json({ message: "Informe a OP da lixeira." }, { status: 400 });
      }
      await restoreProductionOrder(body.trashId, authorization.user.id, supabase);
      invalidatePlanningCaches(tenantId);
      return NextResponse.json({ ok: true });
    }

    if (body?.action === "trash") {
      const planningKey = typeof body.planningKey === "string" ? body.planningKey : "";
      const referenceDate =
        typeof body.referenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.referenceDate)
          ? body.referenceDate
          : getTodayDateKey();
      if (!planningKey) {
        return NextResponse.json({ message: "Informe a OP." }, { status: 400 });
      }
      // Os dados gravados vêm do servidor, não do navegador.
      const planning = await getFactoryPlanningSnapshot(referenceDate, { supabase, tenantId });
      const op = planning.productionOrders.find((item) => productionOrderPlanningKey(item) === planningKey);
      if (!op) {
        return NextResponse.json({ message: "OP não encontrada (já excluída?)." }, { status: 404 });
      }
      await trashProductionOrder(
        {
          planningKey,
          opCode: op.code,
          productionDate: op.productionDate,
          lineName: op.lineName,
          productsCount: op.items.length,
          totalKg: op.totalKg,
          orderCodes: op.orderCodes,
          profileId: authorization.user.id,
        },
        supabase,
      );
      invalidatePlanningCaches(tenantId);
      return NextResponse.json({ ok: true, opCode: op.code });
    }

    return NextResponse.json({ message: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Falha na lixeira de OPs." },
      { status: 500 },
    );
  }
}
