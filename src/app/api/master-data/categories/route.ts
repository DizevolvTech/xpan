import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { CategoryInput } from "@/lib/supabase-data/master-data-admin";
import { createCategory } from "@/lib/supabase-data/master-data-admin";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    permission: "gestor-dados.setores",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const payload = (await request.json().catch(() => null)) as CategoryInput | null;

  if (!payload?.name?.trim() || !payload?.responsible?.trim()) {
    return NextResponse.json(
      { message: "Informe nome e responsável da categoria." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    await createCategory(payload, { supabase });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create category" },
      { status: 500 },
    );
  }
}
