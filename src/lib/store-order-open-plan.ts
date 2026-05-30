/* -------------------------------------------------------------------------------------------------
 * AJ-0009 Fase 4a — planejamento de quais lojas abrir pedido (lógica pura, testável).
 * A fábrica "abre" um pedido (linha `aberto`) por loja/data. Pulamos lojas que já têm
 * pedido ativo naquela data (o índice UNIQUE também barra, mas aqui evitamos o erro e
 * reportamos o que foi pulado). Ver ADR_modelo_fabrica_abre_pedido.
 * -----------------------------------------------------------------------------------------------*/

export interface StoreOrdersOpenPlanInput {
  requestedStoreIds: string[];
  /** Lojas que já têm um pedido ativo para a data de entrega-alvo. */
  storeIdsWithActiveOrder: string[];
}

export interface StoreOrdersOpenPlan {
  toOpen: string[];
  skipped: string[];
}

export function planStoreOrdersToOpen(input: StoreOrdersOpenPlanInput): StoreOrdersOpenPlan {
  const withActive = new Set(input.storeIdsWithActiveOrder);
  const seen = new Set<string>();
  const toOpen: string[] = [];
  const skipped: string[] = [];

  for (const storeId of input.requestedStoreIds) {
    if (seen.has(storeId)) {
      continue;
    }
    seen.add(storeId);

    if (withActive.has(storeId)) {
      skipped.push(storeId);
    } else {
      toOpen.push(storeId);
    }
  }

  return { toOpen, skipped };
}
