/* -------------------------------------------------------------------------------------------------
 * XPAN-Lote — lógica PURA do lote de pedidos (testável, sem I/O).
 *
 * A fábrica abre um LOTE = um conjunto de SLOTS (loja × data de entrega) elegíveis, derivados do
 * cronograma. A loja cria seu pedido real DENTRO do lote; o gate de criação usa `batchCoversSlot`.
 * ---------------------------------------------------------------------------------------------- */

export interface OrderBatchSlot {
  storeId: string;
  /** YYYY-MM-DD. */
  deliveryDate: string;
}

/** Chave canônica de um slot (loja × data) — para dedupe e casamento com pedidos criados. */
export function batchSlotKey(storeId: string, deliveryDate: string): string {
  return `${storeId}|${deliveryDate}`;
}

/**
 * Deriva os slots DISTINTOS (loja × data de entrega) a partir do plano do cronograma
 * (`planWeeklyStoreOrderReleases().toOpen` ou uma lista manual). É o conteúdo do lote —
 * substitui a materialização de N pedidos vazios.
 */
export function deriveBatchSlots(
  toOpen: ReadonlyArray<{ storeId: string; deliveryDate: string }>,
): OrderBatchSlot[] {
  const seen = new Set<string>();
  const slots: OrderBatchSlot[] = [];
  for (const item of toOpen) {
    const key = batchSlotKey(item.storeId, item.deliveryDate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    slots.push({ storeId: item.storeId, deliveryDate: item.deliveryDate });
  }
  return slots;
}

/**
 * TRUE se algum slot do lote cobre (loja, data). É o GATE de criação de pedido pela loja:
 * só cria pedido para um par (loja × data de entrega) que esteja num lote aberto.
 */
export function batchCoversSlot(
  slots: ReadonlyArray<OrderBatchSlot>,
  storeId: string,
  deliveryDate: string,
): boolean {
  return slots.some((slot) => slot.storeId === storeId && slot.deliveryDate === deliveryDate);
}

/**
 * Slots do lote que ainda NÃO viraram pedido real — o que a loja pode criar e a base do
 * "X de Y pedidos feitos" (Y = total de slots, X = slots já com pedido). `orderedKeys` são as
 * chaves `batchSlotKey` dos pedidos reais já criados.
 */
export function pendingBatchSlots(
  slots: ReadonlyArray<OrderBatchSlot>,
  orderedKeys: Iterable<string>,
): OrderBatchSlot[] {
  const ordered = orderedKeys instanceof Set ? orderedKeys : new Set(orderedKeys);
  return slots.filter((slot) => !ordered.has(batchSlotKey(slot.storeId, slot.deliveryDate)));
}
