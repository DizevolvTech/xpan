/**
 * Gera amostras HTML das impressões da OP (pré-pesagem A4, produção A4 e 80 mm) a partir de dados
 * de teste (panetone + esponja MPI, 250 Un = 100 + 100 + 50). Uso:
 *   npx tsx scripts/print-samples.ts <pasta-de-saida>
 * Depois: google-chrome --headless --print-to-pdf=... file://<pasta>/<arquivo>.html
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFileSync } from "node:fs";

import { BatchOpSheets } from "@/components/printing/batch-op-sheet";
import { ThermalProductionSheet } from "@/components/printing/thermal-production-sheet";
import type { ProductionOrderItem, ProductionOrderRow } from "@/lib/factory-planning/types";
import { buildPreWeighingDocument, buildProductionSheetDocument } from "@/lib/printing-documents";
import { buildBatchTickets, buildPreWeighingBatchSections, buildProductionBatchSections } from "@/lib/printing/batch-tickets";
import type { ProductionIngredient, ProductionProduct, RecipeIngredientReference } from "@/lib/production-planning";

const outDir = process.argv[2] ?? "./amostras-impressao";
mkdirSync(outDir, { recursive: true });

const ing = (id: string, code: string, name: string, shortName?: string): ProductionIngredient =>
  ({ id, code, name, shortName, type: "puro", unit: "Kg", metadata: "", observation: "", composition: [], status: "ativo" }) as ProductionIngredient;
const ingredients = [
  ing("i1", "IN-000101", "Farinha de trigo especial tipo 1", "Farinha T1"),
  ing("i2", "IN-000102", "Açúcar refinado extra fino premium"),
  ing("i3", "IN-000103", "Manteiga sem sal extra", "Manteiga s/ sal"),
  ing("i4", "IN-000104", "Frutas cristalizadas variadas e uvas passas", "Frutas crist."),
  ing("i5", "IN-000105", "Fermento biológico fresco"),
];

function product(id: string, code: string, name: string, recipe: RecipeIngredientReference[], over: Partial<ProductionProduct>): ProductionProduct {
  return {
    id, code, externalCode: "", name, description: "", lineId: "line-1", active: true, availableForOrdering: true, validityDays: 3,
    minimumProductionKg: 0, economicProductionKg: 0, allowsStorage: false, productionDays: ["segunda"],
    unitProfiles: { sales: { unit: "Kg", description: "", weightKg: 1 }, production: { unit: "Kg", description: "", weightKg: 1 }, expedition: { unit: "Kg", description: "", weightKg: 1 } },
    packagingProfile: undefined, isSoldLoose: true, recipe, preparationStages: ["em_preparacao"], preparationMode: "", breakPercent: 0,
    breakStage: "depois_divisao", breakComment: "", canBeIngredient: false, ingredientProfile: undefined, weight: "1,000 Kg", productionUnit: "Kg",
    salesUnit: "Kg", salesToKgFactor: 1, expeditionUnit: "Kg", expeditionToKgFactor: 1, expeditionLeadDays: 1, isMpiIngredient: false,
    capacityPerBatch: null, economicBatchUnit: null, ...over,
  } as ProductionProduct;
}
const r = (id: string, sourceType: "ingrediente" | "produto", sourceId: string, label: string, quantity: number, stage?: string) =>
  ({ id, sourceType, sourceId, label, quantity, unit: "Kg", ...(stage ? { stage } : {}) }) as RecipeIngredientReference;

const esponja = product("mpi-esponja", "PR-00500", "Esponja panetone", [
  r("e1", "ingrediente", "i1", "IN-000101 · Farinha de trigo especial tipo 1", 1),
  r("e2", "ingrediente", "i5", "IN-000105 · Fermento biológico fresco", 0.05),
], { canBeIngredient: true, isMpiIngredient: true, capacityPerBatch: 20, shortName: "Esponja" });
const panetone = product("prod-panetone", "PR-00600", "Panetone 500 g", [
  r("p1", "ingrediente", "i1", "IN-000101 · Farinha de trigo especial tipo 1", 3, "massa"),
  r("p2", "produto", "mpi-esponja", "PR-00500 · Esponja panetone", 2, "massa"),
  r("p3", "ingrediente", "i2", "IN-000102 · Açúcar refinado extra fino premium", 1, "massa"),
  r("p4", "ingrediente", "i3", "IN-000103 · Manteiga sem sal extra", 0.8, "massa"),
  r("p5", "ingrediente", "i4", "IN-000104 · Frutas cristalizadas variadas e uvas passas", 1.2, "recheio"),
], {
  salesUnit: "Un", salesToKgFactor: 0.5, isSoldLoose: false, capacityPerBatch: 100,
  unitProfiles: { sales: { unit: "Un", description: "", weightKg: 0.5 }, production: { unit: "Un", description: "", weightKg: 0.5 }, expedition: { unit: "Un", description: "", weightKg: 0.5 } },
  labTest: { bakedKg: 6.8, leftoverBakedKg: 0.2, unitCount: 15, labelWeightKg: null },
});

const item = (p: ProductionProduct, totalKg: number, over: Partial<ProductionOrderItem>): ProductionOrderItem => ({
  productId: p.id, productCode: p.code, productName: p.name, productionItemKey: `k|${p.id}`, isIntermediate: false, demandSource: "pedido",
  totalKg, minimumProductionKg: 0, belowMinimum: false, productionSequence: 1, progress: 0, status: "nao_iniciado", batchCount: 1,
  batchSizes: [totalKg], batchUnitLabel: "Kg", batchesDone: 0, capacityPerBatch: null, preparationStages: ["em_preparacao"], sourceItemsCount: 1, ...over,
} as ProductionOrderItem);

const op = {
  id: "op-1", code: "OP-261106-001", productionDate: "2026-11-06", productionDateLabel: "06/11", sectorId: "s1", sectorName: "Panificação",
  lineId: "line-1", lineName: "Panetones", scheduleId: "sch-1", scheduleCode: "CR-1", scheduleName: "Cronograma", itemsCount: 1, ordersCount: 1,
  totalKg: 175, hasDemand: true, releasedToProduction: true, productionStarted: false, progress: 0, status: "agendado", orderCodes: ["PD-0001"],
  items: [
    item(panetone, 125, { capacityPerBatch: 100, batchUnitLabel: "Un", batchSizes: [100, 100, 50], batchCount: 3 }),
    item(esponja, 50.043, { isIntermediate: true, capacityPerBatch: 20 }),
  ],
  sourceItems: [{
    id: "i-1", orderId: "o-1", orderCode: "PD-0001", storeName: "Loja Centro", productId: panetone.id, productCode: panetone.code, productName: panetone.name,
    requestedQuantity: 250, requestedUnit: "Un", internalKg: 125, deliveryDate: "2026-11-07", deliveryDateLabel: "07/11", saleDate: "2026-11-07", saleDateLabel: "07/11",
    expeditionUnit: "Un", expeditionQuantity: 250, productionItemKey: "k", productionSequence: 1, releasedToProduction: true, productionItemStatus: "nao_iniciado", workflowProgress: 0,
  }],
} as unknown as ProductionOrderRow;

const source = { products: [panetone, esponja], ingredients };

async function css() {
  const input = readFileSync("src/app/globals.css", "utf8");
  const result = await postcss([tailwind()]).process(input, { from: "src/app/globals.css" });
  return result.css;
}

function page(title: string, body: string, styles: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>${styles}</style><style>@page{size:A4;margin:10mm} body{background:#fff;padding:0;margin:0;font-family:Arial,sans-serif} .sheet{max-width:190mm;margin:0 auto;padding:6mm 0}</style></head><body><div class="sheet"><h1 style="font-size:16px;font-weight:700;margin-bottom:2mm">${title}</h1>${body}</div></body></html>`;
}

async function main() {
  const styles = await css();
  const pre = buildPreWeighingDocument(op, source);
  const folha = buildProductionSheetDocument(op, source);
  const meta = `${op.lineName} · ${op.code} · Produzir 06/11 · Entregar 07/11`;
  writeFileSync(`${outDir}/pre-pesagem-a4.html`, page(`Pré-pesagem · ${meta}`, renderToStaticMarkup(createElement(BatchOpSheets, { tickets: buildBatchTickets(buildPreWeighingBatchSections(pre), op.code), variant: "prepesagem" })), styles));
  writeFileSync(`${outDir}/producao-a4.html`, page(`Produção · ${meta}`, renderToStaticMarkup(createElement(BatchOpSheets, { tickets: buildBatchTickets(buildProductionBatchSections(folha), op.code), variant: "producao" })), styles));
  const thermal = renderToStaticMarkup(createElement(ThermalProductionSheet, { document: folha, code: op.code, line: op.lineName, productionDate: "06/11", deliveryDate: "07/11" }));
  writeFileSync(`${outDir}/producao-80mm.html`, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>80 mm</title><style>${styles}</style></head><body>${thermal}</body></html>`);
  console.log("ok", outDir);
}
void main();
