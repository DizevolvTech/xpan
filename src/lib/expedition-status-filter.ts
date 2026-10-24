/**
 * Filtro de status das telas de Expedição e Entregas (reunião 22/10, bloco 1).
 *
 * Por padrão só as pendências: pedido entregue ou cancelado sai da lista e fica no
 * "Ver histórico". Mesma regra das listas de OP e pedidos (`list-status-filter`).
 */

export const EXPEDITION_STATUS_FILTER_OPTIONS = [
  { value: "em_espera", label: "Em espera" },
  { value: "agendado", label: "Agendado" },
  { value: "em_producao", label: "Em produção" },
  { value: "aguardando_expedicao", label: "Aguardando expedição" },
  { value: "pronto_coleta", label: "Pronto para coleta" },
  { value: "em_rota", label: "Em rota" },
  { value: "no_destino", label: "No destino" },
  { value: "tentativa_falha", label: "Tentativa falha" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

export const EXPEDITION_FINAL_STATUSES = ["entregue", "cancelado"] as const;

export const EXPEDITION_VALID_STATUSES = EXPEDITION_STATUS_FILTER_OPTIONS.map((option) => option.value);

export const DELIVERY_STATUS_FILTER_OPTIONS = [
  { value: "aguardando_expedicao", label: "Aguardando expedição" },
  { value: "pronto_coleta", label: "Pronto para coleta" },
  { value: "em_rota", label: "Em rota" },
  { value: "no_destino", label: "No destino" },
  { value: "tentativa_falha", label: "Tentativa falha" },
  { value: "entregue", label: "Entregue" },
];

export const DELIVERY_FINAL_STATUSES = ["entregue"] as const;

export const DELIVERY_VALID_STATUSES = DELIVERY_STATUS_FILTER_OPTIONS.map((option) => option.value);

/**
 * Coluna "Em rota" da Visão Geral: só o que ainda está na rua. Entregue (e qualquer outro
 * status final) sai da visão; quem quiser consultar vai ao histórico da Expedição.
 */
export function isInFieldDeliveryStatus(executionStatus: string): boolean {
  return (
    executionStatus === "pronto_coleta" ||
    executionStatus === "em_rota" ||
    executionStatus === "no_destino" ||
    executionStatus === "tentativa_falha"
  );
}
