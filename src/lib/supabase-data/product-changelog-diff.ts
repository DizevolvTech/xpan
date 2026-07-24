/* -------------------------------------------------------------------------------------------------
 * AJ-0003.1 — Diff dos campos auditáveis do produto (lógica pura, testável).
 *
 * Ao editar um produto, registramos no `product_changelog.snapshot_data` não só nome/descrição,
 * mas TAMBÉM quais campos mudaram (de/para) — para a auditoria de cronograma mostrar o que foi
 * alterado, além do motivo (`change_description`). Sem `server-only` para ser testável.
 * -----------------------------------------------------------------------------------------------*/

export interface ProductFieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

/** Campos auditados (snake_case, como persistidos) + rótulo humano, na ordem de exibição. */
const AUDITED_FIELDS: Array<{ field: string; label: string }> = [
  { field: "name", label: "Nome" },
  { field: "short_name", label: "Nome curto" },
  { field: "description", label: "Descrição" },
  { field: "active", label: "Ativo" },
  { field: "available_for_ordering", label: "Disponível para pedido" },
  { field: "minimum_production_kg", label: "Produção mínima (Kg)" },
  { field: "economic_production_kg", label: "Produção econômica (Kg)" },
  { field: "capacity_per_batch", label: "Capacidade por batida" },
  { field: "economic_batch_unit", label: "Unidade do lote econômico" },
  { field: "main_ingredient_limit_kg", label: "Limite do ingrediente principal (Kg)" },
  { field: "validity_days", label: "Validade (dias)" },
  { field: "production_days", label: "Dias de produção" },
  { field: "expedition_lead_days", label: "Lead de expedição" },
  { field: "allows_storage", label: "Permite estoque" },
  { field: "preparation_mode", label: "Modo de preparo" },
  { field: "break_percent", label: "Quebra (%)" },
  { field: "break_stage", label: "Etapa da quebra" },
  { field: "can_be_ingredient", label: "Pode ser ingrediente (MPI)" },
  { field: "is_sold_loose", label: "Vendido a granel" },
  { field: "weight_label", label: "Peso" },
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "—";
  }
  if (typeof value === "number") {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
  }
  // Strings numéricas viram número formatado para alinhar com o lado tipado.
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(value));
  }
  return String(value);
}

export function diffProductFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ProductFieldChange[] {
  const changes: ProductFieldChange[] = [];

  for (const { field, label } of AUDITED_FIELDS) {
    if (!(field in after)) {
      continue;
    }

    const fromLabel = formatValue(before[field]);
    const toLabel = formatValue(after[field]);

    if (fromLabel !== toLabel) {
      changes.push({ field, label, from: fromLabel, to: toLabel });
    }
  }

  return changes;
}

/**
 * Campos cuja alteração impacta o cronograma de produção — composição da grade
 * (produtos ativos/pedíveis), timing (dias/lead) ou capacidade por batida.
 * Usado para decidir se a edição de um produto exige reauditoria do cronograma.
 */
export const SCHEDULE_RELEVANT_FIELDS = new Set<string>([
  "active",
  "available_for_ordering",
  "production_days",
  "expedition_lead_days",
  "minimum_production_kg",
  "capacity_per_batch",
]);

/**
 * XPAN-6.3 — TRUE se alguma mudança de campo toca o cronograma de produção.
 * Alterações só de receita (ingredientes/quantidades), nome, descrição, modo de
 * preparo, quebra, embalagem ou validade NÃO exigem reauditoria do cronograma.
 */
export function changeAffectsCronograma(changes: ProductFieldChange[]): boolean {
  return changes.some((change) => SCHEDULE_RELEVANT_FIELDS.has(change.field));
}
