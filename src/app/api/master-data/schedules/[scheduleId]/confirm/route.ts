import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  MasterDataValidationError,
  confirmPendingScheduleRevision,
} from "@/lib/supabase-data/master-data-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

type RouteContext = {
  params: Promise<{
    scheduleId: string;
  }>;
};

/**
 * Confirmação única exibida na tela do produto quando a linha tem ordens em andamento.
 * Permissão de PRODUTOS (a mesma de quem acabou de editar), não a da tela de auditoria.
 */
export async function POST(_request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/master-data/schedules/[scheduleId]/confirm",
    permission: "gestor-dados.produtos",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { scheduleId } = await context.params;

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    await confirmPendingScheduleRevision(scheduleId, {
      supabase,
      actingProfileId: authorization.user.id,
    });
    invalidateMasterDataCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MasterDataValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to confirm schedule" },
      { status: 500 },
    );
  }
}
