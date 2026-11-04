import { NextResponse } from "next/server";

import { authorizeApiRequest, getAllowedStoreIds } from "@/lib/api-auth";
import { hasAnyNonStoreAccess } from "@/lib/permission-modules";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function GET(request: Request) {
  // Quadro #235: ?fresh=1 (depois de salvar) pula o cache de dados mestres desta instância.
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/master-data",
    includeStoreScope: true,
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const snapshot = await getMasterDataSnapshot({
      supabase,
      tenantId: authorization.effectiveTenantId,
      forceRefresh: fresh,
      includeProfileNames: hasAnyNonStoreAccess(authorization.permissions),
      // A6: a auditoria de cronograma (gestor-fabrica) consome o último changelog por
      // produto daqui, em vez do endpoint cross-módulo que exige gestor-dados.produtos.
      // Loja não recebe o histórico de alterações.
      includeProductChangelog: hasAnyNonStoreAccess(authorization.permissions),
    });
    const allowedStoreIds = getAllowedStoreIds(authorization);

    return NextResponse.json({
      ...snapshot,
      stores:
        allowedStoreIds === null
          ? snapshot.stores
          : snapshot.stores.filter((store) => allowedStoreIds.includes(store.id)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load master data snapshot",
      },
      { status: 500 },
    );
  }
}
