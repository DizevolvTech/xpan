import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { CategoryInput } from "@/lib/supabase-data/master-data-admin";
import { updateCategory } from "@/lib/supabase-data/master-data-admin";

type RouteContext = {
  params: Promise<{
    categoryId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    permission: "gestor-dados.setores",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { categoryId } = await context.params;
  const payload = (await request.json().catch(() => null)) as CategoryInput | null;

  if (!payload?.name?.trim() || !payload?.responsible?.trim()) {
    return NextResponse.json(
      { message: "Informe nome e responsável da categoria." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    await updateCategory(categoryId, payload, { supabase });
    invalidateMasterDataCaches();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update category" },
      { status: 500 },
    );
  }
}
