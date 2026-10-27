import "server-only";

import { getOperationalTodayKey } from "@/lib/workflow-date-guard";
import type { OrderBatchSlot } from "@/lib/order-batch-plan";
import {
  buildBatchGroups,
  findMissingBatchDates,
  isBatchFinished,
  type BatchGroup,
  type MissingBatchDate,
  type OperationalNow,
} from "@/lib/order-batch-progress";
import type { StoreProfile } from "@/lib/order-planning";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertSupabaseResult, type SupabaseDataClient } from "@/lib/supabase-data/common";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";
import { planWeeklyStoreOrderReleases } from "@/lib/store-order-weekly-release-plan";

/** Agora no fuso operacional (America/Sao_Paulo). */
export function getOperationalNow(date = new Date()): OperationalNow {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return { dateKey: getOperationalTodayKey(), time };
}

export interface BatchGroupView extends BatchGroup {
  missingStoreNames: string[];
  orders: Array<{ orderId: string; orderCode: string; storeName: string; released: boolean }>;
}

export interface MissingBatchDateView extends MissingBatchDate {
  storeNames: string[];
}

export interface OrderBatchOverview {
  now: OperationalNow;
  settings: { leadDays: number; cutoffTime: string };
  groups: BatchGroupView[];
  missing: MissingBatchDateView[];
}

interface BatchRow {
  id: string;
  slots: OrderBatchSlot[] | null;
  status: string;
}

/**
 * Painel de lotes (reunião 22/10, bloco 7): lotes ABERTOS com % de lojas que pediram,
 * prazo, liberados; e datas do cronograma sem lote com prazo chegando.
 * `supabase` já vem escopado ao tenant.
 */
export async function getOrderBatchOverview(
  tenantId: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
  options: { includeMissing?: boolean; now?: OperationalNow } = {},
): Promise<OrderBatchOverview> {
  const now = options.now ?? getOperationalNow();
  const snapshot = await getMasterDataSnapshot({ supabase, includeProfileNames: false, tenantId });
  const settings = {
    leadDays: Number(snapshot.operationalSettings.expeditionLeadDays) || 0,
    cutoffTime: snapshot.operationalSettings.orderCutoffTime || "18:00",
  };

  const batchesResult = await supabase
    .from("order_batches")
    .select("id, slots, status, opened_at")
    .order("opened_at", { ascending: false })
    .limit(200);
  const batchRows = (assertSupabaseResult(batchesResult, "Failed to load order batches") as BatchRow[]).map((row) => ({
    id: row.id,
    status: row.status,
    slots: Array.isArray(row.slots) ? row.slots : [],
  }));
  const openBatches = batchRows.filter((row) => row.status === "aberto");

  const deliveryDates = Array.from(new Set(openBatches.flatMap((batch) => batch.slots.map((slot) => slot.deliveryDate))));
  const storesResult = await supabase.from("stores").select("id, legacy_id, name");
  const storeRows = assertSupabaseResult(storesResult, "Failed to load stores") as Array<{
    id: string;
    legacy_id: string | null;
    name: string;
  }>;
  const legacyByDbId = new Map(storeRows.map((row) => [row.id, row.legacy_id ?? row.id]));
  const nameByLegacy = new Map(storeRows.map((row) => [row.legacy_id ?? row.id, row.name]));

  let orderRows: Array<{
    id: string;
    code: string | null;
    store_id: string;
    delivery_date: string;
    management_status: string | null;
    batch_id: string | null;
  }> = [];
  let releasedIds = new Set<string>();
  if (deliveryDates.length > 0) {
    const ordersResult = await supabase
      .from("store_orders")
      .select("id, code, store_id, delivery_date, management_status, batch_id")
      .in("delivery_date", deliveryDates);
    orderRows = assertSupabaseResult(ordersResult, "Failed to load batch orders") as typeof orderRows;
    const orderIds = orderRows.map((row) => row.id);
    if (orderIds.length > 0) {
      const releasesResult = await supabase.from("workflow_order_releases").select("order_id").in("order_id", orderIds);
      releasedIds = new Set(
        (assertSupabaseResult(releasesResult, "Failed to load releases") as Array<{ order_id: string }>).map(
          (row) => row.order_id,
        ),
      );
    }
  }

  const orders = orderRows.map((row) => ({
    orderId: row.id,
    orderCode: row.code ?? row.id.slice(0, 8),
    storeId: legacyByDbId.get(row.store_id) ?? row.store_id,
    deliveryDate: row.delivery_date,
    batchId: row.batch_id,
    released: releasedIds.has(row.id),
    cancelled: row.management_status === "cancelado",
  }));

  const orderById = new Map(orders.map((order) => [order.orderId, order]));
  const groups: BatchGroupView[] = buildBatchGroups(openBatches, orders, settings, now).map((group) => ({
    ...group,
    missingStoreNames: group.missingStoreIds.map((id) => nameByLegacy.get(id) ?? id),
    orders: group.orderIds
      .map((orderId) => orderById.get(orderId))
      .filter((order): order is (typeof orders)[number] => Boolean(order))
      .map((order) => ({
        orderId: order.orderId,
        orderCode: order.orderCode,
        storeName: nameByLegacy.get(order.storeId) ?? order.storeId,
        released: order.released,
      })),
  }));

  let missing: MissingBatchDateView[] = [];
  if (options.includeMissing !== false && snapshot.schedules.some((schedule) => schedule.status === "ativo")) {
    const stores: StoreProfile[] = snapshot.stores
      .filter((store) => store.status === "ativo")
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
    if (stores.length > 0) {
      const plan = planWeeklyStoreOrderReleases({
        referenceDate: now.dateKey,
        stores,
        schedules: snapshot.schedules,
        products: snapshot.products,
        sectors: snapshot.sectors,
        lines: snapshot.lines,
        settings: snapshot.operationalSettings,
        ingredients: snapshot.ingredients,
        existingActiveByStoreDate: new Set<string>(),
      });
      const covered = batchRows.flatMap((batch) => batch.slots);
      missing = findMissingBatchDates(
        plan.toOpen.map((release) => ({ storeId: release.storeId, deliveryDate: release.deliveryDate })),
        covered,
        settings,
        now,
      ).map((item) => ({ ...item, storeNames: item.storeIds.map((id) => nameByLegacy.get(id) ?? id) }));
    }
  }

  return { now, settings, groups, missing };
}

/** Fecha (status 'fechado') os lotes cujas datas já foram todas liberadas: saem do painel. */
export async function closeFinishedBatches(
  groups: ReadonlyArray<BatchGroup>,
  supabase: SupabaseDataClient,
): Promise<string[]> {
  const batchIds = Array.from(new Set(groups.flatMap((group) => group.batchIds))).filter((id) =>
    isBatchFinished(groups, id),
  );
  if (batchIds.length === 0) return [];
  const result = await supabase.from("order_batches").update({ status: "fechado" }).in("id", batchIds).eq("status", "aberto");
  assertSupabaseResult({ data: [], error: result.error }, "Failed to close finished batches");
  return batchIds;
}
