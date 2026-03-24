import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { ProductInput } from "@/lib/supabase-data/master-data-admin";
import { createProduct } from "@/lib/supabase-data/master-data-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/master-data/products",
    permission: "gestor-dados.produtos",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const payload = (await request.json().catch(() => null)) as ProductInput | null;

  if (!payload?.name?.trim() || !payload?.lineId) {
    return NextResponse.json(
      { message: "Informe nome e subcategoria do produto." },
      { status: 400 },
    );
  }

  if (!Array.isArray(payload.preparationStages) || payload.preparationStages.length === 0) {
    return NextResponse.json(
      { message: "Configure ao menos uma etapa intermediária de preparo para o produto." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const created = await createProduct(payload, {
      supabase,
      actingProfileId: authorization.user.id,
    });
    invalidateMasterDataCaches(authorization.effectiveTenantId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create product" },
      { status: 500 },
    );
  }
}
