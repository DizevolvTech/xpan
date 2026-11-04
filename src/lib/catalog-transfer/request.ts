import { NextResponse } from "next/server";

import { parseCatalogFile } from "./build-file";
import { CATALOG_MAX_FILE_BYTES, type CatalogFile } from "./types";

/** Lê o corpo `{ fileName, file, selected? }` com limite de tamanho e valida o arquivo. */
export async function readImportRequest(
  request: Request,
): Promise<{ fileName: string; file: CatalogFile; selected: string[] | null } | { response: NextResponse }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > CATALOG_MAX_FILE_BYTES + 64 * 1024) {
    return { response: NextResponse.json({ message: "O arquivo passa de 10 MB. Exporte menos produtos por vez." }, { status: 413 }) };
  }
  const raw = await request.text();
  if (raw.length > CATALOG_MAX_FILE_BYTES + 64 * 1024) {
    return { response: NextResponse.json({ message: "O arquivo passa de 10 MB. Exporte menos produtos por vez." }, { status: 413 }) };
  }
  let body: { fileName?: unknown; file?: unknown; selected?: unknown } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  const parsed = parseCatalogFile(body?.file);
  if (!parsed.ok) return { response: NextResponse.json({ message: parsed.message }, { status: 400 }) };
  const fileName = typeof body?.fileName === "string" && body.fileName.trim() ? body.fileName.trim().slice(0, 120) : "arquivo.json";
  const selected =
    Array.isArray(body?.selected) && body.selected.every((key) => typeof key === "string") ? (body.selected as string[]) : null;
  return { fileName, file: parsed.file, selected };
}
