import "server-only";

import { getTodayDateKey } from "@/lib/order-planning";
import type { StoreProfile } from "@/lib/order-planning";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  resolveProfileDatabaseId,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";
import { planWeeklyStoreOrderReleases } from "@/lib/store-order-weekly-release-plan";
import { batchCoversSlot, deriveBatchSlots, type OrderBatchSlot } from "@/lib/order-batch-plan";

export interface OpenOrderBatchInput {
  /** 'week' deriva os slots do cronograma; 'manual' usa uma data de entrega única. */
  mode?: "week" | "manual";
  /** Início do horizonte rolante de 7 dias (YYYY-MM-DD). Default: hoje. */
  referenceDate?: string;
  /** Modo manual: data de entrega única. */
  deliveryDate?: string;
  /** Lojas (legacy ids) do lote. */
  storeIds: string[];
  openedByProfileId?: string | null;
  tenantId?: string | null;
  orderedAt?: string;
}

export interface OrderBatchRecord {
  id: string;
  referenceDate: string;
  slots: OrderBatchSlot[];
  openedAt: string;
  status: string;
}

interface OrderBatchRow {
  id: string;
  reference_date: string;
  slots: OrderBatchSlot[] | null;
  opened_at: string;
  status: string;
}

function rowToBatch(row: OrderBatchRow): OrderBatchRecord {
  return {
    id: row.id,
    referenceDate: row.reference_date,
    slots: Array.isArray(row.slots) ? row.slots : [],
    openedAt: row.opened_at,
    status: row.status,
  };
}

/**
 * FÁBRICA ABRE UM LOTE: cria UM registro `order_batches` com os slots (loja × data de
 * entrega) elegíveis. Modo 'week' deriva do cronograma (planWeeklyStoreOrderReleases);
 * modo 'manual' usa uma data única. NÃO cria pedido nenhum — a loja cria dentro do lote.
 */
export async function openOrderBatch(
  input: OpenOrderBatchInput,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<OrderBatchRecord> {
  const referenceDate = input.referenceDate ?? getTodayDateKey();
  const requestedStoreIds = Array.from(new Set(input.storeIds));
  if (requestedStoreIds.length === 0) {
    throw new Error("Informe ao menos uma loja para abrir o lote.");
  }

  let slots: OrderBatchSlot[];
  if (input.mode === "manual") {
    const deliveryDate = input.deliveryDate;
    if (!deliveryDate) {
      throw new Error("Informe a data de entrega e ao menos uma loja para abrir o lote manual.");
    }
    slots = requestedStoreIds.map((storeId) => ({ storeId, deliveryDate }));
  } else {
    const snapshot = await getMasterDataSnapshot({
      supabase,
      includeProfileNames: false,
      tenantId: input.tenantId,
      forceRefresh: true,
    });
    const storeByLegacyId = new Map(snapshot.stores.map((store) => [store.id, store]));
    const targetStores: StoreProfile[] = requestedStoreIds
      .map((legacyId) => storeByLegacyId.get(legacyId))
      .filter((store): store is (typeof snapshot.stores)[number] => Boolean(store))
      .map((store) => ({
        id: store.id,
        code: store.code,
        name: store.name,
        orderingDays: store.orderingDays,
        receivingDays: store.receivingDays,
        orderingBlockedDays: store.orderingBlockedDays,
        receivingBlockedDays: store.receivingBlockedDays,
        receiveWindow: store.receiveWindow,
        deliveryZone: store.deliveryZone ?? null,
      }));
    if (targetStores.length === 0) {
      throw new Error("Nenhuma loja válida informada para abrir o lote da semana.");
    }
    if (!snapshot.schedules.some((schedule) => schedule.status === "ativo")) {
      throw new Error(
        "Não há cronograma ativo: o lote da semana só pode ser aberto a partir de um cronograma ativo.",
      );
    }
    const plan = planWeeklyStoreOrderReleases({
      referenceDate,
      stores: targetStores,
      schedules: snapshot.schedules,
      products: snapshot.products,
      sectors: snapshot.sectors,
      lines: snapshot.lines,
      settings: snapshot.operationalSettings,
      ingredients: snapshot.ingredients,
      // O lote lista TODOS os slots do cronograma; a duplicidade (1 pedido por loja/data)
      // é barrada na criação real do pedido, não aqui.
      existingActiveByStoreDate: new Set<string>(),
    });
    slots = deriveBatchSlots(
      plan.toOpen.map((release) => ({ storeId: release.storeId, deliveryDate: release.deliveryDate })),
    );
    if (slots.length === 0) {
      throw new Error(
        "Nenhum slot elegível: o cronograma ativo não cobre nenhuma data de entrega das lojas selecionadas nesta semana.",
      );
    }
  }

  const openedByProfileDatabaseId = await resolveProfileDatabaseId(supabase, input.openedByProfileId ?? null, {
    tenantId: input.tenantId,
  });

  const insertResult = await supabase
    .from("order_batches")
    .insert({
      reference_date: referenceDate,
      slots,
      opened_by_profile_id: openedByProfileDatabaseId,
      status: "aberto",
    })
    .select("id, reference_date, slots, opened_at, status")
    .single();
  const row = assertSupabaseResult(insertResult, "Failed to open order batch") as OrderBatchRow;
  return rowToBatch(row);
}

/** Lotes ABERTOS do tenant. Se `allowedStoreIds` for informado, filtra os slots às lojas
 * permitidas (a loja só vê seus próprios slots). */
export async function listOpenBatches(
  allowedStoreIds: string[] | null | undefined,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<OrderBatchRecord[]> {
  const result = await supabase
    .from("order_batches")
    .select("id, reference_date, slots, opened_at, status")
    .eq("status", "aberto")
    .order("opened_at", { ascending: false });
  const rows = assertSupabaseResult(result, "Failed to load open order batches") as OrderBatchRow[];
  const batches = rows.map(rowToBatch);
  if (!allowedStoreIds || allowedStoreIds.length === 0) {
    return batches;
  }
  const allowed = new Set(allowedStoreIds);
  return batches
    .map((batch) => ({ ...batch, slots: batch.slots.filter((slot) => allowed.has(slot.storeId)) }))
    .filter((batch) => batch.slots.length > 0);
}

/** GATE de criação: devolve o lote ABERTO que cobre (loja, data), ou null. */
export async function findOpenBatchCoveringSlot(
  storeId: string,
  deliveryDate: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<OrderBatchRecord | null> {
  const batches = await listOpenBatches(null, supabase);
  return batches.find((batch) => batchCoversSlot(batch.slots, storeId, deliveryDate)) ?? null;
}
