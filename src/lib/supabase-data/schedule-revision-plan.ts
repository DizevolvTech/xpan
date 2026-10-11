/* -------------------------------------------------------------------------------------------------
 * AJ-0025 — Plano de reconstrução da revisão pendente do cronograma (lógica pura, testável).
 *
 * Antes: ao editar um produto, `rebuildPendingScheduleRevisionForSubcategoryDbId` deletava a
 * revisão pendente e recriava outra com `legacy_id` novo. Como o id da revisão entra no
 * planning_key (`productionDate|sectorId|lineId|scheduleId`), recriar mudava a chave e órfã as
 * OPs/statuses já persistidos — "editar receita zera o cronograma silenciosamente".
 *
 * Agora: reaproveitamos a revisão pendente existente (id estável). Só recriamos quando NÃO há
 * pendente (aí o cronograma ativo é desativado para nova auditoria) e devolvemos metadados do
 * impacto para a UI avisar o usuário.
 *
 * Mantido em módulo separado (sem `server-only`) para ser testável em `tsx --test`.
 * -----------------------------------------------------------------------------------------------*/

export interface ScheduleRevisionRebuildInput {
  /** Revisões com status `pendente` da subcategoria (cada uma com seu created_at). */
  pendingSchedules: Array<{ id: string; created_at: string }>;
  /** Id da revisão `ativo` corrente, se houver. */
  activeScheduleId: string | null;
  /** Quantidade de produtos operacionais que entrarão no snapshot da revisão. */
  productCount: number;
  /**
   * AJ-A5: quando há trabalho comprometido na LINHA do cronograma ativo (OPs já
   * liberadas/lançadas/iniciadas), NÃO desativar o ativo ao abrir uma revisão
   * nova — desativar orfanaria as OPs do Chão e reverteria pedidos liberados
   * para `em_espera`. Mantemos o ativo VIVO até a auditoria aprovar a revisão.
   * Default `false` (comportamento legado: recriação desativa o ativo).
   */
  preserveActiveSchedule?: boolean;
}

export interface ScheduleRevisionRebuildImpact {
  affectedPendingRevisions: number;
  affectedProducts: number;
  recreated: boolean;
  /**
   * AJ-A5: `true` quando uma revisão nova foi aberta (recreated) MAS o
   * cronograma ativo foi PRESERVADO por haver trabalho comprometido. A UI/log
   * pode avisar que a auditoria está pendente sem que o cronograma tenha sido
   * zerado. `false` no caminho legado (reuso ou recriação que desativa o ativo).
   */
  activeScheduleKept: boolean;
  /**
   * Simplificação do cronograma: o que aconteceu com a revisão aberta pela edição.
   * - `activated`: entrou em vigor sozinha (linha sem ordens em andamento);
   * - `awaiting_confirmation`: há ordens em andamento — o ativo foi mantido e falta UMA confirmação;
   * - `pending`: ficou pendente (sem produtos ou produto sem dia de produção).
   * Ausente = comportamento legado (testes antigos / chamadas que não passam pela decisão).
   */
  outcome?: "activated" | "awaiting_confirmation" | "pending";
  /** Motivo da decisão (ver `decideScheduleActivation`). */
  outcomeReason?: ScheduleActivationReason;
  /** Revisão alvo (id do banco) e seu código, para a UI confirmar/abrir. */
  scheduleLineId?: string;
  scheduleCode?: string;
  /** Preenchido no agregado de `updateProduct`: todas as revisões que aguardam a confirmação. */
  scheduleIdsAwaitingConfirmation?: string[];
}

export interface ScheduleRevisionRebuildPlan {
  /** Revisão pendente a reaproveitar (id estável). `null` => criar uma nova. */
  reuseScheduleLineId: string | null;
  /** Pendentes excedentes a remover (consolidação para uma única revisão pendente). */
  staleScheduleLineIds: string[];
  /** Cronograma ativo a desativar — só quando recriamos (nova auditoria necessária). */
  deactivateActiveScheduleId: string | null;
  /** `true` quando precisamos abrir uma revisão nova (não havia pendente). */
  recreated: boolean;
  impact: ScheduleRevisionRebuildImpact;
}

