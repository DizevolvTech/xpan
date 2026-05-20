import type { ProductionIngredient, ProductionProduct } from "@/lib/production-planning";
import { getProductRecipeTotalsFromData } from "@/lib/production-data-utils";
import { normalizeProductPreparationStages } from "@/lib/production-workflow";

import type { PlannedOrderItem } from "./types";

/**
 * Profundidade máxima da expansão recursiva. Salvaguarda contra ciclos de receita
 * (MPI A → MPI B → MPI A) — o banco não previne ciclos (sem CHECK constraint),
 * então o motor é a última linha de defesa. Cobre casos realistas de até 4 níveis
 * (produto → MPI → sub-MPI → sub-sub-MPI). Acima disso é sintoma de cadastro inválido.
 */
const MAX_EXPANSION_DEPTH = 4;

export interface ExpandRecipeOptions {
  /** Profundidade máxima. Default = MAX_EXPANSION_DEPTH (4). */
  maxDepth?: number;
  /**
   * Logger opcional para warnings de ciclo / profundidade máxima atingida.
   * Default: console.warn. Em testes, injetar para capturar sem poluir stdout.
   */
  onWarn?: (message: string) => void;
}

/**
 * Expande sub-receita produto-MPI em itens planejados adicionais.
 *
 * **Regra (Decisão 1 do ADR_expansao_mpi_em_op):** Só expandimos referências de
 * receita com `sourceType='produto'` cujo produto-fonte tem `canBeIngredient=true`.
 * Ingrediente do tipo `misturado` continua sendo expandido só no PDF de pré-pesagem.
 *
 * **Herança de planning key (Decisão 3):** O item MPI herda `productionDate`,
 * `lineId`, `sectorId`, `scheduleId` do produto-pai. Como o agrupamento em
 * `buildProductionOrdersFromPlannedItems` é por `(planningKey, productId)` e o
 * `productId` do MPI é distinto do pai, múltiplos pais consumindo o mesmo MPI
 * automaticamente viram **uma única OP** somando a demanda — sem trabalho extra.
 *
 * **Lead time (Decisão 2):** zero. Fase 1 mínima — MPI produzido no mesmo dia do pai.
 *
 * **Limitação conhecida:** a OP de MPI roda na linha/setor/schedule do produto-pai
 * (não na linha "nativa" do MPI). Aceita na fase 1; refinamento fica para onda 2.
 *
 * @param plannedItems Itens já planejados pelo motor (output de `buildPlannedItems`).
 * @param productsById Lookup de produtos para resolver `recipe.sourceId`.
 * @param ingredients Lista de ingredientes (para `scaleRecipeQuantity`).
 * @param products Lista completa de produtos (para `scaleRecipeQuantity`).
 * @param options Opções (profundidade máx, logger).
 * @returns Lista contendo os itens originais + os itens expandidos de MPI.
 */
export function expandRecipeIntoItems(
  plannedItems: PlannedOrderItem[],
  productsById: Map<string, ProductionProduct>,
  ingredients: ProductionIngredient[],
  products: ProductionProduct[],
  options: ExpandRecipeOptions = {},
): PlannedOrderItem[] {
  const maxDepth = options.maxDepth ?? MAX_EXPANSION_DEPTH;
  const warn = options.onWarn ?? ((message) => console.warn(message));

  const expanded: PlannedOrderItem[] = [];
  let mpiSequence = 0;

  for (const baseItem of plannedItems) {
    const visited = new Set<string>([baseItem.productId]);
    expandFromParent(baseItem, baseItem, 1);

    function expandFromParent(parent: PlannedOrderItem, originItem: PlannedOrderItem, depth: number) {
      if (depth > maxDepth) {
        warn(
          `[recipe-expansion] profundidade máxima (${maxDepth}) atingida ao expandir ` +
            `produto ${originItem.productId} via ${parent.productId}; expansão abortada para este ramo.`,
        );
        return;
      }

      const parentProduct = productsById.get(parent.productId);
      if (!parentProduct || parentProduct.recipe.length === 0) {
        return;
      }

      for (const recipeRef of parentProduct.recipe) {
        if (recipeRef.sourceType !== "produto") continue;
        const mpiProduct = productsById.get(recipeRef.sourceId);
        if (!mpiProduct || !mpiProduct.canBeIngredient) continue;

        if (visited.has(mpiProduct.id)) {
          warn(
            `[recipe-expansion] ciclo detectado: produto ${originItem.productId} → ${parent.productId} ` +
              `→ ${mpiProduct.id} (já visitado); ramo abortado.`,
          );
          continue;
        }
        visited.add(mpiProduct.id);

        const mpiItem = buildMpiPlannedItem({
          parent,
          originItem,
          mpiProduct,
          parentProduct,
          recipeQuantity: recipeRef.quantity,
          ingredients,
          products,
          sequence: ++mpiSequence,
        });
        expanded.push(mpiItem);

        // Recursão: MPI pode consumir outro MPI (ex. massa → fermento natural).
        expandFromParent(mpiItem, originItem, depth + 1);

        visited.delete(mpiProduct.id);
      }
    }
  }

  return [...plannedItems, ...expanded];
}

