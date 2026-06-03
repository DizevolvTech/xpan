/* -------------------------------------------------------------------------------------------------
 * Feature flags da aplicação (universal — client + server).
 *
 * Usa `NEXT_PUBLIC_*` para que o mesmo valor esteja disponível no servidor e no cliente
 * (o Next inlina `NEXT_PUBLIC_*` no bundle do cliente). Default sempre o comportamento legado.
 * -----------------------------------------------------------------------------------------------*/

/**
 * AJ-0009 Fase 4a + A10 — modelo "fábrica abre o pedido → loja preenche".
 * **Default ON** desde a entrega A10 (feature completa: liberação semanal a partir do
 * cronograma). Com a flag ligada, a fábrica abre pedidos (linhas `aberto`) e a loja
 * preenche em vez de criar do zero. Escape hatch: `NEXT_PUBLIC_FACTORY_OPENS_ORDERS=false`
 * desliga por ambiente sem novo deploy (volta ao fluxo legado: a loja cria).
 */
export function isFactoryOpensOrdersEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FACTORY_OPENS_ORDERS !== "false";
}
