import { NextResponse } from "next/server";

import type { ProductionItemStatus } from "@/lib/order-planning";
import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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

      const supabase = await createSupabaseServerClient();
      await releaseOrder(body.orderId, authorization.user.id, supabase);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update-production-item-status") {
      const authorization = await authorizeApiRequest({
        roles: ["gestor-fabrica", "chao-fabrica"],
      });

      if ("response" in authorization) {
        return authorization.response;
      }

      const supabase = await createSupabaseServerClient();
      await updateProductionItemStatus(body.productionItemKey, body.status, authorization.user.id, supabase);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: "Unsupported workflow action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update workflow",
      },
      { status: 500 },
    );
  }
}
