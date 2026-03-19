import "server-only";

import {
  areAllChecklistItemsChecked,
  canTransitionDeliveryStatus,
  isOrderReadyForDeliveryExecution,
  resolveEffectiveDeliveryExecutionStatus,
  type DeliveryChecklistState,
  type DeliveryExecutionStatus,
} from "@/lib/delivery-workflow";
import { aggregateExpeditionItems, getAggregatedExpeditionItemKey } from "@/lib/expedition-aggregation";
import { getCachedServerData } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { appendStoreOrderEvent } from "@/lib/supabase-data/store-order-events";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";
import {
  assertSupabaseResult,
  isSupabaseMissingSchemaError,
  isUuid,
  resolveOptionalSupabaseResult,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface PersistedDeliveryExecutionEntry {
  status: DeliveryExecutionStatus;
  checklistState: DeliveryChecklistState;
  checklistCompletedAt: string | null;
  updatedAt: string;
}

export type PersistedDeliveryExecutionState = Record<string, PersistedDeliveryExecutionEntry>;
const DELIVERY_EXECUTION_CACHE_TTL_MS = 10_000;

type LegacyDeliveryExecutionRow = {
  order_id: string;
  status: DeliveryExecutionStatus;
  updated_at: string;
};

type DeliveryOrderRow = {
  id: string;
  legacy_id: string | null;
  code: string;
  delivery_date: string;
};

export async function resolveOrderDeliveryExecutionContext(
  orderId: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const orderQuery = supabase
    .from("store_orders")
    .select("id, legacy_id, code, delivery_date");
  const orderResult = await (isUuid(orderId)
    ? orderQuery.eq("id", orderId)
    : orderQuery.eq("legacy_id", orderId)).maybeSingle();
  const orderRow = assertSupabaseResult(
    { data: orderResult.data, error: orderResult.error },
    "Failed to resolve order for delivery execution",
  ) as DeliveryOrderRow;
  const orderKey = orderRow.legacy_id ?? orderRow.id;
  const planning = await getFactoryPlanningSnapshot(orderRow.delivery_date, {
    supabase,
    includeProfileNames: false,
  });
  const planningOrder = planning.orders.find((item) => item.id === orderKey);
  const expedition = planning.expedition.find((item) => item.orderId === orderKey) ?? null;

  return {
    orderKey,
    orderRow,
    orderStatus: planningOrder?.status ?? "em_espera",
    expedition,
  };
}

function buildChecklistItemKeys(
  expedition: Awaited<ReturnType<typeof resolveOrderDeliveryExecutionContext>>["expedition"],
) {
  if (!expedition) {
    return [];
  }

  return aggregateExpeditionItems(expedition.items).map((item) =>
    getAggregatedExpeditionItemKey({
      productId: item.productId,
      requestedUnit: item.requestedUnit,
      expeditionUnit: item.expeditionUnit,
    }),
  );
}

async function loadLegacyExecutionRows(
  supabase: SupabaseDataClient,
): Promise<LegacyDeliveryExecutionRow[]> {
  const legacyRowsResult = await supabase
    .from("delivery_executions")
    .select("order_id, status, updated_at");

  return assertSupabaseResult(
    legacyRowsResult as {
      data: LegacyDeliveryExecutionRow[] | null;
      error: { message: string } | null;
    },
    "Failed to load legacy delivery executions",
  );
}

function isMissingDeliveryExecutionSchema(error: { message: string; code?: string | null } | null | undefined) {
  return isSupabaseMissingSchemaError(error, [
    "delivery_executions",
    "checklist_state",
    "checklist_completed_at",
  ]);
}

export async function getPersistedDeliveryExecutions(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<PersistedDeliveryExecutionState> {
  return getCachedServerData("delivery-executions:all", DELIVERY_EXECUTION_CACHE_TTL_MS, async () => {
    const [executionRowsResult, orderRowsResult] = await Promise.all([
      supabase.from("delivery_executions").select("order_id, status, checklist_state, checklist_completed_at, updated_at"),
      supabase.from("store_orders").select("id, legacy_id"),
    ]);

    const orderRows = assertSupabaseResult(orderRowsResult, "Failed to load order ids for delivery executions");
    const executionRows = isMissingDeliveryExecutionSchema(executionRowsResult.error)
      ? await loadLegacyExecutionRows(supabase)
      : assertSupabaseResult(executionRowsResult, "Failed to load delivery executions");
    const orderLegacyById = new Map(orderRows.map((row) => [row.id, row.legacy_id ?? row.id]));

    return executionRows.reduce<PersistedDeliveryExecutionState>((acc, row) => {
      const key = orderLegacyById.get(row.order_id) ?? row.order_id;
      acc[key] = {
        status: row.status,
        checklistState:
          "checklist_state" in row ? ((row.checklist_state as DeliveryChecklistState | null) ?? {}) : {},
        checklistCompletedAt:
          "checklist_completed_at" in row ? (row.checklist_completed_at ?? null) : null,
        updatedAt: row.updated_at,
      };
      return acc;
    }, {});
  });
}

export async function updateDeliveryExecution(
  orderId: string,
  status: DeliveryExecutionStatus,
  options: {
    checklistState?: DeliveryChecklistState;
    checklistCompletedAt?: string | null;
  } = {},
  updatedByProfileId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const updatedByDatabaseId = await resolveProfileDatabaseId(supabase, updatedByProfileId ?? null);
  const { orderRow, orderStatus, expedition } = await resolveOrderDeliveryExecutionContext(orderId, supabase);

  if (!isOrderReadyForDeliveryExecution(orderStatus)) {
    throw new Error("O pedido ainda não está pronto para expedição.");
  }

  const currentExecutionResult = await supabase
    .from("delivery_executions")
    .select("status, checklist_state, checklist_completed_at")
    .eq("order_id", orderRow.id)
    .maybeSingle();
  const usingLegacyDeliverySchema = isMissingDeliveryExecutionSchema(currentExecutionResult.error);
  const currentModernExecution = usingLegacyDeliverySchema
    ? null
    : resolveOptionalSupabaseResult(
        { data: currentExecutionResult.data, error: currentExecutionResult.error },
        "Failed to resolve current delivery execution",
      );
  const currentLegacyExecutionResult = usingLegacyDeliverySchema
    ? await supabase
        .from("delivery_executions")
        .select("status")
        .eq("order_id", orderRow.id)
        .maybeSingle()
    : null;
  const currentLegacyExecution = currentLegacyExecutionResult
    ? resolveOptionalSupabaseResult(
        {
          data: currentLegacyExecutionResult.data,
          error: currentLegacyExecutionResult.error,
        },
        "Failed to resolve current legacy delivery execution",
      )
    : null;
  const resolvedCurrentExecution = usingLegacyDeliverySchema ? currentLegacyExecution : currentModernExecution;
  const currentStatus = resolveEffectiveDeliveryExecutionStatus(orderStatus, resolvedCurrentExecution?.status);

  if (!canTransitionDeliveryStatus(currentStatus, status)) {
    throw new Error("Invalid delivery status transition");
  }

  const checklistState =
    options.checklistState ??
    (usingLegacyDeliverySchema
      ? {}
      : ((currentModernExecution?.checklist_state as DeliveryChecklistState | null) ?? {}));
  const checklistCompletedAt =
    options.checklistCompletedAt ??
    (usingLegacyDeliverySchema ? null : (currentModernExecution?.checklist_completed_at ?? null));
  const checklistItemKeys = buildChecklistItemKeys(expedition);
  const checklistIsComplete = usingLegacyDeliverySchema
    ? currentStatus !== "aguardando_expedicao"
    : areAllChecklistItemsChecked(checklistItemKeys, checklistState);

  if (status !== "aguardando_expedicao" && !checklistIsComplete) {
    throw new Error("Conclua o checklist de todos os itens antes de avançar para entrega.");
  }

  const upsertPayload = usingLegacyDeliverySchema
    ? {
        order_id: orderRow.id,
        status,
        updated_at: new Date().toISOString(),
        updated_by_profile_id: updatedByDatabaseId,
      }
    : {
        order_id: orderRow.id,
        status,
        checklist_state: checklistState,
        checklist_completed_at:
          status === "pronto_coleta"
            ? checklistCompletedAt ?? new Date().toISOString()
            : checklistCompletedAt,
        updated_at: new Date().toISOString(),
        updated_by_profile_id: updatedByDatabaseId,
      };
  const upsertResult = await supabase.from("delivery_executions").upsert(upsertPayload, {
    onConflict: "order_id",
  });

  if (upsertResult.error) {
    if (isMissingDeliveryExecutionSchema(upsertResult.error)) {
      throw new Error("O banco ainda nao tem a estrutura completa de expedicao aplicada.");
    }
    throw new Error(`Failed to update delivery execution: ${upsertResult.error.message}`);
  }

  const deliveryLabels: Record<DeliveryExecutionStatus, string> = {
    aguardando_expedicao: "Aguardando expedição",
    pronto_coleta: "Pronto para coleta",
    em_rota: "Em rota",
    no_destino: "No destino",
    entregue: "Entregue",
    tentativa_falha: "Tentativa de entrega falhou",
  };

  await appendStoreOrderEvent(
    {
      orderId: orderRow.id,
      type: "entrega_status",
      title: "Entrega atualizada",
      description: `O pedido mudou para "${deliveryLabels[status]}".`,
      createdByProfileId: updatedByProfileId ?? null,
      metadata: {
        status,
        checklistCompletedAt,
      },
    },
    supabase,
  );
}
