/* -------------------------------------------------------------------------------------------------
 * AJ-0025 — Mensagem acionável para bloqueio de liberação de pedido.
 *
 * O motor devolve um `reason` (`order_cancelled` | `order_not_planned` | `order_not_releasable`)
 * e uma mensagem técnica. Quando o pedido fica não-planejável porque o produto foi editado e o
 * cronograma voltou a `pendente`, a mensagem genérica não orienta
 * o usuário. Aqui enriquecemos com a ação concreta: reauditar o cronograma antes de liberar.
 *
 * Módulo puro (sem `server-only`/`use client`) para ser testável e usável nos dois lados.
 * -----------------------------------------------------------------------------------------------*/

export type ReleaseBlockReason =
  | "order_cancelled"
  | "order_not_planned"
  | "order_not_releasable";

const REAUDIT_HINT =
  "Se você editou um produto recentemente, o cronograma volta a pendente — reaudite o cronograma e tente liberar de novo.";

export function buildReleaseBlockMessage(
  reason: ReleaseBlockReason | string,
  serverMessage: string,
): string {
  const base = serverMessage.trim();

  if (reason === "order_not_releasable" || reason === "order_not_planned") {
    return `${base}\n\n${REAUDIT_HINT}`;
  }

  return base;
}
