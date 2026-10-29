import type { ProductionSheetDocument, PrintIngredientRow } from "@/lib/printing-documents";
import type { PreWeighBatchSplit } from "@/lib/production-batches";

/**
 * Código lido pelo QR/código de barras da ficha: `OP` + código da OP sem hífens + `-Bnn` (batida).
 * É o formato da planilha do cliente (OP260902011-B01). Quando a OP tem mais de um produto ou MPI,
 * entra `-Pn-` (n = posição da seção) para duas fichas nunca terem o mesmo código.
 */
export function buildThermalTicketCode(opCode: string, sectionIndex: number, sectionCount: number, batchNumber: number) {
  // O código da OP já nasce com "OP-" (OP-261013-001); a planilha do cliente mostra "OP260902011".
  // Sem o prefixo (OP vinda de fora do sistema), ele é acrescentado.
  const compact = opCode.replace(/[^0-9A-Za-z]/g, "");
  const base = /^OP/i.test(compact) ? `OP${compact.slice(2)}` : `OP${compact}`;
  const section = sectionCount > 1 ? `-P${sectionIndex + 1}` : "";
  return `${base}${section}-B${String(batchNumber).padStart(2, "0")}`;
}

/** Separa "COD · Nome" (como a receita guarda o rótulo) em código e nome. Sem código: só o nome. */
export function splitRecipeLabel(label: string): { code: string; name: string } {
  const at = label.indexOf(" · ");
  return at > 0 ? { code: label.slice(0, at).trim(), name: label.slice(at + 3).trim() } : { code: "", name: label.trim() };
}

/** Soma o peso (kg) das linhas em unidade de massa; Un e outras não entram (não são peso). */
export function sumTicketWeightKg(items: Array<{ estimatedQuantity: number; unit: string }>) {
  return Math.round(items.reduce((sum, row) => sum + (row.unit === "Kg" ? row.estimatedQuantity : row.unit === "g" ? row.estimatedQuantity / 1000 : 0), 0) * 1000) / 1000;
}

export function buildThermalTickets(document: ProductionSheetDocument, opCode = "") {
  const sections = [
    ...document.ingredientSections.map((s) => ({ ...s, kind: "ingredient" as const, quantity: s.requiredQuantity, unit: s.requiredUnit })),
    ...document.productSections.map((s) => ({ ...s, kind: "product" as const, quantity: s.requestedQuantity, unit: s.requestedUnit })),
  ];
  return sections.flatMap((section, sectionIndex) => {
    const split: PreWeighBatchSplit | null = section.batchSplit;
    const batches = split?.batched
      ? [...Array.from({ length: split.fullBatchCount }, () => ({ quantity: split.fullBatchUnits, complementary: false, partialIndex: -1 })),
          // Cartão #42: com mínimo por batida pode haver várias parciais (9 + 9 + 6 + 4).
          ...(split.partials ?? []).flatMap((partial, partialIndex) =>
            Array.from({ length: partial.count }, () => ({ quantity: partial.units, complementary: true, partialIndex })),
          )]
      : [{ quantity: section.quantity, complementary: false, partialIndex: -1 }];
    return batches.map((batch, index) => ({
      key: `${sectionIndex + 1}-B${String(index + 1).padStart(2, "0")}`,
      /** Código do QR/barras. */
      barcode: buildThermalTicketCode(opCode, sectionIndex, sections.length, index + 1),
      /** `ingredient` = MPI (peso de insumo, converte p/ g); `product` = quantidade pedida (não converte). */
      kind: section.kind,
      productCode: section.productCode,
      productName: section.productName,
      number: index + 1,
      count: batches.length,
      quantity: batch.quantity,
      totalQuantity: split?.batched ? split.totalUnits : section.quantity,
      unit: split?.batched ? split.unitLabel : section.unit,
      complementary: batch.complementary,
      /** Quantidade pedida do produto na OP inteira (não só desta batida). */
      recipeStageConfig: section.recipeStageConfig,
      items: section.items.map((row): PrintIngredientRow => ({
        ...row,
        estimatedQuantity: split?.batched
          ? (batch.complementary
              ? row.partialQuantities?.[batch.partialIndex] ?? row.partialQuantity
              : row.batchQuantity)
            ?? row.estimatedQuantity * batch.quantity / split.totalUnits
          : row.estimatedQuantity,
      })),
    }));
  });
}
