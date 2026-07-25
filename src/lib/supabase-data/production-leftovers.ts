import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertTenantId,
  isSupabaseMissingSchemaError,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface RecordProductionLeftoverInput {
  tenantId: string;
  /** Chave canônica do item de OP (productionDate|lineId|productId). */
  planningKey: string;
  productId: string;
  productName?: string | null;
  productionDate: string;
  plannedQuantity: number;
  producedQuantity: number;
  /**
   * Quantidade que o OPERADOR informou ao concluir o item. `null` quando ele não
   * informou nada — aí `producedQuantity` é a estimativa do plano de batidas.
   */
  reportedProducedQuantity?: number | null;
  unit: string;
  recordedByProfileId?: string | null;
}

export interface ProductionLeftoverRow {
  id: string;
  planningKey: string;
  productId: string;
  productName: string;
  productionDate: string;
  plannedQuantity: number;
  producedQuantity: number;
  /** produced - planned. Positivo = sobra, negativo = falta. */
  leftoverQuantity: number;
  /** true = quantidade medida no chão; false = estimativa do plano de batidas. */
  isReported: boolean;
  unit: string;
  recordedAt: string;
}

export interface ListProductionLeftoversResult {
  referenceDate: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  leftovers: ProductionLeftoverRow[];
  totalLeftover: number;
}

type ProductionLeftoverDbRow = {
  id: string;
  planning_key: string;
  product_id: string;
  production_date: string;
  planned_quantity: number | string | null;
  produced_quantity: number | string | null;
  leftover_quantity: number | string | null;
  reported_produced_quantity?: number | string | null;
  unit: string | null;
  recorded_at: string;
};

const LEFTOVER_BASE_COLUMNS =
  "id, planning_key, product_id, production_date, planned_quantity, produced_quantity, leftover_quantity, unit, recorded_at";
const LEFTOVER_COLUMNS_WITH_REPORTED = `${LEFTOVER_BASE_COLUMNS}, reported_produced_quantity`;

function isMissingProductionLeftoversSchema(
  error: { message: string; code?: string | null } | null | undefined,
) {
  return isSupabaseMissingSchemaError(error, ["production_leftovers"]);
}

/**
 * Coluna nova (migration de 24/07) ainda não aplicada. Precisa ser checada ANTES
 * de `isMissingProductionLeftoversSchema`: o erro de coluna do PostgREST cita a
 * tabela também, então a ordem inversa classificaria errado.
 */
function isMissingReportedQuantityColumn(
  error: { message: string; code?: string | null } | null | undefined,
) {
  return isSupabaseMissingSchemaError(error, ["reported_produced_quantity"]);
}

function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

/** Quantidade informada só vale se for número finito e não-negativo. */
function normalizeReportedQuantity(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? roundQuantity(value)
    : null;
}

export interface ProductionLeftoverCalculationInput {
  /** Plano de batidas do item de OP (`batchSizes`), na unidade de venda. */
  batchSizes: number[];
  /** Quantidade informada pelo operador na conclusão. Ausente = usar a estimativa. */
  reportedProducedQuantity?: number | null;
}

export interface ProductionLeftoverCalculation {
  plannedQuantity: number;
  producedQuantity: number;
  /** produced - planned. Positivo = sobra, negativo = falta. */
  leftoverQuantity: number;
  isReported: boolean;
}

/**
 * Calcula planejado × produzido × sobra/falta de um item de OP concluído.
 *
 * planejado  = soma dos tamanhos das batidas (a necessidade real vinda dos pedidos).
 * produzido  = a quantidade INFORMADA pelo operador quando ela existe; senão a
 *              ESTIMATIVA do plano: quando a produção é batida (mais de uma batida),
 *              a padaria assa FORMAS INTEIRAS — sai do forno a capacidade cheia ×
 *              nº de batidas. Com uma única batida não há arredondamento
 *              (produzido = planejado).
 * sobra      = produzido - planejado. Positivo = sobra, NEGATIVO = falta (só
 *              alcançável com quantidade informada — a estimativa nunca é menor
 *              que o planejado).
 */
export function calculateProductionLeftover(
  input: ProductionLeftoverCalculationInput,
): ProductionLeftoverCalculation {
  const batchSizes = (input.batchSizes ?? []).filter((size) => Number.isFinite(size));
  const plannedQuantity = roundQuantity(batchSizes.reduce((sum, size) => sum + size, 0));
  const fullBatchSize = batchSizes[0] ?? 0;
  const estimatedQuantity =
    batchSizes.length > 1 ? roundQuantity(fullBatchSize * batchSizes.length) : plannedQuantity;

  const reportedQuantity = normalizeReportedQuantity(input.reportedProducedQuantity);
  const producedQuantity = reportedQuantity ?? estimatedQuantity;

  return {
    plannedQuantity,
    producedQuantity,
    leftoverQuantity: roundQuantity(producedQuantity - plannedQuantity),
    isReported: reportedQuantity !== null,
  };
}

