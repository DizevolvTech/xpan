import { NextResponse } from "next/server";

import type { ProductionWeekDay } from "@/lib/production-planning";
import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { updateScheduleLineStatus } from "@/lib/supabase-data/master-data-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

type RouteContext = {
  params: Promise<{
    scheduleId: string;
  }>;
};

type UpdateScheduleBody = {
  status: "pendente" | "ativo" | "inativo";
  auditNotes?: string;
  dayPrioritiesByItemId?: Record<string, Partial<Record<ProductionWeekDay, number>>>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/master-data/schedules/[scheduleId]",
    permission: "gestor-fabrica.sublinhas",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { scheduleId } = await context.params;
  const payload = (await request.json().catch(() => null)) as UpdateScheduleBody | null;

  if (!payload?.status) {
    return NextResponse.json(
      { message: "Informe o status da linha." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    await updateScheduleLineStatus(scheduleId, payload, {
      supabase,
      actingProfileId: authorization.user.id,
    });
    invalidateMasterDataCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update schedule line" },
      { status: 500 },
    );
  }
}
