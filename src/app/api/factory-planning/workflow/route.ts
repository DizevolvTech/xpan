import { NextResponse } from "next/server";

import type { ProductionItemStatus } from "@/lib/order-planning";
import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { releaseOrder, updateProductionItemStatus } from "@/lib/supabase-data/workflow";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as
      | {
          action: "release-order";
          orderId: string;
        }
      | {
          action: "update-production-item-status";
          productionItemKey: string;
          status: ProductionItemStatus;
        };

    if (body.action === "release-order") {
      const authorization = await authorizeApiRequest({
        roles: ["gestor-fabrica"],
      });

      if ("response" in authorization) {
        return authorization.response;
      }

      const supabase = createSupabaseAdminClient();
      await releaseOrder(body.orderId, authorization.user.id, supabase);
      invalidatePlanningCaches();
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update-production-item-status") {
      const authorization = await authorizeApiRequest({
        roles: ["gestor-fabrica", "chao-fabrica"],
      });

      if ("response" in authorization) {
        return authorization.response;
      }

      const supabase = createSupabaseAdminClient();
      await updateProductionItemStatus(body.productionItemKey, body.status, authorization.user.id, supabase);
      invalidatePlanningCaches();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: "Unsupported workflow action" }, { status: 400 });
  } catch (error) {
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
