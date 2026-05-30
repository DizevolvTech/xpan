/* -------------------------------------------------------------------------------------------------
 * Janela de pedido da loja — regra "1 pedido por janela".
 *
 * A loja pode fazer 1 pedido por JANELA operacional (o dia determinado pelo cutoff:
 * antes das 18h → janela do dia; depois → janela do dia seguinte). Um pedido em andamento
 * de uma janela ANTERIOR não pode bloquear um novo pedido para a janela atual.
 *
 * Identidade da janela = `deliveryDateKey` (data de entrega derivada da base operacional),
 * mesma chave usada no aviso de duplicidade (AJ-0007) e no índice UNIQUE do banco.
 * -----------------------------------------------------------------------------------------------*/

/** Status "em andamento" (entre lançamento e entrega) — exclui cancelado/entregue/tentativa_falha. */
export const IN_PROGRESS_STORE_ORDER_STATUSES = [
  "em_espera",
  "agendado",
  "em_producao",
  "aguardando_expedicao",
  "pronto_coleta",
  "em_rota",
  "no_destino",
] as const;

const IN_PROGRESS_SET = new Set<string>(IN_PROGRESS_STORE_ORDER_STATUSES);

/**
 * Retorna o pedido em andamento da loja PARA A JANELA ATUAL (mesma `deliveryDateKey`),
 * ou `null`. Pedidos de outras janelas/dias são ignorados — não bloqueiam um pedido novo.
 */
export function findActiveWindowOrder<
  T extends { storeId: string; deliveryDateKey: string; status: string },
>(orders: T[], params: { storeId: string | null | undefined; deliveryDateKey: string }): T | null {
  if (!params.storeId) {
    return null;
  }

  return (
    orders.find(
      (order) =>
        order.storeId === params.storeId &&
        order.deliveryDateKey === params.deliveryDateKey &&
        IN_PROGRESS_SET.has(order.status),
    ) ?? null
  );
}
