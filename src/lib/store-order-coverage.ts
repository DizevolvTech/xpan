/* -------------------------------------------------------------------------------------------------
 * Pedido da loja — preenchimento por dias de cobertura.
 *
 * Quando um produto é fabricado com baixa cadência (ex.: 1x/semana), uma única produção
 * "cobre" vários dias. A loja pode informar a quantidade que precisa em CADA dia coberto
 * (verde na grade) para se programar e não faltar produto até a próxima fabricação. O pedido
 * final guarda apenas o SOMATÓRIO por item. Lógica pura/testável.
 * -----------------------------------------------------------------------------------------------*/

export type OrderDayField = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export const ORDER_DAY_FIELDS: readonly OrderDayField[] = [
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sab",
  "dom",
];

/** Soma as quantidades de todos os dias de um item (os não preenchidos contam 0). */
export function sumOrderDayQuantities(record: Partial<Record<OrderDayField, number>>): number {
  return ORDER_DAY_FIELDS.reduce((total, field) => total + (record[field] ?? 0), 0);
}

/** Os campos de dia cobertos pela produção = os `coverageDays` primeiros da ordem visual. */
export function getCoveredDayFields(dayOrder: OrderDayField[], coverageDays: number): OrderDayField[] {
  return dayOrder.slice(0, Math.max(0, coverageDays));
}

/**
 * Replica `value` em todos os dias cobertos (mecânica de planejamento diário: "preciso de X
 * por dia durante a cobertura"). Retorna o mapa parcial dia→valor a aplicar.
 */
export function buildCoveredDaysFill(
  dayOrder: OrderDayField[],
  coverageDays: number,
  value: number,
): Partial<Record<OrderDayField, number>> {
  const fill: Partial<Record<OrderDayField, number>> = {};
  for (const field of getCoveredDayFields(dayOrder, coverageDays)) {
    fill[field] = value;
  }
  return fill;
}
