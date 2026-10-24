/**
 * Soma por produto de um conjunto de pedidos (reunião 22/10, bloco 8 — 28:16: "quero ver a
 * soma de todos os produtos, quanto foi pedido", ANTES de liberar). Só produto do pedido
 * (sem itens derivados da receita nem slots do cronograma), somado por produto e unidade.
 */
export interface ProductSumRow {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  kg: number;
  stores: number;
}

export function sumOrderItemsByProduct(
  items: ReadonlyArray<{
    productId: string;
    productCode: string;
    productName: string;
    requestedQuantity: number;
    requestedUnit: string;
    internalKg: number;
    storeId: string;
    demandSource?: string;
    isIntermediate?: boolean;
  }>,
): ProductSumRow[] {
  const map = new Map<string, ProductSumRow & { storeSet: Set<string> }>();
  for (const item of items) {
    if (item.isIntermediate || item.demandSource === "cronograma") continue;
    const key = `${item.productId}|${item.requestedUnit}`;
    const row =
      map.get(key) ??
      {
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        unit: item.requestedUnit,
        quantity: 0,
        kg: 0,
        stores: 0,
        storeSet: new Set<string>(),
      };
    row.quantity += item.requestedQuantity;
    row.kg += item.internalKg;
    row.storeSet.add(item.storeId);
    map.set(key, row);
  }
  return Array.from(map.values())
    .map(({ storeSet, ...row }) => ({
      ...row,
      // Soma o valor exato e arredonda uma vez no total.
      quantity: Math.round(row.quantity * 1000) / 1000,
      kg: Math.round(row.kg * 1000) / 1000,
      stores: storeSet.size,
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName));
}