export function planScheduleRevisionRebuild(
  input: ScheduleRevisionRebuildInput,
): ScheduleRevisionRebuildPlan {
  const sortedPending = [...input.pendingSchedules].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
  const reuseScheduleLineId = sortedPending[0]?.id ?? null;
  const staleScheduleLineIds = sortedPending.slice(1).map((row) => row.id);
  const recreated = reuseScheduleLineId === null;

  // AJ-A5: ao recriar (sem pendente) com trabalho comprometido na linha,
  // PRESERVAMOS o ativo — não o desativamos — para não orfanar OPs lançadas
  // nem reverter pedidos liberados. A revisão pendente continua sendo aberta
  // (recreated=true) para a re-auditoria; só a desativação é suprimida.
  const preserveActiveSchedule = input.preserveActiveSchedule === true;
  const deactivateActiveScheduleId =
    recreated && !preserveActiveSchedule ? input.activeScheduleId : null;
  const activeScheduleKept = recreated && preserveActiveSchedule && input.activeScheduleId !== null;

  return {
    reuseScheduleLineId,
    staleScheduleLineIds,
    // Reaproveitando a pendente, o ativo já foi desativado quando ela nasceu;
    // só desativamos ao abrir uma revisão nova E sem trabalho comprometido.
    deactivateActiveScheduleId,
    recreated,
    impact: {
      affectedPendingRevisions: input.pendingSchedules.length,
      affectedProducts: input.productCount,
      recreated,
      activeScheduleKept,
    },
  };
}

/* -------------------------------------------------------------------------------------------------
 * Simplificação do cronograma (11/10/2026) — decisão de ativação da revisão pendente.
 *
 * Antes: toda mudança no produto abria uma revisão PENDENTE e o gestor precisava abrir a tela
 * "Auditoria do cronograma ativo" e aprovar. Agora a revisão entra em vigor sozinha, salvo
 * quando isso orfanaria trabalho já comprometido (AJ-A5) ou a grade estiver incompleta.
 *
 * Regra (aprovada pelo Lucas):
 *  - sem OP liberada/lançada/iniciada na linha → ativa direto;
 *  - com trabalho comprometido → mantém o ativo vivo e pede UMA confirmação, na própria tela do
 *    produto ("aplicar ao cronograma"), sem passar pela tela de auditoria;
 *  - sem produtos, ou produto sem dia de produção → fica pendente (a trava de aprovação já
 *    existente continua valendo; nada é ativado "pela metade").
 * -----------------------------------------------------------------------------------------------*/

export type ScheduleActivationAction = "activate" | "await_confirmation" | "keep_pending";

export type ScheduleActivationReason =
  | "no_committed_work"
  | "committed_work"
  | "no_products"
  | "product_without_day";

export interface ScheduleActivationInput {
  /** Há OP lançada/iniciada ou pedido liberado na linha executora (AJ-A5). */
  hasCommittedWork: boolean;
  /** Dias de produção de cada item da revisão. */
  itemProductionDays: ReadonlyArray<ReadonlyArray<string>>;
}

export interface ScheduleActivationDecision {
  action: ScheduleActivationAction;
  reason: ScheduleActivationReason;
}

export function decideScheduleActivation(input: ScheduleActivationInput): ScheduleActivationDecision {
  if (input.itemProductionDays.length === 0) {
    return { action: "keep_pending", reason: "no_products" };
  }
  if (input.itemProductionDays.some((days) => days.length === 0)) {
    return { action: "keep_pending", reason: "product_without_day" };
  }
  if (input.hasCommittedWork) {
    return { action: "await_confirmation", reason: "committed_work" };
  }
  return { action: "activate", reason: "no_committed_work" };
}

/** Eventos do histórico do cronograma (tabela `schedule_line_events`). */
export const scheduleEventTypes = [
  "revisao_aberta",
  "ativado_automatico",
  "aprovado",
  "confirmado_com_ordens_em_andamento",
  "devolvido_ajuste",
  "desativado",
  "reativado",
  "prioridades_atualizadas",
] as const;

export type ScheduleEventType = (typeof scheduleEventTypes)[number];

export const scheduleEventLabels: Record<ScheduleEventType, string> = {
  revisao_aberta: "Revisão aberta",
  ativado_automatico: "Ativado automaticamente",
  aprovado: "Aprovado e ativado",
  confirmado_com_ordens_em_andamento: "Aplicado com ordens em andamento",
  devolvido_ajuste: "Devolvido para ajuste",
  desativado: "Desativado",
  reativado: "Reativado",
  prioridades_atualizadas: "Prioridades atualizadas",
};

/** Evento gravado quando o gestor muda o status pela tela do cronograma. */
export function scheduleEventForStatusChange(
  previousStatus: "pendente" | "ativo" | "inativo",
  nextStatus: "pendente" | "ativo" | "inativo",
  prioritiesChanged: boolean,
): ScheduleEventType | null {
  if (nextStatus === "ativo") return previousStatus === "inativo" ? "reativado" : "aprovado";
  if (nextStatus === "inativo") return previousStatus === "pendente" ? "devolvido_ajuste" : "desativado";
  // nextStatus === "pendente": só registra quando algo mudou de fato
  return prioritiesChanged ? "prioridades_atualizadas" : null;
}
