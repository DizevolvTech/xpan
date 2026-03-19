import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { invalidateMasterDataCaches } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { StoreInput } from "@/lib/supabase-data/master-data-admin";
import { createStore } from "@/lib/supabase-data/master-data-admin";

function isClientValidationError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("selecione") || normalized.includes("tipo loja");
}

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

  if (!payload?.name?.trim() || !payload?.responsibleProfileId?.trim()) {
    return NextResponse.json(
      { message: "Informe nome e selecione o usuário responsável da loja." },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    await createStore(payload, { supabase });
    invalidateMasterDataCaches();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create store";
    return NextResponse.json(
      { message },
      { status: isClientValidationError(message) ? 400 : 500 },
    );
  }
}
