import type { ProductionSheetDocument, PrintIngredientRow } from "@/lib/printing-documents";
import type { PreWeighBatchSplit } from "@/lib/production-batches";

export function buildThermalTickets(document: ProductionSheetDocument) {
  const sections = [
    ...document.ingredientSections.map((s) => ({ ...s, quantity: s.requiredQuantity, unit: s.requiredUnit })),
    ...document.productSections.map((s) => ({ ...s, quantity: s.requestedQuantity, unit: s.requestedUnit })),
  ];
  return sections.flatMap((section, sectionIndex) => {
    const split: PreWeighBatchSplit | null = section.batchSplit;
    const batches = split?.batched
      ? [...Array.from({ length: split.fullBatchCount }, () => ({ quantity: split.fullBatchUnits, complementary: false })),
          ...(split.partialUnits > 0 ? [{ quantity: split.partialUnits, complementary: true }] : [])]
      : [{ quantity: section.quantity, complementary: false }];
    return batches.map((batch, index) => ({
      key: `${sectionIndex + 1}-B${String(index + 1).padStart(2, "0")}`,
      productCode: section.productCode,
      productName: section.productName,
      number: index + 1,
      count: batches.length,
      quantity: batch.quantity,
      totalQuantity: split?.batched ? split.totalUnits : section.quantity,
      unit: split?.batched ? split.unitLabel : section.unit,
      complementary: batch.complementary,
      recipeStageConfig: section.recipeStageConfig,
      items: section.items.map((row): PrintIngredientRow => ({
        ...row,
        estimatedQuantity: split?.batched
          ? (batch.complementary ? row.partialQuantity : row.batchQuantity)
            ?? row.estimatedQuantity * batch.quantity / split.totalUnits
          : row.estimatedQuantity,
      })),
    }));
  });
}
