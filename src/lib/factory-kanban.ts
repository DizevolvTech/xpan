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
  "entregue",
];

// Estados em que a PRODUÇÃO já terminou (saiu pra expedição/rota ou já entregue) —
// ou foi cancelada. OP nesses estados NÃO pertence mais à coluna "Em produção".
const PAST_PRODUCTION_STATUSES: OrderStatus[] = [
  "aguardando_expedicao",
  "rota_entrega",
  "entregue",
  "cancelado",
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
 * Coluna "Em produção": OP já LIBERADA e ainda EM PRODUÇÃO (não passou para
 * expedição/rota/entregue nem foi cancelada). Independe da data — uma OP liberada
 * para um dia futuro também aparece aqui. Um pedido JÁ ENTREGUE sai daqui (era o
 * bug: a OP entregue continuava em "Em produção" mostrando 100%).
 */
export function isOpInProductionColumn(op: {
  releasedToProduction: boolean;
  status: OrderStatus;
}): boolean {
  return op.releasedToProduction && !PAST_PRODUCTION_STATUSES.includes(op.status);
}

/**
 * Quadro do CHÃO: mostra TODA OP liberada (não cancelada) — inclusive as ainda NÃO
 * iniciadas. Liberar já manda a OP pro chão (decisão 2026-07-24): antes exigia também
 * `productionStarted` (2º passo "Iniciar produção do dia"), o que fazia o gestor mostrar
 * a OP e o chão não → os dois quadros divergiam. As OPs concluídas seguem incluídas (ainda
 * liberadas) e rolam para a coluna "Expedição" pela etapa dos itens, não pelo `status`.
 */
export function isOpOnChaoBoard(op: {
  releasedToProduction: boolean;
  status: OrderStatus;
}): boolean {
  return op.releasedToProduction && op.status !== "cancelado";
}

/**
 * Chave de navegação ESTÁVEL de uma OP (`productionDate|sectorId|lineId|scheduleId`).
 *
 * O `id`/`code` da OP são posicionais (`op-${index}` / `OP-...-NNN`) e mudam quando
 * o conjunto de OPs do snapshot reindexa (novo pedido, troca de janela, refresh) —
 * abrindo a OP errada num deep-link. Esta chave deriva da identidade real do
 * agrupamento (mesma forma do planningKey do engine) e não reindexa. Usar para
 * navegar/resolver o detalhe da OP em vez do id posicional.
 */
export function getProductionOrderNavKey(op: {
  productionDate: string | null;
  sectorId: string;
  lineId: string;
  scheduleId: string | null;
}): string {
  return [
    op.productionDate ?? "sem-data",
    op.sectorId,
    op.lineId,
    op.scheduleId ?? "sem-schedule",
  ].join("|");
}
