import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { IngredientInput } from "@/lib/supabase-data/master-data-admin";
import { updateIngredient } from "@/lib/supabase-data/master-data-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

type RouteContext = {
  params: Promise<{
    ingredientId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/master-data/ingredients/[ingredientId]",
    permission: "gestor-dados.ingredientes",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { ingredientId } = await context.params;
  const payload = (await request.json().catch(() => null)) as IngredientInput | null;

  if (!payload?.name?.trim()) {
    return NextResponse.json(
      { message: "Informe o nome do ingrediente." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    await updateIngredient(ingredientId, payload, { supabase });
    invalidateMasterDataCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true, id: ingredientId });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update ingredient" },
      { status: 500 },
    );
  }
}
