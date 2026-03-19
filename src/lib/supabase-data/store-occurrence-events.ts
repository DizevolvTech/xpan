import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isSupabaseMissingSchemaError,
  isUuid,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

export interface StoreOccurrenceEventEntry {
  id: string;
  occurrenceId: string;
  type: string;
  content: string;
  createdAt: string;
  actorName: string | null;
}

async function resolveOccurrenceDatabaseId(
  occurrenceId: string,
  supabase: SupabaseDataClient,
) {
  const query = supabase.from("store_occurrences").select("id");
  const result = await (isUuid(occurrenceId) ? query.eq("id", occurrenceId) : query.eq("legacy_id", occurrenceId)).maybeSingle();
  const row = assertSupabaseResult(
    { data: result.data, error: result.error },
    "Failed to resolve store occurrence for events",
  );

  return row.id;
}

export async function appendStoreOccurrenceEvent(
  input: {
    occurrenceId: string;
    type: string;
    content: string;
    createdByProfileId?: string | null;
    metadata?: unknown;
  },
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
) {
  const createdByProfileDatabaseId = await resolveProfileDatabaseId(
    supabase,
    input.createdByProfileId ?? null,
  );

  let occurrenceDatabaseId: string;
  try {
    occurrenceDatabaseId = await resolveOccurrenceDatabaseId(input.occurrenceId, supabase);
  } catch {
    return;
  }

  const insertResult = await supabase.from("store_occurrence_events").insert({
    occurrence_id: occurrenceDatabaseId,
    event_type: input.type,
    content: input.content,
    metadata: input.metadata ?? {},
    created_by_profile_id: createdByProfileDatabaseId,
  });

  if (isSupabaseMissingSchemaError(insertResult.error, ["store_occurrence_events"])) {
    return;
  }

  if (insertResult.error) {
    throw new Error(`Failed to append store occurrence event: ${insertResult.error.message}`);
  }
}

export async function listStoreOccurrenceEvents(
  occurrenceId: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<StoreOccurrenceEventEntry[]> {
  const occurrenceDatabaseId = await resolveOccurrenceDatabaseId(occurrenceId, supabase);
  const [eventsResult, profilesResult, occurrenceRowsResult] = await Promise.all([
    supabase
      .from("store_occurrence_events")
      .select("id, occurrence_id, event_type, content, created_at, created_by_profile_id")
      .eq("occurrence_id", occurrenceDatabaseId)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, name"),
    supabase.from("store_occurrences").select("id, legacy_id"),
  ]);

  if (isSupabaseMissingSchemaError(eventsResult.error, ["store_occurrence_events"])) {
    return [];
  }

  const eventRows = assertSupabaseResult(eventsResult, "Failed to load store occurrence events");
  const profileRows = assertSupabaseResult(profilesResult, "Failed to load profiles for occurrence events");
  const occurrenceRows = assertSupabaseResult(
    occurrenceRowsResult,
    "Failed to load occurrence ids for occurrence events",
  );
  const profileNameById = new Map(profileRows.map((row) => [row.id, row.name]));
  const occurrenceLegacyById = new Map(occurrenceRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  return eventRows.map((row) => ({
    id: row.id,
    occurrenceId: occurrenceLegacyById.get(row.occurrence_id) ?? row.occurrence_id,
    type: row.event_type,
    content: row.content,
    createdAt: row.created_at,
    actorName: row.created_by_profile_id ? profileNameById.get(row.created_by_profile_id) ?? null : null,
  }));
}
