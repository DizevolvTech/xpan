import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isSupabaseMissingSchemaError,
  isUuid,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface StoreOrderEventEntry {
  id: string;
  orderId: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  actorName: string | null;
}

async function resolveOrderDatabaseId(orderId: string, supabase: SupabaseDataClient) {
  const query = supabase.from("store_orders").select("id");
  const result = await (isUuid(orderId) ? query.eq("id", orderId) : query.eq("legacy_id", orderId)).maybeSingle();
  const row = assertSupabaseResult(
    { data: result.data, error: result.error },
    "Failed to resolve store order for events",
  );

  return row.id;
}

export async function appendStoreOrderEvent(
  input: {
    orderId: string;
    type: string;
    title: string;
    description: string;
    createdByProfileId?: string | null;
    metadata?: unknown;
  },
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const createdByProfileDatabaseId = await resolveProfileDatabaseId(
    supabase,
    input.createdByProfileId ?? null,
  );

  let orderDatabaseId: string;
  try {
    orderDatabaseId = await resolveOrderDatabaseId(input.orderId, supabase);
  } catch {
    return;
  }

  const insertResult = await supabase.from("store_order_events").insert({
    order_id: orderDatabaseId,
    event_type: input.type,
    title: input.title,
    description: input.description,
    metadata: input.metadata ?? {},
    created_by_profile_id: createdByProfileDatabaseId,
  });

  if (isSupabaseMissingSchemaError(insertResult.error, ["store_order_events"])) {
    return;
  }

  if (insertResult.error) {
    throw new Error(`Failed to append store order event: ${insertResult.error.message}`);
  }
}

export async function listStoreOrderEvents(
  orderId: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<StoreOrderEventEntry[]> {
  const orderDatabaseId = await resolveOrderDatabaseId(orderId, supabase);
  const [eventsResult, profilesResult, orderRowsResult] = await Promise.all([
    supabase
      .from("store_order_events")
      .select("id, order_id, event_type, title, description, created_at, created_by_profile_id")
      .eq("order_id", orderDatabaseId)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name"),
    supabase.from("store_orders").select("id, legacy_id"),
  ]);

  if (isSupabaseMissingSchemaError(eventsResult.error, ["store_order_events"])) {
    return [];
  }

  const eventRows = assertSupabaseResult(eventsResult, "Failed to load store order events");
  const profileRows = assertSupabaseResult(profilesResult, "Failed to load profiles for order events");
  const orderRows = assertSupabaseResult(orderRowsResult, "Failed to load order ids for order events");
  const profileNameById = new Map(profileRows.map((row) => [row.id, row.name]));
  const orderLegacyById = new Map(orderRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  return eventRows.map((row) => ({
    id: row.id,
    orderId: orderLegacyById.get(row.order_id) ?? row.order_id,
    type: row.event_type,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    actorName: row.created_by_profile_id ? profileNameById.get(row.created_by_profile_id) ?? null : null,
  }));
}
