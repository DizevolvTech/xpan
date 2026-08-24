import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { StoreInput } from "@/lib/supabase-data/master-data-admin";
import { MasterDataValidationError, updateStore } from "@/lib/supabase-data/master-data-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

type RouteContext = {
  params: Promise<{
    storeId: string;
  }>;
};

function isClientValidationError(message: string, error?: unknown) {
  if (error instanceof MasterDataValidationError) {
    return true;
  }
  const normalized = message.toLowerCase();
  return (
    normalized.includes("selecione") ||
    normalized.includes("tipo loja") ||
    normalized.includes("já existe uma loja")
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/master-data/stores/[storeId]",
    permission: "gestor-dados.lojas",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { storeId } = await context.params;
  const payload = (await request.json().catch(() => null)) as StoreInput | null;

  if (!payload?.name?.trim()) {
    return NextResponse.json(
      { message: "Informe o nome da loja." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    await updateStore(storeId, payload, { supabase });
    invalidateMasterDataCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update store";
    return NextResponse.json(
      { message },
      { status: isClientValidationError(message, error) ? 400 : 500 },
    );
  }
}