function buildMpiPlannedItem(params: {
  parent: PlannedOrderItem;
  originItem: PlannedOrderItem;
  mpiProduct: ProductionProduct;
  parentProduct: ProductionProduct;
  recipeQuantity: number;
  ingredients: ProductionIngredient[];
  products: ProductionProduct[];
  sequence: number;
}): PlannedOrderItem {
  const { parent, originItem, mpiProduct, parentProduct, recipeQuantity, ingredients, products, sequence } = params;

  // Quantidade de MPI necessária para produzir `parent.internalKg` do pai.
  const requestedQuantity = scaleRecipeQuantity(parent.internalKg, parentProduct, ingredients, products, recipeQuantity);
  // MPI é trabalhado em kg internamente. `internalKg` = requestedQuantity (já em kg pela receita).
  const internalKg = requestedQuantity;

  const productionItemKey = parent.productionDate
    ? [parent.productionDate, parent.lineId, parent.scheduleId ?? "sem-linha", mpiProduct.id].join("|")
    : null;

  return {
    id: `mpi:${mpiProduct.id}:${originItem.id}:${sequence}`,
    orderId: parent.orderId,
    orderCode: parent.orderCode,
    storeId: parent.storeId,
    storeName: parent.storeName,
    orderedAt: parent.orderedAt,
    baseDate: parent.baseDate,
    deliveryDate: parent.deliveryDate,
    saleDate: parent.saleDate,
    productionDate: parent.productionDate,
    delayed: parent.delayed,
    productId: mpiProduct.id,
    productCode: mpiProduct.code,
    productName: mpiProduct.name,
    lineId: parent.lineId,
    lineName: parent.lineName,
    sectorId: parent.sectorId,
    sectorName: parent.sectorName,
    scheduleId: parent.scheduleId,
    scheduleCode: parent.scheduleCode,
    scheduleName: parent.scheduleName,
    requestedQuantity,
    requestedUnit: mpiProduct.productionUnit,
    internalKg,
    expeditionUnit: mpiProduct.expeditionUnit,
    expeditionQuantityRaw: internalKg,
    expeditionQuantity: internalKg,
    canPlan: parent.canPlan,
    scheduleDayPriority: parent.scheduleDayPriority,
    availableForRelease: parent.availableForRelease,
    releasedToProduction: parent.releasedToProduction,
    productionItemKey,
    productionItemStatus: parent.canPlan ? "nao_iniciado" : null,
    preparationStages: normalizeProductPreparationStages(mpiProduct.preparationStages),
    workflowProgress: 0,
    opCode: null,
    status: parent.status,
  } satisfies PlannedOrderItem;
}

/**
 * Arredondamento padrão da camada de planejamento — 3 casas, em `Number` (não string).
 * Centralizado aqui porque `scaleRecipeQuantity` (e a expansão de receita) dependem dele,
 * e o helper foi historicamente duplicado em `printing-documents.ts`.
 */
export function round3(value: number) {
  return Number(value.toFixed(3));
}

/**
 * Dado um produto e uma quantidade de receita "nominal" (a registrada no cadastro),
 * retorna a quantidade real necessária para produzir `outputKg` kg do produto.
 *
 * Reusa `getProductRecipeTotalsFromData` para identificar o output base da receita
 * (`outputAfterBreakKg` ou, em fallback, o somatório de ingredientes em kg).
 *
 * Comportamento de borda preservado da versão anterior (em `printing-documents.ts`):
 * - sem produto → retorna a quantidade nominal sem escalar.
 * - output base ≤ 0 → retorna a quantidade nominal (evita divisão por zero).
 */
export function scaleRecipeQuantity(
  outputKg: number,
  product: ProductionProduct | undefined,
  ingredients: ProductionIngredient[],
  products: ProductionProduct[],
  quantity: number,
) {
  if (!product) {
    return round3(quantity);
  }

  const totals = getProductRecipeTotalsFromData(product, ingredients, products);
  const baseOutputKg = totals.outputAfterBreakKg > 0 ? totals.outputAfterBreakKg : totals.totalIngredientsKg;

  if (baseOutputKg <= 0) {
    return round3(quantity);
  }

  return round3((outputKg / baseOutputKg) * quantity);
}
