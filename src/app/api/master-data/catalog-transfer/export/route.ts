import { NextResponse } from "next/server";

import { buildCatalogFileName, CatalogExportError } from "@/lib/catalog-transfer/build-file";
import { authorizeCatalogTransfer } from "@/lib/catalog-transfer/route-auth";
import { exportCatalog } from "@/lib/catalog-transfer/server";

/** Cartão #241: baixa o arquivo de cadastros (produtos escolhidos + receitas + insumos + MPIs + etapas). */
export async function POST(request: Request) {
  const context = await authorizeCatalogTransfer("POST /api/master-data/catalog-transfer/export", false);
  if ("response" in context) return context.response;
  const body = (await request.json().catch(() => null)) as { productIds?: unknown } | null;
  const productIds =
    Array.isArray(body?.productIds) && body.productIds.every((id) => typeof id === "string")
      ? (body.productIds as string[])
      : null;
  try {
    const file = await exportCatalog(
      context.client,
      context.tenantId,
      context.authorization.selectedTenant?.name ?? "",
      productIds,
    );
    return new NextResponse(JSON.stringify(file), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildCatalogFileName(new Date())}"`,
        "Cache-Control": "no-store",
        "X-Catalog-Products": String(file.products.length),
      },
    });
  } catch (error) {
    if (error instanceof CatalogExportError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("catalog-transfer export", error);
    return NextResponse.json({ message: "Falha ao montar o arquivo de cadastros." }, { status: 500 });
  }
}
