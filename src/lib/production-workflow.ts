import type { ProductionItemStatus } from "@/lib/order-planning";
import {
  defaultProductPreparationStages,
  productPreparationStageLabels,
  type ProductPreparationStageKey,
} from "@/lib/production-planning";

const PREPARATION_STAGE_SET = new Set<ProductPreparationStageKey>(defaultProductPreparationStages);

const PRODUCTION_STATUS_LABELS: Record<ProductionItemStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_preparacao: productPreparationStageLabels.em_preparacao,
  em_producao: productPreparationStageLabels.em_producao,
  em_forno: productPreparationStageLabels.em_forno,
  embalando: productPreparationStageLabels.embalando,
  concluido: "Concluído",
};

const NEXT_ACTION_LABELS: Record<ProductionItemStatus, string> = {
  nao_iniciado: "",
  em_preparacao: "Iniciar preparação",
  em_producao: "Iniciar produção",
  em_forno: "Enviar para forno",
  embalando: "Iniciar embalagem",
  concluido: "Marcar como concluído",
};

const PREVIOUS_ACTION_LABELS: Record<ProductionItemStatus, string> = {
  nao_iniciado: "Voltar para não iniciado",
  em_preparacao: "Voltar para preparação",
  em_producao: "Voltar para produção",
  em_forno: "Voltar para forno",
  embalando: "Voltar para embalagem",
  concluido: "",
};

export function normalizeProductPreparationStages(
  stages?: ProductPreparationStageKey[] | null,
): ProductPreparationStageKey[] {
  const normalized = (stages ?? []).filter(
    (stage, index, all): stage is ProductPreparationStageKey =>
      PREPARATION_STAGE_SET.has(stage) && all.indexOf(stage) === index,
  );

  return normalized.length > 0 ? normalized : [...defaultProductPreparationStages];
}

export function buildProductionStatusFlow(
  stages?: ProductPreparationStageKey[] | null,
): ProductionItemStatus[] {
  return ["nao_iniciado", ...normalizeProductPreparationStages(stages), "concluido"];
}

// Etapas que pertencem ao PRODUTO FINAL, não a um insumo/base: forno e embalagem. Uma base
// (mistura/MPI) é preparada e produzida (misturada) e então consumida — quem vai ao forno e
// é embalado é o produto final feito com ela.
const FINAL_PRODUCT_ONLY_STAGES = new Set<ProductPreparationStageKey>(["em_forno", "embalando"]);

/**
 * Etapas de um item INTERMEDIÁRIO (base/insumo/MPI): só os passos produtivos (preparar +
 * produzir/misturar), SEM forno nem embalagem — a base é consumida no produto final. Por
 * isso ela vai do último passo produtivo direto para concluído. Fallback para "em_producao"
 * se sobrar vazio (algo tem de ser produzido).
 */
export function intermediatePreparationStages(
  stages?: ProductPreparationStageKey[] | null,
): ProductPreparationStageKey[] {
  const productive = normalizeProductPreparationStages(stages).filter(
    (stage) => !FINAL_PRODUCT_ONLY_STAGES.has(stage),
  );
  return productive.length > 0 ? productive : ["em_producao"];
}

const GLOBAL_STATUS_ORDER: ProductionItemStatus[] = [
  "nao_iniciado",
  "em_preparacao",
  "em_producao",
  "em_forno",
  "embalando",
  "concluido",
];

function globalStatusRank(status: ProductionItemStatus): number {
  const index = GLOBAL_STATUS_ORDER.indexOf(status);
  return index < 0 ? 0 : index;
}

/**
 * Se o status PERSISTIDO não existe mais no fluxo do item (ex.: uma base foi avançada para
 * `em_forno`/`embalando` sob o fluxo antigo, e agora o insumo não tem esses passos), mapeia
 * para o passo VÁLIDO mais avançado cujo rank não ultrapassa o do status atual. Assim o item
 * legado continua operável (progride e conclui) sem exigir migração de dados por tenant. Para
 * status que já estão no fluxo é no-op — não afeta itens normais.
 */
export function clampStatusToFlow(
  status: ProductionItemStatus,
  flow: ProductionItemStatus[],
): ProductionItemStatus {
  if (flow.includes(status)) {
    return status;
  }
  const rank = globalStatusRank(status);
  const candidates = flow.filter((entry) => globalStatusRank(entry) <= rank);
  if (candidates.length === 0) {
    return flow[0];
  }
  return candidates.reduce((best, entry) =>
    globalStatusRank(entry) > globalStatusRank(best) ? entry : best,
  );
}

export function getProductionStatusLabel(status: ProductionItemStatus) {
  return PRODUCTION_STATUS_LABELS[status];
}

export function getNextProductionActionLabel(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const nextStatus = getNextProductionItemStatus(status, stages);
  return nextStatus ? NEXT_ACTION_LABELS[nextStatus] : null;
}

export function getPreviousProductionActionLabel(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const previousStatus = getPreviousProductionItemStatus(status, stages);
  return previousStatus ? PREVIOUS_ACTION_LABELS[previousStatus] : null;
}

export function canTransitionProductionItemStatus(
  currentStatus: ProductionItemStatus,
  nextStatus: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  if (currentStatus === nextStatus) {
    return true;
  }

  const flow = buildProductionStatusFlow(stages);
  // Status legado fora do fluxo (ex.: base em `em_forno` após tirarmos o forno) é grampeado
  // para o passo válido mais próximo — assim ela ainda consegue concluir.
  const currentIndex = flow.indexOf(clampStatusToFlow(currentStatus, flow));
  const nextIndex = flow.indexOf(nextStatus);

  if (currentIndex < 0 || nextIndex < 0) {
    return false;
  }

  return Math.abs(nextIndex - currentIndex) === 1;
}

export function getNextProductionItemStatus(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const flow = buildProductionStatusFlow(stages);
  const currentIndex = flow.indexOf(clampStatusToFlow(status, flow));
  if (currentIndex < 0 || currentIndex >= flow.length - 1) {
    return null;
  }

  return flow[currentIndex + 1];
}

export function getPreviousProductionItemStatus(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const flow = buildProductionStatusFlow(stages);
  const currentIndex = flow.indexOf(clampStatusToFlow(status, flow));
  if (currentIndex <= 0) {
    return null;
  }

  return flow[currentIndex - 1];
}

export function getProductionStatusProgress(
  status: ProductionItemStatus,
  stages?: ProductPreparationStageKey[] | null,
) {
  const flow = buildProductionStatusFlow(stages);
  const currentIndex = flow.indexOf(clampStatusToFlow(status, flow));
  if (currentIndex <= 0) {
    return 0;
  }
  if (currentIndex >= flow.length - 1) {
    return 100;
  }

  return Number(((currentIndex / (flow.length - 1)) * 100).toFixed(1));
}
