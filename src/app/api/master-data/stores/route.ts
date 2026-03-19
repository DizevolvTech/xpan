import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { StoreInput } from "@/lib/supabase-data/master-data-admin";
import { createStore } from "@/lib/supabase-data/master-data-admin";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest({
    contextLabel: "POST /api/master-data/stores",
    permission: "gestor-dados.lojas",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const payload = (await request.json().catch(() => null)) as StoreInput | null;

  if (!payload?.name?.trim() || !payload?.responsible?.trim()) {
    return NextResponse.json(
      { message: "Informe nome e responsável da loja." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    await createStore(payload, { supabase });
    invalidateMasterDataCaches();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create store" },
      { status: 500 },
    );
  }
}
