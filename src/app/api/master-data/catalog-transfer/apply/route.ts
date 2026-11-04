import { NextResponse } from "next/server";

import { CatalogPlanError } from "@/lib/catalog-transfer/plan";
import { readImportRequest } from "@/lib/catalog-transfer/request";
import { authorizeCatalogTransfer } from "@/lib/catalog-transfer/route-auth";
import { applyCatalogImport, CatalogApplyError } from "@/lib/catalog-transfer/server";

/** Cartão #241: grava a importação confirmada. Tudo ou nada: falhou, desfaz o que já tinha gravado. */
export async function POST(request: Request) {
  const context = await authorizeCatalogTransfer("POST /api/master-data/catalog-transfer/apply", true);
  if ("response" in context) return context.response;
  const parsed = await readImportRequest(request);
  if ("response" in parsed) return parsed.response;
  if (!parsed.selected || parsed.selected.length === 0) {
    return NextResponse.json({ message: "Marque ao menos um produto para importar." }, { status: 400 });
  }
  try {
    const result = await applyCatalogImport({
      client: context.client,
      tenantId: context.tenantId,
      actingProfileId: context.authorization.user.id,
      file: parsed.file,
      fileName: parsed.fileName,
      selectedKeys: parsed.selected,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CatalogPlanError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof CatalogApplyError) {
      console.error("catalog-transfer apply", error.message, error.rollbackFailures);
      return NextResponse.json({ message: error.message, rollbackFailures: error.rollbackFailures }, { status: 500 });
    }
    console.error("catalog-transfer apply", error);
    return NextResponse.json({ message: "Falha ao importar os cadastros. Nada foi gravado." }, { status: 500 });
  }
}
