import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const authorization = await authorizeApiRequest({
    contextLabel: "GET /api/master-data/products/[productId]/changelog",
    permission: "gestor-dados.produtos",
    minimumLevel: "visualizar",
    requireTenantContext: true,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const { productId } = await params;

  const supabase = createTenantScopedSupabaseClient(
    authorization.effectiveTenantId,
    createSupabaseAdminClient(),
  );

  // Resolve product DB id from legacy_id or id
  const productResult = await supabase
    .from("products")
    .select("id")
    .or(`id.eq.${productId},legacy_id.eq.${productId}`)
    .maybeSingle();

  if (!productResult.data) {
    return NextResponse.json({ message: "Produto não encontrado." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("product_changelog")
    .select("id, version_number, change_description, changed_by_name, created_at")
    .eq("product_id", productResult.data.id)
    .order("version_number", { ascending: false });

  if (error) {
    return NextResponse.json({ message: "Falha ao carregar histórico." }, { status: 500 });
  }

  return NextResponse.json(data);
}
