import "server-only";

import {
  areAllChecklistItemsChecked,
  canRegisterDeliveryFailure,
  canTransitionDeliveryStatus,
  isOrderReadyForDeliveryExecution,
  resolveEffectiveDeliveryExecutionStatus,
  type DeliveryChecklistState,
  type DeliveryExecutionStatus,
} from "@/lib/delivery-workflow";
import { aggregateExpeditionItems, getAggregatedExpeditionItemKey } from "@/lib/expedition-aggregation";
import { assertDeliveryNotInFuture } from "@/lib/workflow-date-guard";
import { getCachedServerData } from "@/lib/server-data-cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { appendStoreOrderEvent } from "@/lib/supabase-data/store-order-events";
import { getFactoryPlanningSnapshot } from "@/lib/supabase-data/planning-snapshot";
import {
  assertSupabaseResult,
  assertTenantId,
  buildTenantCacheKey,
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
  attemptsCount: number;
  lastAttempt: PersistedDeliveryAttempt | null;
  pendingReleaseReason: string | null;
  pendingReleasedAt: string | null;
}

export type DeliveryFailureReason =
  | "cliente_ausente"
  | "endereco_errado"
  | "recusa_cliente"
  | "estabelecimento_fechado"
  | "veiculo_avaria"
  | "acesso_bloqueado"
  | "documentacao_pendente"
  | "outro";

export interface PersistedDeliveryAttempt {
  id: string;
  attemptNumber: number;
  failedAt: string;
  failureReason: DeliveryFailureReason;
  reasonNotes: string | null;
  rescheduleTo: string | null;
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
  tenant_id: string;
  code: string;
  delivery_date: string;
};

