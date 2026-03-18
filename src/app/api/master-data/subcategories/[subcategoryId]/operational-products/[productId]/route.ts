import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { removeProductFromOperationalSubcategory } from "@/lib/supabase-data/master-data-admin";

type RouteContext = {
  params: Promise<{
    subcategoryId: string;
    productId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    permission: "gestor-dados.linhas",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { subcategoryId, productId } = await context.params;

  try {
    const supabase = createSupabaseAdminClient();
    await removeProductFromOperationalSubcategory(subcategoryId, productId, {
      supabase,
      actingProfileId: authorization.user.id,
    });
    invalidateMasterDataCaches();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to remove product from operational subcategory",
      },
      { status: 500 },
    );
  }
}
