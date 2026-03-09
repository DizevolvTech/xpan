import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { IngredientInput } from "@/lib/supabase-data/master-data-admin";
import { createIngredient } from "@/lib/supabase-data/master-data-admin";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    permission: "gestor-dados.ingredientes",
    minimumLevel: "gerenciar",
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

  try {
    const supabase = await createSupabaseServerClient();
    await createIngredient(payload, { supabase });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create ingredient" },
      { status: 500 },
    );
  }
}