export async function resolveOrderDeliveryExecutionContext(
  orderId: string,
  options:
    | {
        tenantId?: string | null;
        supabase?: SupabaseDataClient;
      }
    | SupabaseDataClient = {},
) {
  const resolvedOptions =
    options && typeof options === "object" && "from" in options
      ? { supabase: options as SupabaseDataClient }
      : options;
  const supabase = resolvedOptions.supabase ?? createSupabaseAdminClient();
  const orderQuery = supabase
    .from("store_orders")
    .select("id, legacy_id, tenant_id, code, delivery_date");
  const orderResult = await (isUuid(orderId)
    ? orderQuery.eq("id", orderId)
    : orderQuery.eq("legacy_id", orderId)).maybeSingle();
  const orderRow = assertSupabaseResult(
    { data: orderResult.data, error: orderResult.error },
    "Failed to resolve order for delivery execution",
  ) as DeliveryOrderRow;
  const tenantId = assertTenantId(resolvedOptions.tenantId ?? orderRow.tenant_id);
  const orderKey = orderRow.legacy_id ?? orderRow.id;
  const planning = await getFactoryPlanningSnapshot(orderRow.delivery_date, {
    supabase,
    includeProfileNames: false,
    tenantId,
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

type DeliveryAttemptRow = {
  id: string;
  order_id: string;
  attempt_number: number;
  failed_at: string;
  failure_reason: DeliveryFailureReason;
  reason_notes: string | null;
  reschedule_to: string | null;
};

function isMissingDeliveryAttemptsSchema(
  error: { message: string; code?: string | null } | null | undefined,
) {
  return isSupabaseMissingSchemaError(error, ["delivery_attempts"]);
}

async function loadDeliveryAttemptsByOrderDbId(
  supabase: SupabaseDataClient,
): Promise<Map<string, DeliveryAttemptRow[]>> {
  const result = await supabase
    .from("delivery_attempts")
    .select("id, order_id, attempt_number, failed_at, failure_reason, reason_notes, reschedule_to")
    .order("attempt_number", { ascending: true });

  if (isMissingDeliveryAttemptsSchema(result.error)) {
    return new Map();
  }

  const rows = assertSupabaseResult(
    result as { data: DeliveryAttemptRow[] | null; error: { message: string } | null },
    "Failed to load delivery attempts",
  );

  const map = new Map<string, DeliveryAttemptRow[]>();
  rows.forEach((row) => {
    if (!map.has(row.order_id)) {
      map.set(row.order_id, []);
    }
    map.get(row.order_id)!.push(row);
  });
  return map;
}

export async function getPersistedDeliveryExecutions(
  options: {
    tenantId?: string | null;
    supabase?: SupabaseDataClient;
  } = {},
): Promise<PersistedDeliveryExecutionState> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const tenantId = assertTenantId(options.tenantId);

  return getCachedServerData(
    buildTenantCacheKey(tenantId, "delivery-executions", "all"),
    DELIVERY_EXECUTION_CACHE_TTL_MS,
    async () => {
    const [executionRowsResult, orderRowsResult, attemptsByOrderDbId] = await Promise.all([
      supabase
        .from("delivery_executions")
        .select(
          "order_id, status, checklist_state, checklist_completed_at, updated_at, pending_release_reason, pending_released_at",
        ),
      supabase.from("store_orders").select("id, legacy_id"),
      loadDeliveryAttemptsByOrderDbId(supabase),
    ]);

    const orderRows = assertSupabaseResult(orderRowsResult, "Failed to load order ids for delivery executions");
    const executionRows = isMissingDeliveryExecutionSchema(executionRowsResult.error)
      ? await loadLegacyExecutionRows(supabase)
      : assertSupabaseResult(executionRowsResult, "Failed to load delivery executions");
    const orderLegacyById = new Map(orderRows.map((row) => [row.id, row.legacy_id ?? row.id]));

    return executionRows.reduce<PersistedDeliveryExecutionState>((acc, row) => {
      const key = orderLegacyById.get(row.order_id) ?? row.order_id;
      const attempts = attemptsByOrderDbId.get(row.order_id) ?? [];
      const lastAttemptRow = attempts.at(-1) ?? null;
      acc[key] = {
        status: row.status,
        checklistState:
          "checklist_state" in row ? ((row.checklist_state as DeliveryChecklistState | null) ?? {}) : {},
        checklistCompletedAt:
          "checklist_completed_at" in row ? (row.checklist_completed_at ?? null) : null,
        pendingReleaseReason:
          "pending_release_reason" in row ? (row.pending_release_reason ?? null) : null,
        pendingReleasedAt:
          "pending_released_at" in row ? (row.pending_released_at ?? null) : null,
        updatedAt: row.updated_at,
        attemptsCount: attempts.length,
        lastAttempt: lastAttemptRow
          ? {
              id: lastAttemptRow.id,
              attemptNumber: lastAttemptRow.attempt_number,
              failedAt: lastAttemptRow.failed_at,
              failureReason: lastAttemptRow.failure_reason,
              reasonNotes: lastAttemptRow.reason_notes,
              rescheduleTo: lastAttemptRow.reschedule_to,
            }
          : null,
      };
      return acc;
    }, {});
    },
  );
}

export async function registerDeliveryAttempt(
  orderId: string,
  input: {
    reason: DeliveryFailureReason;
    notes?: string | null;
    rescheduleTo?: string | null;
  },
  recordedByProfileId: string | null | undefined,
  options: { tenantId?: string | null } = {},
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const tenantId = assertTenantId(options.tenantId);
  const recordedByDatabaseId = await resolveProfileDatabaseId(supabase, recordedByProfileId ?? null);
  const { orderRow, orderStatus } = await resolveOrderDeliveryExecutionContext(orderId, {
    tenantId,
    supabase,
  });

  // NÃO bloquear aqui por orderStatus derivado da produção: uma execução de
  // entrega já avançada é a fonte da verdade. O gate correto é
  // `canRegisterDeliveryFailure(currentStatus)` logo abaixo — registrar falha só
  // faz sentido em em_rota/no_destino/tentativa_falha, o que já exclui um pedido
  // que ainda não entrou no fluxo de entrega.
  const currentExecutionResult = await supabase
    .from("delivery_executions")
    .select("status")
    .eq("order_id", orderRow.id)
    .maybeSingle();
  const currentExecution = resolveOptionalSupabaseResult(
    {
      data: currentExecutionResult.data,
      error: isMissingDeliveryExecutionSchema(currentExecutionResult.error)
        ? null
        : currentExecutionResult.error,
    },
    "Failed to resolve current delivery execution",
  );
  const currentStatus = resolveEffectiveDeliveryExecutionStatus(orderStatus, currentExecution?.status);

  if (!canRegisterDeliveryFailure(currentStatus)) {
    throw new Error(
      "Invalid attempt: só é possível registrar tentativa quando a entrega está em rota ou no destino.",
    );
  }

  const nextAttemptResult = await supabase
    .from("delivery_attempts")
    .select("attempt_number")
    .eq("order_id", orderRow.id)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    nextAttemptResult.error &&
    !isMissingDeliveryAttemptsSchema(nextAttemptResult.error)
  ) {
    throw new Error(`Failed to resolve last delivery attempt: ${nextAttemptResult.error.message}`);
  }

  if (isMissingDeliveryAttemptsSchema(nextAttemptResult.error)) {
    throw new Error("O banco ainda não tem a tabela delivery_attempts aplicada.");
  }

  const nextAttemptNumber = (nextAttemptResult.data?.attempt_number ?? 0) + 1;
  const failedAt = new Date().toISOString();

  const insertResult = await supabase.from("delivery_attempts").insert({
    tenant_id: tenantId,
    order_id: orderRow.id,
    attempt_number: nextAttemptNumber,
    failed_at: failedAt,
    failure_reason: input.reason,
    reason_notes: input.notes ?? null,
    reschedule_to: input.rescheduleTo ?? null,
    recorded_by_profile_id: recordedByDatabaseId,
  });

  if (insertResult.error) {
    throw new Error(`Failed to register delivery attempt: ${insertResult.error.message}`);
  }

  // Manter delivery_executions sincronizado: status passa a tentativa_falha.
  // canRegisterDeliveryFailure já garantiu que estamos em em_rota / no_destino.
  const upsertResult = await supabase.from("delivery_executions").upsert(
    {
      order_id: orderRow.id,
      status: "tentativa_falha",
      updated_at: failedAt,
      updated_by_profile_id: recordedByDatabaseId,
    },
    { onConflict: "order_id" },
  );

  if (
    upsertResult.error &&
    !isMissingDeliveryExecutionSchema(upsertResult.error)
  ) {
    throw new Error(`Failed to sync delivery execution: ${upsertResult.error.message}`);
  }

  await appendStoreOrderEvent(
    {
      orderId: orderRow.id,
      type: "entrega_tentativa_falha",
      title: `Tentativa #${nextAttemptNumber} falhou`,
      description: input.notes
        ? `Motivo: ${input.reason}. Observação: ${input.notes}`
        : `Motivo: ${input.reason}.`,
      createdByProfileId: recordedByProfileId ?? null,
      metadata: {
        attemptNumber: nextAttemptNumber,
        failureReason: input.reason,
        rescheduleTo: input.rescheduleTo ?? null,
      },
    },
    supabase,
  );

  return {
    attemptNumber: nextAttemptNumber,
    failedAt,
  };
}

export async function updateDeliveryExecution(
  orderId: string,
  status: DeliveryExecutionStatus,
  options: {
    checklistState?: DeliveryChecklistState;
    checklistCompletedAt?: string | null;
    tenantId?: string | null;
    force?: boolean;
    releaseReason?: string | null;
    // Override de gestor/admin da TRAVA de data futura (separado do `force` de
    // checklist): pula assertDeliveryNotInFuture ao marcar `entregue`.
    forceFutureDate?: boolean;
  } = {},
  updatedByProfileId?: string | null,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const tenantId = assertTenantId(options.tenantId);
  const updatedByDatabaseId = await resolveProfileDatabaseId(supabase, updatedByProfileId ?? null);
  const { orderRow, orderStatus, expedition } = await resolveOrderDeliveryExecutionContext(orderId, {
    tenantId,
    supabase,
  });

  // Trava de DATA FUTURA: não permitir marcar como ENTREGUE antes da data de
  // entrega agendada do pedido. Só o override DEDICADO (`forceFutureDate`, de
  // gestor/admin, autorizado no route) pula a trava — o `force` de checklist NÃO
  // a desliga (concerns separados).
  if (status === "entregue" && !options.forceFutureDate) {
    assertDeliveryNotInFuture(orderRow.delivery_date);
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

  // A produção concluída só é exigida para ENTRAR na entrega (quando ainda não
  // há execução avançada). Uma vez em fluxo (pronto_coleta+), a execução
  // persistida é a fonte da verdade e não pode ser bloqueada por recomputo do
  // status derivado da produção.
  if (currentStatus === "aguardando_expedicao" && !isOrderReadyForDeliveryExecution(orderStatus)) {
    throw new Error("O pedido ainda não está pronto para expedição.");
  }

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

  // O gate do checklist só faz sentido na transição de ENTRADA na entrega
  // (aguardando_expedicao → pronto_coleta). Uma vez liberada, as transições
  // seguintes (em_rota, no_destino, entregue) não devem reexigir o checklist.
  const isEnteringDelivery = currentStatus === "aguardando_expedicao" && status === "pronto_coleta";
  // Liberação com pendência: o gestor/admin pode forçar a entrada na entrega
  // mesmo com checklist incompleto, mas é OBRIGADO a informar um motivo (que fica
  // auditável). A autorização de QUEM pode forçar é responsabilidade da API; aqui
  // apenas validamos o motivo e registramos o override. Nunca confiar em input do
  // cliente para decidir a role.
  const trimmedReleaseReason = options.releaseReason?.trim() ?? "";
  let pendingRelease: {
    reason: string;
    releasedByProfileId: string | null;
    releasedAt: string;
  } | null = null;
  if (isEnteringDelivery && !checklistIsComplete) {
    if (!options.force) {
      throw new Error("Conclua o checklist de todos os itens antes de avançar para entrega.");
    }
    if (!trimmedReleaseReason) {
      throw new Error("Informe o motivo da liberação com itens pendentes.");
    }
    pendingRelease = {
      reason: trimmedReleaseReason,
      releasedByProfileId: updatedByDatabaseId,
      releasedAt: new Date().toISOString(),
    };
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
        ...(pendingRelease
          ? {
              pending_release_reason: pendingRelease.reason,
              pending_released_by_profile_id: pendingRelease.releasedByProfileId,
              pending_released_at: pendingRelease.releasedAt,
            }
          : {}),
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
      title: pendingRelease ? "Entrega liberada com itens pendentes" : "Entrega atualizada",
      description: pendingRelease
        ? `O pedido foi liberado para entrega com itens pendentes no checklist. Motivo: ${pendingRelease.reason}`
        : `O pedido mudou para "${deliveryLabels[status]}".`,
      createdByProfileId: updatedByProfileId ?? null,
      metadata: {
        status,
        checklistCompletedAt,
        ...(pendingRelease
          ? {
              pendingReleaseReason: pendingRelease.reason,
              pendingReleasedAt: pendingRelease.releasedAt,
            }
          : {}),
      },
    },
    supabase,
  );
}
