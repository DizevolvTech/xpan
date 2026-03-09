import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ProductInput } from "@/lib/supabase-data/master-data-admin";
import { updateProduct } from "@/lib/supabase-data/master-data-admin";

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await authorizeApiRequest({
    permission: "gestor-dados.produtos",
    minimumLevel: "gerenciar",
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { productId } = await context.params;
  const payload = (await request.json().catch(() => null)) as ProductInput | null;

  if (!payload?.name?.trim() || !payload?.lineId) {
    return NextResponse.json(
      { message: "Informe nome e subcategoria do produto." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    await updateProduct(productId, payload, { supabase });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update product" },
      { status: 500 },
    );
  }
}
