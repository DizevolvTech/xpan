import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SubcategoryInput } from "@/lib/supabase-data/master-data-admin";
import { updateSubcategory } from "@/lib/supabase-data/master-data-admin";

type RouteContext = {
  params: Promise<{
    subcategoryId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    permission: "gestor-dados.linhas",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { subcategoryId } = await context.params;
  const payload = (await request.json().catch(() => null)) as SubcategoryInput | null;

  if (!payload?.name?.trim() || !payload?.sectorId) {
    return NextResponse.json(
      { message: "Informe nome e categoria da subcategoria." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    await updateSubcategory(subcategoryId, payload, { supabase });
    invalidateMasterDataCaches();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update subcategory" },
      { status: 500 },
    );
  }
}
