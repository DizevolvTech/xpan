import { NextResponse } from "next/server";

import type { ProductionItemStatus } from "@/lib/order-planning";
import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { OrderReleaseValidationError } from "@/lib/supabase-data/release-validation";
import {
  cancelOrder,
  completeProductionBatch,
  releaseOrder,
  reopenOrder,
  startProductionItem,
  undoProductionBatch,
  updateProductionItemStatus,
} from "@/lib/supabase-data/workflow";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as
      | {
          action: "release-order";
          orderId: string;
          force?: boolean;
          referenceDate?: string;
        }
      | {
          action: "cancel-order";
          orderId: string;
        }
      | {
          action: "reopen-order";
          orderId: string;
        }
      | {
          action: "update-production-item-status";
          productionItemKey: string;
          status: ProductionItemStatus;
        }
      | {
          action: "start-production-item";
          productionItemKey: string;
        }
      | {
          action: "complete-production-batch";
          productionItemKey: string;
          batchCount: number;
        }
      | {
          action: "undo-production-batch";
          productionItemKey: string;
        };

    if (body.action === "release-order") {
      const authorization = await authorizeApiRequest({
        contextLabel: "PATCH /api/factory-planning/workflow release-order",
        permission: "gestor-fabrica.pedidos",
        minimumLevel: "operar",
        requireTenantContext: true,
        requireWritableTenant: true,
      });

      if ("response" in authorization) {
        return authorization.response;
      }

      const supabase = createTenantScopedSupabaseClient(
        authorization.effectiveTenantId,
        createSupabaseAdminClient(),
      );
      await releaseOrder(body.orderId, authorization.user.id, supabase, {
        tenantId: authorization.effectiveTenantId,
        force: body.force === true,
        referenceDate:
          typeof body.referenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.referenceDate)
            ? body.referenceDate
            : undefined,
      });
      invalidatePlanningCaches(authorization.effectiveTenantId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "cancel-order" || body.action === "reopen-order") {
      const authorization = await authorizeApiRequest({
        contextLabel: `PATCH /api/factory-planning/workflow ${body.action}`,
        permission: "gestor-fabrica.pedidos",
        minimumLevel: "operar",
        requireTenantContext: true,
        requireWritableTenant: true,
      });

      if ("response" in authorization) {
        return authorization.response;
      }

      const supabase = createTenantScopedSupabaseClient(
        authorization.effectiveTenantId,
        createSupabaseAdminClient(),
      );

      if (body.action === "cancel-order") {
        await cancelOrder(body.orderId, authorization.user.id, supabase);
      } else {
        await reopenOrder(body.orderId, authorization.user.id, supabase);
      }

      invalidatePlanningCaches(authorization.effectiveTenantId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update-production-item-status") {
      const authorization = await authorizeApiRequest({
        contextLabel: "PATCH /api/factory-planning/workflow update-production-item-status",
        anyOfPermissions: ["gestor-fabrica.ops", "chao-fabrica.ops"],
        minimumLevel: "operar",
        requireTenantContext: true,
        requireWritableTenant: true,
      });

      if ("response" in authorization) {
        return authorization.response;
      }

      const supabase = createTenantScopedSupabaseClient(
        authorization.effectiveTenantId,
        createSupabaseAdminClient(),
      );
      await updateProductionItemStatus(
        body.productionItemKey,
        body.status,
        authorization.user.id,
        authorization.effectiveTenantId,
        supabase,
      );
      invalidatePlanningCaches(authorization.effectiveTenantId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "start-production-item") {
      // "Iniciar produção do dia" (gestor): manda a OP para o quadro do Chão sem
      // avançar o status do item. Apenas o gestor inicia o dia de produção.
      const authorization = await authorizeApiRequest({
        contextLabel: "PATCH /api/factory-planning/workflow start-production-item",
        permission: "gestor-fabrica.ops",
        minimumLevel: "operar",
        requireTenantContext: true,
        requireWritableTenant: true,
      });

      if ("response" in authorization) {
        return authorization.response;
      }

      const supabase = createTenantScopedSupabaseClient(
        authorization.effectiveTenantId,
        createSupabaseAdminClient(),
      );
      await startProductionItem(
        body.productionItemKey,
        authorization.user.id,
        authorization.effectiveTenantId,
        supabase,
      );
      invalidatePlanningCaches(authorization.effectiveTenantId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "complete-production-batch" || body.action === "undo-production-batch") {
      const authorization = await authorizeApiRequest({
        contextLabel: `PATCH /api/factory-planning/workflow ${body.action}`,
        anyOfPermissions: ["gestor-fabrica.ops", "chao-fabrica.ops"],
        minimumLevel: "operar",
        requireTenantContext: true,
        requireWritableTenant: true,
      });
      if ("response" in authorization) {
        return authorization.response;
      }
      const supabase = createTenantScopedSupabaseClient(
        authorization.effectiveTenantId,
        createSupabaseAdminClient(),
      );
      if (body.action === "complete-production-batch") {
        await completeProductionBatch(
          body.productionItemKey,
          body.batchCount,
          authorization.user.id,
          authorization.effectiveTenantId,
          supabase,
        );
      } else {
        await undoProductionBatch(
          body.productionItemKey,
          authorization.user.id,
          authorization.effectiveTenantId,
          supabase,
        );
      }
      invalidatePlanningCaches(authorization.effectiveTenantId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: "Unsupported workflow action" }, { status: 400 });
  } catch (error) {
    if (error instanceof OrderReleaseValidationError) {
      return NextResponse.json(
        {
          message: error.message,
          reason: error.reason,
          // A UI distingue "cancelado" (irrecuperável) dos demais (overridable
          // via force) por esse campo.
          forceable: error.reason !== "order_cancelled",
        },
        { status: 400 },
      );
    }
    console.error("Failed to update factory workflow", error);
    const message = error instanceof Error ? error.message : "Failed to update workflow";
    return NextResponse.json(
      {
        message,
      },
      { status: message.toLowerCase().includes("invalid") ? 400 : 500 },
    );
  }
}
