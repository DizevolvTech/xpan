export type OrderReleaseValidationReason =
  | "order_cancelled"
  | "order_not_planned"
  | "order_not_releasable"
  // A10: pedido sem itens (vazio) — `[].every()` é `true`, então sem esta guarda
  // explícita um pedido vazio passaria na validação e geraria um release fantasma.
  | "order_empty"
  // FASE 2 (blindagem): o id não corresponde a um pedido real (slot de esqueleto
  // do cronograma, qtd 0). Liberar isso criaria um release órfão.
  | "order_not_real";

/**
 * FASE 2 — prefixo dos ids do esqueleto do cronograma (`skeleton:<schedule.id>`
 * no orderId, `skeleton:<productionItemKey>` no item id). Um id com este prefixo
 * NUNCA é um pedido real: é só visão de planejamento.
 */
export const SKELETON_ID_PREFIX = "skeleton:";

/** Um id (orderId/itemId) é de esqueleto do cronograma — não é pedido real. */
export function isSkeletonOrderId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(SKELETON_ID_PREFIX);
}

export class OrderReleaseValidationError extends Error {
  readonly reason: OrderReleaseValidationReason;

  constructor(reason: OrderReleaseValidationReason, message: string) {
    // O route handler em /api/factory-planning/workflow detecta a palavra
    // "invalid" para devolver 400 — manter o prefixo.
    super(`Invalid release: ${message}`);
    this.name = "OrderReleaseValidationError";
    this.reason = reason;
  }
}

export interface OrderRowForValidation {
  id: string;
  legacy_id: string | null;
  management_status: string;
}

export interface PlanningSnapshotForValidation {
  orders: Array<{ id: string; availableForRelease: boolean; itemsCount?: number }>;
}

export function assertPlanningAllowsRelease(
  orderRow: OrderRowForValidation,
  planning: PlanningSnapshotForValidation,
  orderInputId: string,
): { ok: true } | { ok: false; error: OrderReleaseValidationError } {
  if (orderRow.management_status === "cancelado") {
    return {
      ok: false,
      error: new OrderReleaseValidationError(
        "order_cancelled",
        "pedido cancelado não pode ser liberado para produção.",
      ),
    };
  }

  // A engine usa legacy_id como id estável; o parâmetro pode chegar como
  // uuid (DB) ou legacy. Cobrir as três formas.
  const planningId = orderRow.legacy_id ?? orderRow.id;
  const planningRow =
    planning.orders.find((row) => row.id === planningId) ??
    planning.orders.find((row) => row.id === orderRow.id) ??
    planning.orders.find((row) => row.id === orderInputId);

  if (!planningRow) {
    return {
      ok: false,
      error: new OrderReleaseValidationError(
        "order_not_planned",
        "pedido não aparece no planejamento da fábrica para hoje (verifique janela operacional, itens, sub-receita / MPI).",
      ),
    };
  }

  // A10: pedido vazio (0 itens) — rejeição explícita. `availableForRelease` já é
  // `false` para pedido vazio no motor, mas a mensagem genérica de "item sem produção
  // planejável" confundiria; aqui damos o motivo real.
  if (planningRow.itemsCount === 0) {
    return {
      ok: false,
      error: new OrderReleaseValidationError(
        "order_empty",
        "Pedido sem itens não pode ser liberado para produção.",
      ),
    };
  }

  if (!planningRow.availableForRelease) {
    return {
      ok: false,
      error: new OrderReleaseValidationError(
        "order_not_releasable",
        "pedido contém item(ns) sem produção planejável hoje — capacidade ou data inviável.",
      ),
    };
  }

  return { ok: true };
}