function addDays(isoDate: string, delta: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * Registra UM snapshot de sobra/falta para um item de OP que acabou de atingir
 * `concluido`. Idempotente: `onConflict: tenant_id,planning_key` + ignoreDuplicates
 * garante um único registro por item — chamadas repetidas (re-render, conclusão
 * idempotente) não duplicam.
 *
 * REGISTRO INTERNO — não realimenta planejamento nem compensa pedido futuro.
 *
 * Falha silenciosamente quando a migração ainda não foi aplicada para não
 * quebrar o fluxo de produção (mesmo padrão de production_order_events).
 */
export async function recordProductionLeftover(
  input: RecordProductionLeftoverInput,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<void> {
  const recordedByDatabaseId = await resolveProfileDatabaseId(
    supabase,
    input.recordedByProfileId ?? null,
    { tenantId: input.tenantId },
  );

  const leftoverQuantity = roundQuantity(input.producedQuantity - input.plannedQuantity);
  const reportedProducedQuantity = normalizeReportedQuantity(input.reportedProducedQuantity);

  const basePayload = {
    tenant_id: input.tenantId,
    planning_key: input.planningKey,
    product_id: input.productId,
    production_date: input.productionDate,
    planned_quantity: roundQuantity(input.plannedQuantity),
    produced_quantity: roundQuantity(input.producedQuantity),
    leftover_quantity: leftoverQuantity,
    unit: input.unit,
    recorded_by_profile_id: recordedByDatabaseId,
  };
  // `ignoreDuplicates: false` → a reconclusão SOBRESCREVE. Enquanto o produzido era sempre
  // a estimativa, DO NOTHING bastava (o valor era determinístico e não havia o que
  // corrigir). Agora o operador digita: desfazer a batida e reconcluir com o número certo
  // é um caminho real da mesma tela, e descartar em silêncio deixaria o valor errado
  // gravado enquanto a tela diz que salvou.
  const upsertOptions = { onConflict: "tenant_id,planning_key", ignoreDuplicates: false } as const;

  let result = await supabase
    .from("production_leftovers")
    .upsert(
      reportedProducedQuantity === null
        ? basePayload
        : { ...basePayload, reported_produced_quantity: reportedProducedQuantity },
      upsertOptions,
    );

  // Degradação defensiva por COLUNA (migration de 24/07 ainda não aplicada):
  // regrava sem a coluna de auditoria em vez de perder o registro inteiro. As
  // quantidades reais já viajam em produced/leftover, então o relatório continua
  // correto — perde-se só o "informado × estimado".
  if (
    result.error &&
    reportedProducedQuantity !== null &&
    isMissingReportedQuantityColumn(result.error)
  ) {
    console.warn(
      "[production-leftovers] coluna reported_produced_quantity ausente — gravando sem ela:",
      input.planningKey,
    );
    result = await supabase.from("production_leftovers").upsert(basePayload, upsertOptions);
  }

  if (result.error) {
    if (isMissingProductionLeftoversSchema(result.error)) {
      console.warn(
        "[production-leftovers] tabela ausente — registro descartado:",
        input.planningKey,
      );
      return;
    }
    throw new Error(`Failed to record production leftover: ${result.error.message}`);
  }
}

/**
 * Lista as sobras/faltas registradas dentro de uma janela de datas de produção.
 * Devolve lista vazia quando a migração ainda não foi aplicada.
 */
export async function listProductionLeftovers(
  options: {
    tenantId?: string | null;
    referenceDate: string;
    windowDays?: number;
    productNamesById?: Map<string, string>;
  },
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<ListProductionLeftoversResult> {
  const tenantId = assertTenantId(options.tenantId);
  const windowDays =
    Number.isFinite(options.windowDays) && Number(options.windowDays) > 0
      ? Math.trunc(Number(options.windowDays))
      : 7;
  // Janela para TRÁS: sobra/falta só existe para produção CONCLUÍDA, e a trava de data
  // futura impede concluir adiante — olhar para a frente fazia a tela mostrar praticamente
  // só o dia de hoje, e a falta registrada sumia na virada da meia-noite. "Últimos N dias"
  // é o que os rótulos da tela (7/14/30/90) sempre prometeram.
  const referenceDate = options.referenceDate;
  const windowStart = addDays(referenceDate, -(windowDays - 1));
  const windowEnd = referenceDate;

  const runQuery = (columns: string) =>
    supabase
      .from("production_leftovers")
      .select(columns)
      .eq("tenant_id", tenantId)
      .gte("production_date", windowStart)
      .lte("production_date", windowEnd)
      .order("production_date", { ascending: false });

  let result = await runQuery(LEFTOVER_COLUMNS_WITH_REPORTED);

  // Mesma degradação defensiva do write: sem a migration de 24/07 o relatório
  // continua abrindo, apenas sem distinguir "informado" de "estimado".
  if (result.error && isMissingReportedQuantityColumn(result.error)) {
    console.warn(
      "[production-leftovers] coluna reported_produced_quantity ausente — relatório sem a origem da quantidade.",
    );
    result = await runQuery(LEFTOVER_BASE_COLUMNS);
  }

  if (isMissingProductionLeftoversSchema(result.error)) {
    return {
      referenceDate,
      windowDays,
      windowStart,
      windowEnd,
      leftovers: [],
      totalLeftover: 0,
    };
  }

  if (result.error) {
    throw new Error(`Failed to list production leftovers: ${result.error.message}`);
  }

  const rows = (result.data ?? []) as unknown as ProductionLeftoverDbRow[];
  const productNames = options.productNamesById ?? new Map<string, string>();

  const leftovers: ProductionLeftoverRow[] = rows.map((row) => ({
    id: row.id,
    planningKey: row.planning_key,
    productId: row.product_id,
    productName: productNames.get(row.product_id) ?? row.product_id,
    productionDate: row.production_date,
    plannedQuantity: Number(row.planned_quantity ?? 0),
    producedQuantity: Number(row.produced_quantity ?? 0),
    leftoverQuantity: Number(row.leftover_quantity ?? 0),
    isReported: row.reported_produced_quantity !== null && row.reported_produced_quantity !== undefined,
    unit: row.unit ?? "Kg",
    recordedAt: row.recorded_at,
  }));

  const totalLeftover = Number(
    leftovers.reduce((sum, row) => sum + row.leftoverQuantity, 0).toFixed(3),
  );

  return {
    referenceDate,
    windowDays,
    windowStart,
    windowEnd,
    leftovers,
    totalLeftover,
  };
}
