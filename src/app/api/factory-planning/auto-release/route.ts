import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidatePlanningCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { autoReleaseEligibleOrders } from "@/lib/supabase-data/workflow";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import { getTodayDateKey } from "@/lib/order-planning";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/factory-planning/auto-release",
    permission: "gestor-fabrica.pedidos",
    minimumLevel: "operar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  let referenceDate: string;
  try {
    const body = (await request.json().catch(() => ({}))) as { referenceDate?: unknown };
    referenceDate =
      typeof body.referenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.referenceDate)
        ? body.referenceDate
        : getTodayDateKey();
  } catch {
    referenceDate = getTodayDateKey();
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const result = await autoReleaseEligibleOrders(
      {
        referenceDate,
        tenantId: authorization.effectiveTenantId,
        triggeredByProfileId: authorization.user.id,
      },
      supabase,
    );
    invalidatePlanningCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true, referenceDate, ...result });
  } catch (error) {
    console.error("Failed to auto-release orders", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to auto-release orders",
      },
      { status: 500 },
    );
  }
}
