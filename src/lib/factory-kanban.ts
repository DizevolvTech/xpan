/* -------------------------------------------------------------------------------------------------
 * Kanban do gestor de fábrica — em qual coluna cada card entra.
 *
 * As colunas representam o FLUXO de trabalho (aceitar → produzir → expedir → entregar),
 * dirigido pelo ESTADO (liberado/produzido), não pela data. O status do pedido (`agendado`,
 * `em_producao`…) é derivado por data e por isso NÃO serve sozinho para mover o card ao
 * liberar/produzir. Estes predicados resolvem isso. Lógica pura/testável.
 * -----------------------------------------------------------------------------------------------*/

import type { OrderStatus } from "@/lib/order-planning";

const TERMINAL_FOR_ACCEPTANCE: OrderStatus[] = [
  "cancelado",
  "aguardando_expedicao",
  "rota_entrega",
];

/**
 * Coluna "Aberto" (aguardando aceite/liberação da fábrica): pedido ainda NÃO liberado e
 * que não passou para etapas posteriores nem foi cancelado. Independe da data de produção —
 * ao liberar (`releasedToProduction=true`) o pedido sai daqui e vai para "Em produção".
 */
export function isOrderAwaitingAcceptance(order: {
  releasedToProduction: boolean;
  status: OrderStatus;
}): boolean {
  return !order.releasedToProduction && !TERMINAL_FOR_ACCEPTANCE.includes(order.status);
}

/**
 * Coluna "Em produção": OP já LIBERADA e ainda não pronta (não está aguardando expedição).
 * Independe da data — uma OP liberada para um dia futuro também aparece aqui (era o bug:
 * antes só aparecia com status `em_producao`, ou seja, produção de hoje).
 */
export function isOpInProductionColumn(op: {
  releasedToProduction: boolean;
  status: OrderStatus;
}): boolean {
  return op.releasedToProduction && op.status !== "aguardando_expedicao";
}
