import "server-only";

import { roleLabels } from "@/lib/admin-users";
import type { Database } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildTenantSupportStatusEventContent,
  canCommentOnTenantSupportOccurrence,
  canMasterActorUpdateSupportStatus,
  canTenantActorUpdateSupportStatus,
  describeTenantSupportActorSide,
  normalizeTenantSupportOccurrenceDraft,
  type CreateTenantSupportOccurrenceInput,
  type TenantSupportActorSide,
  type TenantSupportOccurrence,
  type TenantSupportOccurrenceDetail,
  type TenantSupportOccurrenceEvent,
  type TenantSupportOccurrenceStatus,
} from "@/lib/tenant-support-occurrences";
import {
  assertSupabaseResult,
  isUuid,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";

type TenantSupportOccurrenceRow =
  Database["public"]["Tables"]["tenant_support_occurrences"]["Row"];
type TenantSupportOccurrenceEventRow =
  Database["public"]["Tables"]["tenant_support_occurrence_events"]["Row"];
type SupportProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "name" | "role"
>;

type QueryOptions = {
  supabase?: SupabaseDataClient;
  tenantId: string;
};

type ActorOptions = QueryOptions & {
  actorSide?: TenantSupportActorSide;
  actorProfileId?: string | null;
};

function mapOccurrenceRow(
  row: TenantSupportOccurrenceRow,
  profileById: Map<string, SupportProfileRow>,
): TenantSupportOccurrence {
  const openedByProfile = row.opened_by_profile_id
    ? profileById.get(row.opened_by_profile_id) ?? null
    : null;

  return {
    id: row.legacy_id ?? row.id,
    tenantId: row.tenant_id,
    code: row.code,
    title: row.title,
    category: row.category,
    priority: row.priority,
    description: row.description,
    status: row.status,
    openedByName: openedByProfile?.name ?? null,
    openedByRoleLabel: openedByProfile ? roleLabels[openedByProfile.role] : null,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildProfileMap(rows: SupportProfileRow[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

async function resolveActorProfileDatabaseId(
  actorProfileId: string | null | undefined,
  actorSide: TenantSupportActorSide | undefined,
  tenantId: string,
  supabase: SupabaseDataClient,
) {
  if (!actorProfileId) {
    return null;
  }

  if (actorSide === "master") {
    return resolveProfileDatabaseId(supabase, actorProfileId, {
      allowMasterProfile: true,
    });
  }

  return resolveProfileDatabaseId(supabase, actorProfileId, {
    tenantId,
  });
}

async function resolveOccurrenceRow(
  occurrenceId: string,
  tenantId: string,
  supabase: SupabaseDataClient,
) {
  const query = supabase
    .from("tenant_support_occurrences")
    .select("*")
    .eq("tenant_id", tenantId);

  const result = await (isUuid(occurrenceId)
    ? query.eq("id", occurrenceId)
    : query.eq("legacy_id", occurrenceId)).maybeSingle();

  if (result.error) {
    throw new Error(
      `Failed to resolve tenant support occurrence: ${result.error.message}`,
    );
  }

  if (!result.data) {
    throw new Error("Occurrence not found");
  }

  return result.data as TenantSupportOccurrenceRow;
}

async function resolveOccurrenceDatabaseId(
  occurrenceId: string,
  tenantId: string,
  supabase: SupabaseDataClient,
) {
  const row = await resolveOccurrenceRow(occurrenceId, tenantId, supabase);
  return row.id;
}

async function listProfilesForTenantSupport(
  tenantId: string,
  supabase: SupabaseDataClient,
) {
  const profilesResult = await supabase
    .from("profiles")
    .select("id, name, role")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

  return assertSupabaseResult(
    profilesResult,
    "Failed to load profiles for support occurrences",
  ) as SupportProfileRow[];
}

function mapOccurrenceEventRows(
  rows: TenantSupportOccurrenceEventRow[],
  occurrenceLegacyById: Map<string, string>,
  profileById: Map<string, SupportProfileRow>,
): TenantSupportOccurrenceEvent[] {
  return rows.map((row) => {
    const actorProfile = row.created_by_profile_id
      ? profileById.get(row.created_by_profile_id) ?? null
      : null;

    return {
      id: row.id,
      occurrenceId:
        occurrenceLegacyById.get(row.occurrence_id) ?? row.occurrence_id,
      type: row.event_type,
      content: row.content,
      createdAt: row.created_at,
      actorName: actorProfile?.name ?? null,
      actorRoleLabel: actorProfile
        ? roleLabels[actorProfile.role]
        : describeTenantSupportActorSide(row.author_scope),
      actorSide: row.author_scope,
    };
  });
}

function assertStatusTransitionAllowed(
  current: TenantSupportOccurrenceStatus,
  next: TenantSupportOccurrenceStatus,
  actorSide: TenantSupportActorSide,
) {
  if (actorSide === "master" || actorSide === "sistema") {
    if (!canMasterActorUpdateSupportStatus(current, next)) {
      throw new Error("Status transition is not allowed");
    }
    return;
  }

  if (!canTenantActorUpdateSupportStatus(current, next)) {
    throw new Error(
      "O cliente só pode reabrir um chamado ou confirmar o fechamento após a resolução.",
    );
  }
}

export async function listTenantSupportOccurrences(
  options: QueryOptions,
): Promise<TenantSupportOccurrence[]> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const [occurrencesResult, profiles] = await Promise.all([
    supabase
      .from("tenant_support_occurrences")
      .select("*")
      .eq("tenant_id", options.tenantId)
      .order("updated_at", { ascending: false }),
    listProfilesForTenantSupport(options.tenantId, supabase),
  ]);

  const rows = assertSupabaseResult(
    occurrencesResult,
    "Failed to load tenant support occurrences",
  ) as TenantSupportOccurrenceRow[];
  const profileById = buildProfileMap(profiles);

  return rows.map((row) => mapOccurrenceRow(row, profileById));
}

export async function getTenantSupportOccurrenceDetail(
  occurrenceId: string,
  options: QueryOptions,
): Promise<TenantSupportOccurrenceDetail> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const occurrenceRow = await resolveOccurrenceRow(
    occurrenceId,
    options.tenantId,
    supabase,
  );

  const [profiles, eventsResult, occurrenceRowsResult] = await Promise.all([
    listProfilesForTenantSupport(options.tenantId, supabase),
    supabase
      .from("tenant_support_occurrence_events")
      .select("*")
      .eq("tenant_id", options.tenantId)
      .eq("occurrence_id", occurrenceRow.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tenant_support_occurrences")
      .select("id, legacy_id")
      .eq("tenant_id", options.tenantId),
  ]);

  const eventRows = assertSupabaseResult(
    eventsResult,
    "Failed to load support occurrence events",
  ) as TenantSupportOccurrenceEventRow[];
  const occurrenceRows = assertSupabaseResult(
    occurrenceRowsResult,
    "Failed to load support occurrence ids",
  ) as Array<Pick<TenantSupportOccurrenceRow, "id" | "legacy_id">>;
  const profileById = buildProfileMap(profiles);
  const occurrenceLegacyById = new Map(
    occurrenceRows.map((row) => [row.id, row.legacy_id ?? row.id]),
  );

  return {
    ...mapOccurrenceRow(occurrenceRow, profileById),
    canComment: canCommentOnTenantSupportOccurrence(occurrenceRow.status),
    events: mapOccurrenceEventRows(
      eventRows,
      occurrenceLegacyById,
      profileById,
    ),
  };
}

export async function createTenantSupportOccurrence(
  input: CreateTenantSupportOccurrenceInput,
  options: ActorOptions,
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const normalizedInput = normalizeTenantSupportOccurrenceDraft(input);
  const actorSide = options.actorSide ?? "cliente";
  const createdByProfileId = await resolveActorProfileDatabaseId(
    options.actorProfileId,
    actorSide,
    options.tenantId,
    supabase,
  );

  const occurrenceInsertResult = await supabase
    .from("tenant_support_occurrences")
    .insert({
      legacy_id: `support-occurrence-${crypto.randomUUID()}`,
      tenant_id: options.tenantId,
      code: `SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      title: normalizedInput.title,
      category: normalizedInput.category,
      priority: normalizedInput.priority,
      description: normalizedInput.description,
      opened_by_profile_id: createdByProfileId,
      last_message_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  const occurrenceRow = assertSupabaseResult(
    occurrenceInsertResult,
    "Failed to create tenant support occurrence",
  ) as TenantSupportOccurrenceRow;

  const eventInsertResult = await supabase
    .from("tenant_support_occurrence_events")
    .insert({
      tenant_id: options.tenantId,
      occurrence_id: occurrenceRow.id,
      event_type: "abertura",
      author_scope: actorSide,
      content: normalizedInput.description,
      created_by_profile_id: createdByProfileId,
    });

  if (eventInsertResult.error) {
    throw new Error(
      `Failed to create support occurrence event: ${eventInsertResult.error.message}`,
    );
  }

  return getTenantSupportOccurrenceDetail(occurrenceRow.id, {
    supabase,
    tenantId: options.tenantId,
  });
}

export async function updateTenantSupportOccurrenceStatus(
  occurrenceId: string,
  status: TenantSupportOccurrenceStatus,
  options: ActorOptions,
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const actorSide = options.actorSide ?? "cliente";
  const occurrenceRow = await resolveOccurrenceRow(
    occurrenceId,
    options.tenantId,
    supabase,
  );

  assertStatusTransitionAllowed(occurrenceRow.status, status, actorSide);

  const now = new Date().toISOString();
  const createdByProfileId = await resolveActorProfileDatabaseId(
    options.actorProfileId,
    actorSide,
    options.tenantId,
    supabase,
  );

  const updateResult = await supabase
    .from("tenant_support_occurrences")
    .update({
      status,
      last_message_at: now,
      resolved_at: status === "resolvida" ? now : occurrenceRow.resolved_at,
      closed_at: status === "fechada" ? now : status === "aberta" ? null : occurrenceRow.closed_at,
      updated_at: now,
    })
    .eq("id", occurrenceRow.id)
    .eq("tenant_id", options.tenantId)
    .select("id")
    .single();

  assertSupabaseResult(updateResult, "Failed to update support occurrence status");

  const eventInsertResult = await supabase
    .from("tenant_support_occurrence_events")
    .insert({
      tenant_id: options.tenantId,
      occurrence_id: occurrenceRow.id,
      event_type: "status",
      author_scope: actorSide,
      content: buildTenantSupportStatusEventContent(status),
      created_by_profile_id: createdByProfileId,
    });

  if (eventInsertResult.error) {
    throw new Error(
      `Failed to append support occurrence status event: ${eventInsertResult.error.message}`,
    );
  }

  return getTenantSupportOccurrenceDetail(occurrenceRow.id, {
    supabase,
    tenantId: options.tenantId,
  });
}

export async function addTenantSupportOccurrenceComment(
  occurrenceId: string,
  content: string,
  options: ActorOptions,
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const actorSide = options.actorSide ?? "cliente";
  const normalizedContent = content.trim();

  if (normalizedContent.length < 2) {
    throw new Error("Escreva uma mensagem para registrar a interação.");
  }

  const occurrenceRow = await resolveOccurrenceRow(
    occurrenceId,
    options.tenantId,
    supabase,
  );

  if (!canCommentOnTenantSupportOccurrence(occurrenceRow.status)) {
    throw new Error(
      "Este chamado está fechado. Reabra a ocorrência para continuar a conversa.",
    );
  }

  const createdByProfileId = await resolveActorProfileDatabaseId(
    options.actorProfileId,
    actorSide,
    options.tenantId,
    supabase,
  );
  const now = new Date().toISOString();

  const eventInsertResult = await supabase
    .from("tenant_support_occurrence_events")
    .insert({
      tenant_id: options.tenantId,
      occurrence_id: occurrenceRow.id,
      event_type: "comentario",
      author_scope: actorSide,
      content: normalizedContent,
      created_by_profile_id: createdByProfileId,
    });

  if (eventInsertResult.error) {
    throw new Error(
      `Failed to append support occurrence comment: ${eventInsertResult.error.message}`,
    );
  }

  const updateResult = await supabase
    .from("tenant_support_occurrences")
    .update({
      last_message_at: now,
      updated_at: now,
    })
    .eq("id", occurrenceRow.id)
    .eq("tenant_id", options.tenantId)
    .select("id")
    .single();

  assertSupabaseResult(updateResult, "Failed to update support occurrence timestamp");

  return getTenantSupportOccurrenceDetail(occurrenceRow.id, {
    supabase,
    tenantId: options.tenantId,
  });
}

export async function getTenantSupportOccurrenceByIdentifier(
  occurrenceId: string,
  options: QueryOptions,
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const occurrenceRow = await resolveOccurrenceRow(
    occurrenceId,
    options.tenantId,
    supabase,
  );

  const [profiles] = await Promise.all([
    listProfilesForTenantSupport(options.tenantId, supabase),
  ]);

  return mapOccurrenceRow(occurrenceRow, buildProfileMap(profiles));
}

export async function resolveTenantSupportOccurrenceDatabaseId(
  occurrenceId: string,
  options: QueryOptions,
) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  return resolveOccurrenceDatabaseId(occurrenceId, options.tenantId, supabase);
}
