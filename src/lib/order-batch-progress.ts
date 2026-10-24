/* -------------------------------------------------------------------------------------------------
 * Reunião 22/10 (bloco 7) — painel de LOTES de pedidos. Lógica pura, sem I/O.
 *
 * Pedido do cliente (20:50–30:22): saber quais lotes estão abertos, quantas lojas já
 * responderam (%), o prazo, quantos já foram liberados; ao liberar, o lote sai da tela.
 * Liberar só quando o lote está COMPLETO (todas as lojas pediram) ou o PRAZO acabou (quem
 * não pediu até o prazo não pede mais). Avisar quando o cronograma pede um lote que não foi
 * aberto e o prazo está chegando.
 *
 * Prazo de um slot = (data de entrega − dias de antecedência do pedido) no horário de corte,
 * o mesmo que a loja vê ("entrega D+N · prazo 18:00").
 * ---------------------------------------------------------------------------------------------- */
import { batchSlotKey, type OrderBatchSlot } from "@/lib/order-batch-plan";

export interface OrderDeadline {
  /** Dia do prazo (YYYY-MM-DD). */
  dateKey: string;
  /** Horário de corte (HH:MM). */
  time: string;
}

export interface OperationalNow {
  dateKey: string;
  time: string;
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function slotOrderDeadline(deliveryDate: string, leadDays: number, cutoffTime: string): OrderDeadline {
  return { dateKey: shiftDateKey(deliveryDate, -Math.max(0, Math.floor(leadDays))), time: cutoffTime || "18:00" };
}

export function isDeadlinePassed(deadline: OrderDeadline, now: OperationalNow): boolean {
  if (now.dateKey !== deadline.dateKey) return now.dateKey > deadline.dateKey;
  return now.time >= deadline.time;
}

/** Horas que faltam até o prazo (negativo = passou). Datas e horas no fuso operacional. */
export function hoursUntilDeadline(deadline: OrderDeadline, now: OperationalNow): number {
  const toMinutes = (dateKey: string, time: string) => {
    const [h, m] = time.split(":").map(Number);
    return Date.parse(`${dateKey}T00:00:00Z`) / 60000 + (h || 0) * 60 + (m || 0);
  };
  return (toMinutes(deadline.dateKey, deadline.time) - toMinutes(now.dateKey, now.time)) / 60;
}

export interface BatchInput {
  id: string;
  slots: OrderBatchSlot[];
}

export interface BatchOrderInput {
  orderId: string;
  orderCode: string;
  /** Loja (id legado, o mesmo dos slots). */
  storeId: string;
  deliveryDate: string;
  batchId: string | null;
  released: boolean;
  cancelled: boolean;
}

export type BatchGroupState = "aguardando_lojas" | "pronto_para_liberar" | "liberado";

export interface BatchGroup {
  batchId: string;
  deliveryDate: string;
  deadline: OrderDeadline;
  deadlinePassed: boolean;
  totalStores: number;
  orderedStores: number;
  percent: number;
  missingStoreIds: string[];
  releasedOrders: number;
  /** Pedidos ativos do lote nesta data que ainda não foram para a produção. */
  pendingOrderIds: string[];
  state: BatchGroupState;
}

/**
 * Um grupo por (lote × data de entrega). Pedido conta para o lote quando é da mesma loja e
 * data de um slot do lote (e, se tiver `batchId`, do mesmo lote).
 */
export function buildBatchGroups(
  batches: ReadonlyArray<BatchInput>,
  orders: ReadonlyArray<BatchOrderInput>,
  settings: { leadDays: number; cutoffTime: string },
  now: OperationalNow,
): BatchGroup[] {
  const activeOrders = orders.filter((order) => !order.cancelled);
  const groups: BatchGroup[] = [];
  for (const batch of batches) {
    const byDate = new Map<string, Set<string>>();
    for (const slot of batch.slots) {
      if (!byDate.has(slot.deliveryDate)) byDate.set(slot.deliveryDate, new Set());
      byDate.get(slot.deliveryDate)!.add(slot.storeId);
    }
    for (const [deliveryDate, storeIds] of byDate) {
      const slotKeys = new Set([...storeIds].map((storeId) => batchSlotKey(storeId, deliveryDate)));
      const groupOrders = activeOrders.filter(
        (order) =>
          slotKeys.has(batchSlotKey(order.storeId, order.deliveryDate)) &&
          (order.batchId === null || order.batchId === batch.id),
      );
      const orderedStores = new Set(groupOrders.map((order) => order.storeId));
      const deadline = slotOrderDeadline(deliveryDate, settings.leadDays, settings.cutoffTime);
      const deadlinePassed = isDeadlinePassed(deadline, now);
      const missingStoreIds = [...storeIds].filter((storeId) => !orderedStores.has(storeId)).sort();
      const pendingOrderIds = groupOrders.filter((order) => !order.released).map((order) => order.orderId);
      const releasedOrders = groupOrders.filter((order) => order.released).length;
      // Liberado o que tinha, a entrega fecha: pedido novo para uma entrega já liberada é
      // recusado (createStoreOrder), então quem faltou não pede mais e o cartão sai.
      const complete = missingStoreIds.length === 0 || deadlinePassed || (releasedOrders > 0 && pendingOrderIds.length === 0);
      const state: BatchGroupState =
        complete && pendingOrderIds.length === 0
          ? "liberado"
          : complete
            ? "pronto_para_liberar"
            : "aguardando_lojas";
      groups.push({
        batchId: batch.id,
        deliveryDate,
        deadline,
        deadlinePassed,
        totalStores: storeIds.size,
        orderedStores: orderedStores.size,
        percent: storeIds.size === 0 ? 0 : Math.round((orderedStores.size / storeIds.size) * 100),
        missingStoreIds,
        releasedOrders,
        pendingOrderIds,
        state,
      });
    }
  }
  return groups.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.batchId.localeCompare(b.batchId));
}

