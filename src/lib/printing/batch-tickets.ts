import type { PrintIngredientRow, PreWeighingProductSection, ProductIngredientSection, ProductionSheetDocument } from "@/lib/printing-documents";
import type { RecipeStageConfigEntry } from "@/lib/production-planning";
import type { PreWeighBatchSplit } from "@/lib/production-batches";

/**
 * Cartão #237 (5.2): uma OP POR BATIDA nas três saídas (80 mm, pré-pesagem A4, produção A4).
 * Uma seção (produto ou MPI) vira N "fichas": cheias, depois cada parcial (inclusive as parciais do
 * MPI), cada uma com os insumos já na quantidade DAQUELA batida. É a mesma conta que a 80 mm
 * sempre fez — extraída para a A4 não ter uma segunda matemática.
 */
export type BatchSectionInput = {
  kind: "ingredient" | "product";
  productId: string;
  productCode: string;
  productName: string;
  /** Quantidade da OP inteira na unidade `unit` (não batida: a própria; batida: ver `batchSplit`). */
  quantity: number;
  unit: string;
  /** Massa da seção inteira (kg) — vira a massa da ficha quando o produto não é batido. */
  kg: number;
  /** Peso da unidade (kg) — só produto; o MPI não tem. */
  unitWeightKg?: number;
  rawBlockWeightG?: number | null;
  /** Só MPI: quem consome (cabeçalho "Usado por") e o rótulo da etapa em que é consumido. */
  usedBy?: string[];
  stageLabel?: string | null;
  batchSplit: PreWeighBatchSplit | null;
  recipeStageConfig?: RecipeStageConfigEntry[];
  items: PrintIngredientRow[];
};

export type BatchTicket = {
  key: string;
  /** Código lido pelo QR/código de barras. */
  barcode: string;
  kind: "ingredient" | "product";
  productId: string;
  productCode: string;
  productName: string;
  /** 1-based, e o total de batidas DESTA seção. */
  number: number;
  count: number;
  /** Quantidade só desta batida (rendimento previsto) e a unidade dela. */
  quantity: number;
  unit: string;
  totalQuantity: number;
  complementary: boolean;
  /** Massa de saída desta batida (kg). */
  batchKg: number;
  unitWeightKg: number | null;
  rawBlockWeightG?: number | null;
  usedBy?: string[];
  stageLabel?: string | null;
  recipeStageConfig?: RecipeStageConfigEntry[];
  items: PrintIngredientRow[];
};

export function buildBatchTicketCode(opCode: string, sectionIndex: number, sectionCount: number, batchNumber: number) {
  // O código da OP já nasce com "OP-" (OP-261013-001); a planilha do cliente mostra "OP260902011".
  const compact = opCode.replace(/[^0-9A-Za-z]/g, "");
  const base = /^OP/i.test(compact) ? `OP${compact.slice(2)}` : `OP${compact}`;
  const section = sectionCount > 1 ? `-P${sectionIndex + 1}` : "";
  return `${base}${section}-B${String(batchNumber).padStart(2, "0")}`;
}

