/**
 * Quadro #4 (Lucas, 27-28/10): pedido de lote dentro do prazo das lojas não é liberado sozinho
 * em nenhuma tela (Pedidos, Visão Geral, Detalhe). Mapa código do pedido (PD-…) → prazo do lote.
 */
export interface WaitingBatchGroup {
  state: string;
  deliveryDate: string;
  deadline: { dateKey: string; time: string };
  orders: ReadonlyArray<{ orderCode: string; released: boolean }>;
}

export interface WaitingBatchOrder {
  deliveryDate: string;
  deadline: { dateKey: string; time: string };
}

export function waitingBatchOrdersByCode(groups: ReadonlyArray<WaitingBatchGroup>): Map<string, WaitingBatchOrder> {
  const map = new Map<string, WaitingBatchOrder>();
  for (const group of groups) {
    if (group.state !== "aguardando_lojas") continue;
    for (const order of group.orders) {
      if (order.released) continue;
      map.set(order.orderCode, { deliveryDate: group.deliveryDate, deadline: group.deadline });
    }
  }
  return map;
}

function shortDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return year && month && day ? `${day}/${month}` : dateKey;
}

export function waitingBatchOrderHint(order: WaitingBatchOrder) {
  return `Pedido do lote da entrega ${shortDate(order.deliveryDate)}: as lojas ainda podem pedir até ${shortDate(order.deadline.dateKey)} às ${order.deadline.time}. Libere o lote inteiro depois do prazo, em Pedidos.`;
}
