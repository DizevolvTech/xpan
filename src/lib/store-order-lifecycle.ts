/* -------------------------------------------------------------------------------------------------
 * AJ-0009 Fase 4a — ciclo de vida do pedido no modelo "fábrica abre → loja preenche".
 * Lógica pura (sem `server-only`/env) para ser testável e compartilhável.
 * Ver Docs/decisoes/ADR_modelo_fabrica_abre_pedido.md (Opção B / modelo C híbrido).
 * -----------------------------------------------------------------------------------------------*/

export type StoreOrderLifecycleStatus = "aberto" | "preenchido" | "enviado";

/**
 * Status do pedido depois que a loja preenche.
 * - `aberto` (fábrica abriu, loja preencheu agora) → `preenchido`
 * - `null`/`undefined` (legado: loja criou direto, sem ciclo) → `preenchido`
 * - `enviado` → permanece (não regride)
 */
export function resolveFilledStatus(
  current: StoreOrderLifecycleStatus | null | undefined,
): StoreOrderLifecycleStatus {
  if (current === "enviado") {
    return "enviado";
  }
  return "preenchido";
}

/**
 * Com o modelo "fábrica abre o pedido" ligado (flag `FACTORY_OPENS_ORDERS`), a loja
 * **não cria** pedidos do zero — só preenche os que a fábrica abriu. Com a flag
 * desligada (default), mantém o comportamento legado: a loja inicia o pedido.
 */
export function canStoreInitiateOrder(factoryOpensOrders: boolean): boolean {
  return !factoryOpensOrders;
}
