import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { IngredientInput } from "@/lib/supabase-data/master-data-admin";
import { MasterDataValidationError, createIngredient } from "@/lib/supabase-data/master-data-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/master-data/ingredients",
    permission: "gestor-dados.ingredientes",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const payload = (await request.json().catch(() => null)) as IngredientInput | null;

  if (!payload?.name?.trim()) {
    return NextResponse.json(
      { message: "Informe o nome do ingrediente." },
      { status: 400 },
    );
  }

  if (!payload.externalCode?.trim()) {
    return NextResponse.json(
      { message: "Informe o código ERP do cliente." },
      { status: 400 },
    );
  }

  try {
    const supabase = createTenantScopedSupabaseClient(
      authorization.effectiveTenantId,
      createSupabaseAdminClient(),
    );
    const ingredient = await createIngredient(payload, { supabase });
    invalidateMasterDataCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true, id: ingredient.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create ingredient";
    const isValidation =
      error instanceof MasterDataValidationError ||
      message.toLowerCase().includes("código erp") ||
      message.toLowerCase().includes("já está em uso");
    return NextResponse.json({ message }, { status: isValidation ? 400 : 500 });
  }
}
