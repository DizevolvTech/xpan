import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { ProductInput } from "@/lib/supabase-data/master-data-admin";
import { updateProduct } from "@/lib/supabase-data/master-data-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";
import { MasterDataValidationError } from "@/lib/supabase-data/master-data-admin";

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

// Distingue rejeições de regra de negócio (→ HTTP 400, mensagem pt-BR exibível ao
// usuário) de falhas internas (→ 500). `updateProduct` lança validações como
// `Error` em pt-BR (ex.: código ERP em uso / imutável) e, em fluxos de revisão,
// como `MasterDataValidationError`.
function isClientValidationError(error: unknown): boolean {
  if (error instanceof MasterDataValidationError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return (
    normalized.includes("código erp") ||
    normalized.includes("já está em uso") ||
    normalized.includes("não pode ser alterado") ||
    normalized.includes("somente produtos ativos") ||
    normalized.includes("não está vinculado operacionalmente")
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    contextLabel: "PATCH /api/master-data/products/[productId]",
    permission: "gestor-dados.produtos",
    minimumLevel: "gerenciar",
    requireTenantContext: true,
    requireWritableTenant: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { productId } = await context.params;
  const payload = (await request.json().catch(() => null)) as ProductInput | null;

  if (!payload?.name?.trim() || !payload?.lineId) {
    return NextResponse.json(
      { message: "Informe nome e linha de produção do produto." },
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
    const { scheduleRevisionImpact } = await updateProduct(productId, payload, {
      supabase,
      actingProfileId: authorization.user.id,
    });
    invalidateMasterDataCaches(authorization.effectiveTenantId);
    return NextResponse.json({ ok: true, scheduleRevisionImpact });
  } catch (error) {
    if (isClientValidationError(error)) {
      return NextResponse.json(
        { message: (error as Error).message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update product" },
      { status: 500 },
    );
  }
}