/** Lote pode ser fechado (sai da tela) quando todas as datas dele estão liberadas. */
export function isBatchFinished(groups: ReadonlyArray<BatchGroup>, batchId: string): boolean {
  const own = groups.filter((group) => group.batchId === batchId);
  return own.length > 0 && own.every((group) => group.state === "liberado");
}

export interface MissingBatchDate {
  deliveryDate: string;
  deadline: OrderDeadline;
  hoursLeft: number;
  storeIds: string[];
}

/**
 * Datas que o CRONOGRAMA pede (loja × entrega) e que nenhum lote (aberto ou fechado)
 * cobre, com prazo ainda por vir dentro de `alertHours`. É o aviso de "lote esquecido".
 */
export function findMissingBatchDates(
  plannedSlots: ReadonlyArray<OrderBatchSlot>,
  coveredSlots: ReadonlyArray<OrderBatchSlot>,
  settings: { leadDays: number; cutoffTime: string },
  now: OperationalNow,
  alertHours = 72,
): MissingBatchDate[] {
  const covered = new Set(coveredSlots.map((slot) => batchSlotKey(slot.storeId, slot.deliveryDate)));
  const byDate = new Map<string, Set<string>>();
  for (const slot of plannedSlots) {
    if (covered.has(batchSlotKey(slot.storeId, slot.deliveryDate))) continue;
    if (!byDate.has(slot.deliveryDate)) byDate.set(slot.deliveryDate, new Set());
    byDate.get(slot.deliveryDate)!.add(slot.storeId);
  }
  const result: MissingBatchDate[] = [];
  for (const [deliveryDate, storeIds] of byDate) {
    const deadline = slotOrderDeadline(deliveryDate, settings.leadDays, settings.cutoffTime);
    const hoursLeft = hoursUntilDeadline(deadline, now);
    if (hoursLeft <= 0 || hoursLeft > alertHours) continue;
    result.push({ deliveryDate, deadline, hoursLeft, storeIds: [...storeIds].sort() });
  }
  return result.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
}
