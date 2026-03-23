import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { assignProductToOperationalSubcategory } from "@/lib/supabase-data/master-data-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

type RouteContext = {
  params: Promise<{
    subcategoryId: string;
  }>;
};

type AssignOperationalProductBody = {
  productId?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/master-data/subcategories/[subcategoryId]/operational-products",
    permission: "gestor-dados.linhas",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { subcategoryId } = await context.params;
  const payload = (await request.json().catch(() => null)) as AssignOperationalProductBody | null;

  if (!payload?.productId) {
    return NextResponse.json(
      { message: "Informe o produto que será adicionado à carteira operacional." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    await assignProductToOperationalSubcategory(subcategoryId, payload.productId, {
      supabase,
      actingProfileId: authorization.user.id,
    });
    invalidateMasterDataCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to assign product to operational subcategory",
      },
      { status: 500 },
    );
  }
}
