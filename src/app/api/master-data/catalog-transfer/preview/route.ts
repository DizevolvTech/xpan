import { NextResponse } from "next/server";

import { buildCatalogReview, defaultSelection } from "@/lib/catalog-transfer/review";
import { readImportRequest } from "@/lib/catalog-transfer/request";
import { authorizeCatalogTransfer } from "@/lib/catalog-transfer/route-auth";
import { loadCatalogTables } from "@/lib/catalog-transfer/server";

/** Cartão #241: revisão ANTES de gravar (novo / vai atualizar / igual, insumos, etapas, conflitos). Não grava nada. */
export async function POST(request: Request) {
  const context = await authorizeCatalogTransfer("POST /api/master-data/catalog-transfer/preview", false);
  if ("response" in context) return context.response;
  const parsed = await readImportRequest(request);
  if ("response" in parsed) return parsed.response;
  try {
    const destination = await loadCatalogTables(context.client, context.tenantId);
    const review = buildCatalogReview(parsed.file, destination);
    return NextResponse.json({ review, defaultSelected: defaultSelection(review) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("catalog-transfer preview", error);
    return NextResponse.json({ message: "Falha ao comparar o arquivo com o cadastro atual." }, { status: 500 });
  }
}
