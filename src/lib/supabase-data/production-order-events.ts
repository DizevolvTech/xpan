import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertTenantId,
  isSupabaseMissingSchemaError,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export type ProductionOrderEventType =
  | "item_status_changed"
  | "op_released"
  | "op_aborted"
  | "op_note";

export interface AppendProductionOrderEventInput {
  tenantId: string;
  planningKey: string;
  opCodeSnapshot?: string | null;
  eventType: ProductionOrderEventType;
  statusFrom?: string | null;
  statusTo?: string | null;
  productionItemKey?: string | null;
  payload?: Record<string, unknown>;
  createdByProfileId?: string | null;
}

export interface PersistedProductionOrderEvent {
  id: string;
  planningKey: string;
  opCodeSnapshot: string | null;
  eventType: ProductionOrderEventType;
  statusFrom: string | null;
  statusTo: string | null;
  productionItemKey: string | null;
  payload: Record<string, unknown>;
  createdByProfileId: string | null;
  createdAt: string;
}

type ProductionOrderEventRow = {
  id: string;
  planning_key: string;
  op_code_snapshot: string | null;
  event_type: string;
  status_from: string | null;
  status_to: string | null;
  production_item_key: string | null;
  payload: Record<string, unknown> | null;
  created_by_profile_id: string | null;
  created_at: string;
};

function isMissingProductionOrderEventsSchema(
  error: { message: string; code?: string | null } | null | undefined,
) {
  return isSupabaseMissingSchemaError(error, ["production_order_events"]);
}

/**
 * Insere um evento na timeline da OP. Append-only por design — não há
 * update/delete. Falha silenciosamente quando a migração ainda não foi
 * aplicada (ambientes em transição) para não quebrar o fluxo principal.
 */
export async function appendProductionOrderEvent(
  input: AppendProductionOrderEventInput,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<void> {
  const createdByDatabaseId = await resolveProfileDatabaseId(
    supabase,
    input.createdByProfileId ?? null,
  );

  const result = await supabase.from("production_order_events").insert({
    tenant_id: input.tenantId,
    planning_key: input.planningKey,
    op_code_snapshot: input.opCodeSnapshot ?? null,
    event_type: input.eventType,
    status_from: input.statusFrom ?? null,
    status_to: input.statusTo ?? null,
    production_item_key: input.productionItemKey ?? null,
    payload: input.payload ?? {},
    created_by_profile_id: createdByDatabaseId,
  });

  if (result.error) {
    if (isMissingProductionOrderEventsSchema(result.error)) {
      // Migração ainda não aplicada: logamos mas não quebramos o fluxo.
      console.warn(
        "[production-order-events] tabela ausente — evento descartado:",
        input.eventType,
        input.planningKey,
      );
      return;
    }
    throw new Error(`Failed to append production order event: ${result.error.message}`);
  }
}

/**
 * Lista os eventos de uma OP (mais recentes primeiro). Devolve lista vazia
 * quando a migração não foi aplicada ainda.
 */
export async function listProductionOrderEvents(
  options: {
    tenantId: string | null | undefined;
    planningKey: string;
    limit?: number;
  },
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<PersistedProductionOrderEvent[]> {
  const tenantId = assertTenantId(options.tenantId);
  const limit = options.limit ?? 200;

  const result = await supabase
    .from("production_order_events")
    .select(
      "id, planning_key, op_code_snapshot, event_type, status_from, status_to, production_item_key, payload, created_by_profile_id, created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("planning_key", options.planningKey)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isMissingProductionOrderEventsSchema(result.error)) {
    return [];
  }

  if (result.error) {
    throw new Error(`Failed to list production order events: ${result.error.message}`);
  }

  const rows = (result.data ?? []) as ProductionOrderEventRow[];
  return rows.map((row) => ({
    id: row.id,
    planningKey: row.planning_key,
    opCodeSnapshot: row.op_code_snapshot,
    eventType: row.event_type as ProductionOrderEventType,
    statusFrom: row.status_from,
    statusTo: row.status_to,
    productionItemKey: row.production_item_key,
    payload: row.payload ?? {},
    createdByProfileId: row.created_by_profile_id,
    createdAt: row.created_at,
  }));
}
