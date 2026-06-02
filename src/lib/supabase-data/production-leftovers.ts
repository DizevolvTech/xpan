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
  unit: string | null;
  recorded_at: string;
};

function isMissingProductionLeftoversSchema(
  error: { message: string; code?: string | null } | null | undefined,
) {
  return isSupabaseMissingSchemaError(error, ["production_leftovers"]);
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
 * REGISTRAR + RELATAR APENAS — não realimenta planejamento.
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

  const leftoverQuantity =
    Math.round((input.producedQuantity - input.plannedQuantity) * 1000) / 1000;

  const result = await supabase.from("production_leftovers").upsert(
    {
      tenant_id: input.tenantId,
      planning_key: input.planningKey,
      product_id: input.productId,
      production_date: input.productionDate,
      planned_quantity: Math.round(input.plannedQuantity * 1000) / 1000,
      produced_quantity: Math.round(input.producedQuantity * 1000) / 1000,
      leftover_quantity: leftoverQuantity,
      unit: input.unit,
      recorded_by_profile_id: recordedByDatabaseId,
    },
    { onConflict: "tenant_id,planning_key", ignoreDuplicates: true },
  );

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
  const referenceDate = options.referenceDate;
  const windowStart = referenceDate;
  const windowEnd = addDays(referenceDate, windowDays - 1);

  const result = await supabase
    .from("production_leftovers")
    .select(
      "id, planning_key, product_id, production_date, planned_quantity, produced_quantity, leftover_quantity, unit, recorded_at",
    )
    .eq("tenant_id", tenantId)
    .gte("production_date", windowStart)
    .lte("production_date", windowEnd)
    .order("production_date", { ascending: false });

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

  const rows = (result.data ?? []) as ProductionLeftoverDbRow[];
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
