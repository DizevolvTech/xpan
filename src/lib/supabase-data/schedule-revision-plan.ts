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
}

export interface ScheduleRevisionRebuildImpact {
  affectedPendingRevisions: number;
  affectedProducts: number;
  recreated: boolean;
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

  return {
    reuseScheduleLineId,
    staleScheduleLineIds,
    // Reaproveitando a pendente, o ativo já foi desativado quando ela nasceu;
    // só desativamos ao abrir uma revisão nova.
    deactivateActiveScheduleId: recreated ? input.activeScheduleId : null,
    recreated,
    impact: {
      affectedPendingRevisions: input.pendingSchedules.length,
      affectedProducts: input.productCount,
      recreated,
    },
  };
}
