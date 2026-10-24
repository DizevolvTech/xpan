/**
 * Lixeira de OPs (reunião 22/10, bloco 8 — só Master). Lógica pura.
 * A OP é identificada pela chave de planejamento (data|setor|linha|cronograma), a mesma do
 * motor; o código OP-AAMMDD-NNN é posicional e pode mudar.
 */
export function productionOrderPlanningKey(op: {
  productionDate: string;
  sectorId: string;
  lineId: string;
  scheduleId?: string | null;
}): string {
  return [op.productionDate, op.sectorId, op.lineId, op.scheduleId ?? "sem-linha"].join("|");
}

/**
 * Esconde a OP que está na lixeira enquanto ela só tiver os mesmos pedidos de quando foi
 * excluída. Pedido novo na mesma linha/dia faz a OP voltar.
 */
export function filterTrashedProductionOrders<
  T extends { productionDate: string; sectorId: string; lineId: string; scheduleId?: string | null; orderCodes: string[] },
>(ops: ReadonlyArray<T>, trashed: ReadonlyArray<{ planningKey: string; orderCodes: string[] }>): T[] {
  if (trashed.length === 0) return [...ops];
  const byKey = new Map(trashed.map((entry) => [entry.planningKey, new Set(entry.orderCodes)]));
  return ops.filter((op) => {
    const trashedCodes = byKey.get(productionOrderPlanningKey(op));
    if (!trashedCodes) return true;
    return op.orderCodes.some((code) => !trashedCodes.has(code));
  });
}
