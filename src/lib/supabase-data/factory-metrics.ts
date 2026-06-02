import "server-only";

import { applyFactoryWorkflowState } from "@/lib/factory-workflow-logic";
import { buildFactoryPlanningData } from "@/lib/order-planning";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertTenantId,
  isSupabaseMissingSchemaError,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import { buildFactoryInputFromDb } from "@/lib/supabase-data/store-orders";
import { getPersistedWorkflowState } from "@/lib/supabase-data/workflow";

export interface FactoryMetricsInput {
  referenceDate: string;
  windowDays?: number;
  tenantId: string | null | undefined;
}

export interface LeadTimePerStage {
  stage: string;
  averageMinutes: number;
  samples: number;
}

export interface LineOccupancy {
  lineId: string;
  lineName: string;
  capacityKg: number;
  scheduledKg: number;
  occupancyPercent: number;
}

export interface DeliveryFailureBreakdown {
  reason: string;
  count: number;
}

export interface FactoryMetricsResult {
  referenceDate: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  leadTime: {
    averageTotalMinutes: number;
    perStage: LeadTimePerStage[];
    samples: number;
  };
  otif: {
    deliveredOnTime: number;
    deliveredLate: number;
    pending: number;
    otifPercent: number;
  };
  occupancy: {
    lines: LineOccupancy[];
    averageOccupancyPercent: number;
    busiestLine: LineOccupancy | null;
  };
  deliveryFailures: {
    total: number;
    breakdown: DeliveryFailureBreakdown[];
  };
}

const STAGE_ORDER = [
  "nao_iniciado",
  "em_preparacao",
  "em_producao",
  "em_forno",
  "embalando",
  "concluido",
] as const;

