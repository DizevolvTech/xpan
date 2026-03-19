import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SubcategoryInput } from "@/lib/supabase-data/master-data-admin";
import { createSubcategory } from "@/lib/supabase-data/master-data-admin";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/master-data/subcategories",
    permission: "gestor-dados.linhas",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const payload = (await request.json().catch(() => null)) as SubcategoryInput | null;

  if (!payload?.name?.trim() || !payload?.sectorId) {
    return NextResponse.json(
      { message: "Informe nome e categoria da subcategoria." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const created = await createSubcategory(payload, { supabase });
    invalidateMasterDataCaches();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create subcategory" },
      { status: 500 },
    );
  }
}
