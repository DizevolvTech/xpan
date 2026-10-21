/**
 * Feedback 9 do cliente (envio de pedidos para produção) — regras PURAS do lote:
 *
 * 1. Ao liberar um pedido de um lote, avisar quais lojas do MESMO lote e MESMA entrega ainda
 *    não pediram (a produção da entrega reúne os pedidos de todas as lojas);
 * 2. Depois que existe pedido liberado para uma entrega, a loja não cria mais pedido para ela.
 */
import type { OrderBatchSlot } from "@/lib/order-batch-plan";

/** Lojas (legacy ids) com slot na entrega que ainda não têm pedido ativo. */
export function findPendingBatchStores(
  slots: ReadonlyArray<OrderBatchSlot>,
  deliveryDate: string,
  storesWithActiveOrder: Iterable<string>,
): string[] {
  const done = new Set(storesWithActiveOrder);
  const pending: string[] = [];
  for (const slot of slots) {
    if (slot.deliveryDate !== deliveryDate || done.has(slot.storeId) || pending.includes(slot.storeId)) continue;
    pending.push(slot.storeId);
  }
  return pending;
}

export function buildPendingStoresMessage(storeNames: string[], deliveryDate: string): string {
  const [year, month, day] = deliveryDate.split("-");
  const label = year && month && day ? `${day}/${month}/${year}` : deliveryDate;
  const count = storeNames.length;
  return `${count === 1 ? "1 loja do lote ainda não fez" : `${count} lojas do lote ainda não fizeram`} o pedido para a entrega de ${label}: ${storeNames.join(", ")}. Depois de liberar, ${count === 1 ? "ela não conseguirá" : "elas não conseguirão"} mais pedir para esta entrega.`;
}

export function buildDeliveryAlreadyReleasedMessage(deliveryDate: string): string {
  const [year, month, day] = deliveryDate.split("-");
  const label = year && month && day ? `${day}/${month}/${year}` : deliveryDate;
  return `A entrega de ${label} já foi liberada para produção. Não é possível criar novos pedidos para ela. Fale com a fábrica se a loja ainda precisa pedir.`;
}