function addDays(isoDate: string, delta: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function diffMinutes(toIso: string, fromIso: string): number {
  return Math.max(0, (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);
}

interface EventRow {
  production_item_key: string | null;
  status_to: string | null;
  status_from: string | null;
  created_at: string;
}

async function loadProductionEventsForWindow(
  supabase: SupabaseDataClient,
  tenantId: string,
  windowStart: string,
  windowEnd: string,
): Promise<EventRow[]> {
  const result = await supabase
    .from("production_order_events")
    .select("production_item_key, status_to, status_from, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", `${windowStart}T00:00:00Z`)
    .lt("created_at", `${addDays(windowEnd, 1)}T00:00:00Z`)
    .order("created_at", { ascending: true });

  if (isSupabaseMissingSchemaError(result.error, ["production_order_events"])) {
    return [];
  }
  if (result.error) {
    throw new Error(`Failed to load production events: ${result.error.message}`);
  }
  return (result.data ?? []) as EventRow[];
}

interface DeliveryAttemptRow {
  failure_reason: string;
  failed_at: string;
}

async function loadDeliveryAttemptsForWindow(
  supabase: SupabaseDataClient,
  tenantId: string,
  windowStart: string,
  windowEnd: string,
): Promise<DeliveryAttemptRow[]> {
  const result = await supabase
    .from("delivery_attempts")
    .select("failure_reason, failed_at")
    .eq("tenant_id", tenantId)
    .gte("failed_at", `${windowStart}T00:00:00Z`)
    .lt("failed_at", `${addDays(windowEnd, 1)}T00:00:00Z`);

  if (isSupabaseMissingSchemaError(result.error, ["delivery_attempts"])) {
    return [];
  }
  if (result.error) {
    throw new Error(`Failed to load delivery attempts: ${result.error.message}`);
  }
  return (result.data ?? []) as DeliveryAttemptRow[];
}

interface DeliveryExecutionRow {
  order_id: string;
  status: string;
  updated_at: string;
  store_orders: { delivery_date: string | null } | null;
}

async function loadDeliveryExecutionsForWindow(
  supabase: SupabaseDataClient,
  tenantId: string,
  windowStart: string,
  windowEnd: string,
): Promise<DeliveryExecutionRow[]> {
  const selectCols = "order_id, status, updated_at, store_orders!inner(delivery_date)";

  // União de dois recortes (dedup por order_id), para uma entrega contar tanto
  // pela data PROMETIDA quanto pela data REALIZADA:
  //  A) pedidos cuja delivery_date cai na janela (pendentes / atrasados / no prazo);
  //  B) entregas concluídas na janela (status=entregue, updated_at na janela) —
  //     cobre entregas antecipadas ou para data futura, que A deixava de fora.
  // PostgREST não combina bem `.or()` cruzando tabela embutida, então fazemos
  // duas queries simples em paralelo.
  const [dueResult, deliveredResult] = await Promise.all([
    supabase
      .from("delivery_executions")
      .select(selectCols)
      .eq("tenant_id", tenantId)
      .gte("store_orders.delivery_date", windowStart)
      .lte("store_orders.delivery_date", windowEnd),
    supabase
      .from("delivery_executions")
      .select(selectCols)
      .eq("tenant_id", tenantId)
      .eq("status", "entregue")
      .gte("updated_at", `${windowStart}T00:00:00Z`)
      .lte("updated_at", `${windowEnd}T23:59:59Z`),
  ]);

  for (const result of [dueResult, deliveredResult]) {
    if (isSupabaseMissingSchemaError(result.error, ["delivery_executions"])) {
      return [];
    }
    if (result.error) {
      throw new Error(`Failed to load delivery executions: ${result.error.message}`);
    }
  }

  const byOrder = new Map<string, DeliveryExecutionRow>();
  for (const row of [
    ...((dueResult.data ?? []) as unknown as DeliveryExecutionRow[]),
    ...((deliveredResult.data ?? []) as unknown as DeliveryExecutionRow[]),
  ]) {
    byOrder.set(row.order_id, row);
  }
  return Array.from(byOrder.values());
}

/**
 * AJ-A7: métricas server-side derivadas dos eventos persistidos (A5) +
 * delivery_executions + delivery_attempts + planning runtime.
 *
 * Cálculo on-demand. Em volumes maiores, vale extrair para uma Edge Function
 * com summary table — mas o caminho on-demand é correto para volumes atuais
 * (centenas de OPs/dia × dezenas de eventos/OP).
 */
export async function computeFactoryMetrics(
  input: FactoryMetricsInput,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<FactoryMetricsResult> {
  const tenantId = assertTenantId(input.tenantId);
  const windowDays = Math.max(1, Math.min(90, input.windowDays ?? 7));
  const windowEnd = input.referenceDate;
  const windowStart = addDays(windowEnd, -(windowDays - 1));

  const [factoryInput, events, attempts, executions] = await Promise.all([
    buildFactoryInputFromDb({ supabase, includeProfileNames: false, tenantId }),
    loadProductionEventsForWindow(supabase, tenantId, windowStart, windowEnd),
    loadDeliveryAttemptsForWindow(supabase, tenantId, windowStart, windowEnd),
    loadDeliveryExecutionsForWindow(supabase, tenantId, windowStart, windowEnd),
  ]);

  // -------------------------------------------------------------------------
  // Lead time por estágio: para cada productionItemKey, computa o intervalo
  // de tempo entre status consecutivos. Agrupa por status_to (estágio destino).
  // -------------------------------------------------------------------------
  const eventsByItem = new Map<string, EventRow[]>();
  events.forEach((event) => {
    if (!event.production_item_key) return;
    const list = eventsByItem.get(event.production_item_key) ?? [];
    list.push(event);
    eventsByItem.set(event.production_item_key, list);
  });

  const stageDurations = new Map<string, number[]>();
  const totalDurations: number[] = [];

  eventsByItem.forEach((itemEvents) => {
    const sorted = [...itemEvents].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    let totalMinutes = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (!curr.status_to) continue;
      const duration = diffMinutes(curr.created_at, prev.created_at);
      const list = stageDurations.get(curr.status_to) ?? [];
      list.push(duration);
      stageDurations.set(curr.status_to, list);
      totalMinutes += duration;
    }
    if (sorted.length >= 2) totalDurations.push(totalMinutes);
  });

  const perStage: LeadTimePerStage[] = STAGE_ORDER.map((stage) => {
    const samples = stageDurations.get(stage) ?? [];
    return {
      stage,
      averageMinutes:
        samples.length > 0
          ? Number((samples.reduce((sum, val) => sum + val, 0) / samples.length).toFixed(1))
          : 0,
      samples: samples.length,
    };
  }).filter((row) => row.samples > 0);

  const averageTotalMinutes =
    totalDurations.length > 0
      ? Number(
          (totalDurations.reduce((sum, val) => sum + val, 0) / totalDurations.length).toFixed(1),
        )
      : 0;

  // -------------------------------------------------------------------------
  // OTIF: olha as delivery_executions da janela (união: delivery_date na janela
  // OU entrega concluída na janela — ver loadDeliveryExecutionsForWindow).
  // Em frequência de pedidos por dia ≪ 1000, isso é tranquilo.
  // - on_time: status='entregue' e updated_at <= delivery_date+1d
  // - late: status='entregue' mas atrasou; OU status != 'entregue' depois
  //   de delivery_date+1d
  // - pending: ainda dentro do prazo
  // -------------------------------------------------------------------------
  let deliveredOnTime = 0;
  let deliveredLate = 0;
  let pending = 0;
  const todayMs = new Date(`${input.referenceDate}T00:00:00Z`).getTime();

  executions.forEach((execution) => {
    const deliveryDate = execution.store_orders?.delivery_date;
    if (!deliveryDate) return;
    const deadlineMs = new Date(`${deliveryDate}T23:59:59Z`).getTime();
    const updatedMs = new Date(execution.updated_at).getTime();

    if (execution.status === "entregue") {
      if (updatedMs <= deadlineMs) {
        deliveredOnTime += 1;
      } else {
        deliveredLate += 1;
      }
    } else if (todayMs > deadlineMs) {
      // Já passou do prazo e não foi entregue → atrasado.
      deliveredLate += 1;
    } else {
      pending += 1;
    }
  });

  const considered = deliveredOnTime + deliveredLate;
  const otifPercent = considered > 0 ? Number(((deliveredOnTime / considered) * 100).toFixed(1)) : 0;

  // -------------------------------------------------------------------------
  // Ocupação por linha: planning runtime devolve kg planejados por linha.
  // Capacidade vem de masterData (lines[].capacityPerDayKg). Calculamos a
  // ocupação do referenceDate especificamente — visão "como tá hoje".
  // -------------------------------------------------------------------------
  const basePlanning = buildFactoryPlanningData(input.referenceDate, factoryInput);
  const workflowState = await getPersistedWorkflowState(supabase);
  const planning = applyFactoryWorkflowState(basePlanning, {
    isReleased: (id) => workflowState.releasedOrders.includes(id),
    isCancelled: (id) => workflowState.cancelledOrders.includes(id),
    resolveProductionItemStatus: (itemKey) =>
      itemKey ? workflowState.productionItemStatuses[itemKey] ?? "nao_iniciado" : null,
  });

  const lineNameById = new Map(factoryInput.lines.map((line) => [line.id, line.name]));
  const lineCapacityById = new Map(
    factoryInput.lines.map((line) => [line.id, line.capacityPerDayKg ?? 0]),
  );

  const scheduledKgByLine = new Map<string, number>();
  planning.productionOrders
    .filter((op) => op.productionDate === input.referenceDate)
    .forEach((op) => {
      scheduledKgByLine.set(op.lineId, (scheduledKgByLine.get(op.lineId) ?? 0) + op.totalKg);
    });

  const linesWithLoad: LineOccupancy[] = Array.from(scheduledKgByLine.entries()).map(
    ([lineId, scheduledKg]) => {
      const capacity = lineCapacityById.get(lineId) ?? 0;
      return {
        lineId,
        lineName: lineNameById.get(lineId) ?? lineId,
        capacityKg: capacity,
        scheduledKg: Number(scheduledKg.toFixed(2)),
        occupancyPercent: capacity > 0 ? Number(((scheduledKg / capacity) * 100).toFixed(1)) : 0,
      };
    },
  );

  const averageOccupancyPercent =
    linesWithLoad.length > 0
      ? Number(
          (
            linesWithLoad.reduce((sum, line) => sum + line.occupancyPercent, 0) /
            linesWithLoad.length
          ).toFixed(1),
        )
      : 0;

  const busiestLine =
    linesWithLoad.length > 0
      ? linesWithLoad.reduce((max, line) =>
          line.occupancyPercent > max.occupancyPercent ? line : max,
        )
      : null;

  // -------------------------------------------------------------------------
  // Falhas de entrega: count por motivo no período.
  // -------------------------------------------------------------------------
  const failuresByReason = new Map<string, number>();
  attempts.forEach((attempt) => {
    failuresByReason.set(attempt.failure_reason, (failuresByReason.get(attempt.failure_reason) ?? 0) + 1);
  });
  const failureBreakdown = Array.from(failuresByReason.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    referenceDate: input.referenceDate,
    windowDays,
    windowStart,
    windowEnd,
    leadTime: {
      averageTotalMinutes,
      perStage,
      samples: totalDurations.length,
    },
    otif: {
      deliveredOnTime,
      deliveredLate,
      pending,
      otifPercent,
    },
    occupancy: {
      lines: linesWithLoad.sort((a, b) => b.occupancyPercent - a.occupancyPercent),
      averageOccupancyPercent,
      busiestLine,
    },
    deliveryFailures: {
      total: attempts.length,
      breakdown: failureBreakdown,
    },
  };
}
