import { NextResponse } from "next/server";

import type { ProductionItemStatus } from "@/lib/order-planning";
import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { OrderReleaseValidationError } from "@/lib/supabase-data/release-validation";
import {
  cancelOrder,
  releaseOrder,
  reopenOrder,
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
