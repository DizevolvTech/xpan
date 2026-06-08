/* -------------------------------------------------------------------------------------------------
 * A6 — Redução do último changelog por produto para o snapshot de master-data.
 *
 * A auditoria de cronograma (gestor-fabrica) consome a justificativa/campos alterados da última
 * edição de cada produto a partir do snapshot de master-data (que essa persona já está autorizada
 * a ler), em vez do endpoint cross-módulo `/api/master-data/products/[id]/changelog` (que exige a
 * permissão `gestor-dados.produtos`, indisponível ao gestor-fabrica → 403 silencioso).
 *
 * Sem `server-only` para ser testável como lógica pura.
 * -----------------------------------------------------------------------------------------------*/

export interface ChangelogFieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface ProductChangelogSummary {
  versionNumber: number;
  changeDescription: string | null;
  changedByName: string | null;
  createdAt: string;
  changedFields: ChangelogFieldChange[];
}

/** Linha bruta de `product_changelog` (subset selecionado). */
export interface ProductChangelogRow {
  product_id: string;
  version_number: number;
  change_description: string | null;
  changed_by_name: string | null;
  created_at: string;
  snapshot_data: { changedFields?: ChangelogFieldChange[] } | null;
}

function normalizeChangedFields(snapshotData: ProductChangelogRow["snapshot_data"]): ChangelogFieldChange[] {
  const raw = snapshotData?.changedFields;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((entry): entry is ChangelogFieldChange => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      field: String(entry.field ?? ""),
      label: String(entry.label ?? ""),
      from: String(entry.from ?? ""),
      to: String(entry.to ?? ""),
    }));
}

/**
 * Reduz as linhas de `product_changelog` ao ÚLTIMO registro por produto.
 *
 * As linhas DEVEM vir ordenadas por `version_number` descrescente (a query usa
 * `.order("product_id").order("version_number", { ascending: false })`), de modo que a primeira
 * ocorrência de cada `product_id` é a versão mais recente. A chave do mapa de saída é o
 * `legacy_id` do produto (via `productLegacyById`) para casar com o `productId` do snapshot.
 */
export function reduceLatestChangelogByProduct(
  rows: ProductChangelogRow[],
  productLegacyById: Map<string, string>,
): Record<string, ProductChangelogSummary> {
  const result: Record<string, ProductChangelogSummary> = {};

  for (const row of rows) {
    const key = productLegacyById.get(row.product_id) ?? row.product_id;
    // Como as linhas já vêm ordenadas por versão desc, a 1ª ocorrência por produto é a última edição.
    if (key in result) {
      continue;
    }
    result[key] = {
      versionNumber: row.version_number,
      changeDescription: row.change_description,
      changedByName: row.changed_by_name,
      createdAt: row.created_at,
      changedFields: normalizeChangedFields(row.snapshot_data),
    };
  }

  return result;
}
