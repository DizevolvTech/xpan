import { NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isProductVersionSnapshot } from "@/lib/product-version-snapshot";
import { createTenantScopedSupabaseClient } from "@/lib/supabase-tenant-client";

// A6: este endpoint permanece restrito a gestor-dados.produtos (histórico completo
// no módulo de produtos). A auditoria de cronograma (gestor-fabrica) NÃO consome
// este endpoint — ela lê o último changelog por produto de
// `snapshot.productChangelogByProductId` (GET /api/master-data), que a persona já
// está autorizada a ler. NÃO relaxar a permissão aqui.
export async function GET(
  request: Request,
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

  // ?version=N devolve só a foto do cadastro dessa versão (para restaurar); a lista não a carrega.
  const requestedVersion = new URL(request.url).searchParams.get("version");
  if (requestedVersion !== null) {
    const versionNumber = Number(requestedVersion);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return NextResponse.json({ message: "Versão inválida." }, { status: 400 });
    }
    const versionResult = await supabase
      .from("product_changelog")
      .select("version_number, product_snapshot")
      .eq("product_id", productResult.data.id)
      .eq("version_number", versionNumber)
      .maybeSingle();
    if (versionResult.error) {
      return NextResponse.json({ message: "Falha ao carregar a versão." }, { status: 500 });
    }
    const snapshot = (versionResult.data as { product_snapshot: unknown } | null)?.product_snapshot;
    if (!isProductVersionSnapshot(snapshot)) {
      return NextResponse.json({ message: "Esta versão não tem uma cópia do cadastro para restaurar." }, { status: 404 });
    }
    return NextResponse.json({ versionNumber, productSnapshot: snapshot });
  }

  const { data, error } = await supabase
    .from("product_changelog")
    .select("id, version_number, change_description, changed_by_name, created_at, snapshot_data, product_snapshot")
    .eq("product_id", productResult.data.id)
    .order("version_number", { ascending: false });

  if (error) {
    return NextResponse.json({ message: "Falha ao carregar histórico." }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map(({ product_snapshot, ...entry }) => ({
      ...entry,
      restorable: isProductVersionSnapshot(product_snapshot),
    })),
  );
}