export function buildBatchTickets(sections: BatchSectionInput[], opCode = ""): BatchTicket[] {
  return sections.flatMap((section, sectionIndex) => {
    const split = section.batchSplit;
    const batches = split?.batched
      ? [
          ...Array.from({ length: split.fullBatchCount }, () => ({
            quantity: split.fullBatchUnits,
            kg: split.fullBatchKg,
            complementary: false,
            partialIndex: -1,
          })),
          // Cartão #42: com mínimo por batida pode haver várias parciais (9 + 9 + 6 + 4).
          ...(split.partials ?? []).flatMap((partial, partialIndex) =>
            Array.from({ length: partial.count }, () => ({
              quantity: partial.units,
              kg: partial.kg,
              complementary: true,
              partialIndex,
            })),
          ),
        ]
      : [{ quantity: section.quantity, kg: section.kg, complementary: false, partialIndex: -1 }];

    const tickets = batches.map((batch, index): BatchTicket => ({
      key: `${sectionIndex + 1}-B${String(index + 1).padStart(2, "0")}`,
      barcode: buildBatchTicketCode(opCode, sectionIndex, sections.length, index + 1),
      kind: section.kind,
      productId: section.productId,
      productCode: section.productCode,
      productName: section.productName,
      number: index + 1,
      count: batches.length,
      quantity: batch.quantity,
      totalQuantity: split?.batched ? split.totalUnits : section.quantity,
      unit: split?.batched ? split.unitLabel : section.unit,
      complementary: batch.complementary,
      batchKg: batch.kg,
      unitWeightKg: section.unitWeightKg ?? null,
      rawBlockWeightG: section.rawBlockWeightG,
      ...(section.usedBy ? { usedBy: section.usedBy } : {}),
      ...(section.stageLabel !== undefined ? { stageLabel: section.stageLabel } : {}),
      recipeStageConfig: section.recipeStageConfig,
      items: section.items.map((row): PrintIngredientRow => ({
        ...row,
        estimatedQuantity: split?.batched
          ? (batch.complementary
              ? row.partialQuantities?.[batch.partialIndex] ?? row.partialQuantity
              : row.batchQuantity) ?? (row.estimatedQuantity * batch.quantity) / split.totalUnits
          : row.estimatedQuantity,
      })),
    }));

    // Cartão #236: a soma das batidas fecha com a quantidade da linha ao grama — o resto de
    // arredondamento (cada batida arredondada em 3 casas) vai para a ÚLTIMA batida.
    if (split?.batched && tickets.length > 1) {
      const last = tickets[tickets.length - 1];
      section.items.forEach((row, rowIndex) => {
        const sum = tickets.reduce((total, ticket) => total + ticket.items[rowIndex].estimatedQuantity, 0);
        const residue = Math.round((row.estimatedQuantity - sum) * 1000) / 1000;
        if (residue !== 0) {
          last.items[rowIndex].estimatedQuantity =
            Math.round((last.items[rowIndex].estimatedQuantity + residue) * 1000) / 1000;
        }
      });
    }
    return tickets;
  });
}

function mpiSectionInput(section: ProductIngredientSection, items: PrintIngredientRow[]): BatchSectionInput {
  return {
    kind: "ingredient",
    productId: section.productId,
    productCode: section.productCode,
    productName: section.productName,
    quantity: section.requiredQuantity,
    unit: section.requiredUnit,
    kg: section.requiredKg,
    rawBlockWeightG: section.rawBlockWeightG,
    usedBy: section.usedBy,
    stageLabel: section.stageLabel,
    batchSplit: section.batchSplit,
    recipeStageConfig: section.recipeStageConfig,
    items,
  };
}

/** Linhas base primeiro e as "adicionais" depois (marcadas), como a tabela A4 sempre fez. */
export function orderRowsBaseThenAdditional(
  base: PrintIngredientRow[],
  additional: PrintIngredientRow[],
): PrintIngredientRow[] {
  return [...base, ...additional.map((row) => ({ ...row, isAdditional: true }))];
}

/** Seções da PRÉ-PESAGEM: MPI primeiro (batido uma vez por batida dele), depois os produtos. */
export function buildPreWeighingBatchSections(document: {
  ingredientProducts: ProductIngredientSection[];
  productSections: PreWeighingProductSection[];
}): BatchSectionInput[] {
  return [
    ...document.ingredientProducts.map((section) => mpiSectionInput(section, section.items)),
    ...document.productSections.map((section): BatchSectionInput => ({
      kind: "product",
      productId: section.productId,
      productCode: section.productCode,
      productName: section.productName,
      quantity: section.requestedQuantity,
      unit: section.requestedUnit,
      kg: section.plannedKg,
      unitWeightKg: section.unitWeightKg,
      rawBlockWeightG: section.rawBlockWeightG,
      batchSplit: section.batchSplit,
      recipeStageConfig: section.recipeStageConfig,
      items: orderRowsBaseThenAdditional(section.baseIngredients, section.additionalIngredients),
    })),
  ];
}

/** Seções da FOLHA DE PRODUÇÃO (A4 e 80 mm): mesma ordem da pré-pesagem. */
export function buildProductionBatchSections(document: ProductionSheetDocument): BatchSectionInput[] {
  return [
    ...document.ingredientSections.map((section) => mpiSectionInput(section, section.items)),
    ...document.productSections.map((section): BatchSectionInput => ({
      kind: "product",
      productId: section.productId,
      productCode: section.productCode,
      productName: section.productName,
      quantity: section.requestedQuantity,
      unit: section.requestedUnit,
      kg: section.plannedKg,
      unitWeightKg: section.unitWeightKg,
      rawBlockWeightG: section.rawBlockWeightG,
      batchSplit: section.batchSplit,
      recipeStageConfig: section.recipeStageConfig,
      items: orderRowsBaseThenAdditional(
        section.items.filter((row) => row.sectionKind !== "additional"),
        section.items.filter((row) => row.sectionKind === "additional"),
      ),
    })),
  ];
}
