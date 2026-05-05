import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { OperationalSettingsInput } from "@/lib/supabase-data/master-data-admin";
import { updateOperationalSettings } from "@/lib/supabase-data/master-data-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function PATCH(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/master-data/operational-settings",
    permission: "gestor-fabrica.dashboard",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const payload = (await request.json().catch(() => null)) as OperationalSettingsInput | null;

  if (
    !payload ||
    typeof payload.orderCutoffTime !== "string" ||
    typeof payload.expeditionLeadDays !== "number" ||
    typeof payload.saleLeadDays !== "number"
  ) {
    return NextResponse.json(
      { message: "Informe o horário limite, o D+X de expedição e o D+X de venda." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const updatedSettings = await updateOperationalSettings(payload, {
      supabase,
      actingProfileId: authorization.user.id,
    });
    invalidateMasterDataCaches(authorization.effectiveTenantId);
    return NextResponse.json(updatedSettings);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to update operational settings",
      },
      { status: 500 },
    );
  }
}
