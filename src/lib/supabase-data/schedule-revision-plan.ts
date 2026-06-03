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
