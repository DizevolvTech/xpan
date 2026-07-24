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

/* -------------------------------------------------------------------------------------------------
 * XPAN item 6 — atraso do pedido na visão da loja.
 *
 * Atrasado = a data de recebimento prevista JÁ PASSOU e o pedido continua sem ser entregue.
 * "Não entregue" exclui `entregue` e `cancelado`, mas INCLUI `tentativa_falha`: a tentativa
 * falhou, a loja continua sem a mercadoria e a data venceu — é exatamente o caso que o alerta
 * precisa mostrar. Por isso NÃO reusamos `IN_PROGRESS_STORE_ORDER_STATUSES`, que trata
 * `tentativa_falha` como terminal para a regra de "1 pedido por janela".
 * -----------------------------------------------------------------------------------------------*/

/** Status em que o pedido deixou de estar pendente na loja — não geram alerta de atraso. */
const SETTLED_STORE_ORDER_STATUSES = new Set<string>(["entregue", "cancelado"]);

/**
 * `true` quando a entrega prevista venceu e o pedido ainda não foi entregue.
 *
 * `todayDateKey` é sempre injetado pelo chamador (`getTodayDateKey()`, NUNCA o `anchorDate`
 * do escopo operacional — o usuário escolhe data passada/futura ali e o alerta apareceria e
 * sumiria ao filtrar). String vazia = a data local ainda não é confiável (render de servidor)
 * e o alerta fica desligado, evitando divergência de hidratação perto da meia-noite.
 */
export function isStoreOrderOverdue(
  order: { deliveryDateKey: string; status: string },
  todayDateKey: string,
): boolean {
  if (!todayDateKey || !order.deliveryDateKey) {
    return false;
  }

  if (SETTLED_STORE_ORDER_STATUSES.has(order.status)) {
    return false;
  }

  // Chaves `AAAA-MM-DD` comparam lexicograficamente = cronologicamente.
  return order.deliveryDateKey < todayDateKey;
}

/* -------------------------------------------------------------------------------------------------
 * XPAN item 5 — afordância da trava de edição na LISTA da loja.
 *
 * O gate real é do servidor (`ensureOrderIsMutable`): pedido cancelado ou com row em
 * `workflow_order_releases` é imutável. Aqui só decidimos se a linha OFERECE a edição, para a
 * loja não abrir o formulário, zerar itens e só tomar o erro no submit.
 * -----------------------------------------------------------------------------------------------*/

/**
 * `true` quando a lista pode oferecer "Editar pedido" para este resumo.
 *
 * `canEdit`/`releasedToProduction` chegam da API (mesma regra de `buildStoreOrderCapabilities`).
 * Ausentes = resumo montado sem essa informação → a afordância é mantida, já que o servidor
 * continua sendo o gate real.
 */
export function isStoreOrderEditable(order: {
  status: string;
  canEdit?: boolean;
  releasedToProduction?: boolean;
}): boolean {
  if (order.releasedToProduction) {
    return false;
  }

  if (order.status === "cancelado") {
    return false;
  }

  return order.canEdit ?? true;
}
