import assert from "node:assert/strict";
import test from "node:test";

import { computeLabTest, emptyLabTest } from "@/lib/lab-test";
import type { ProductionOrderItem, ProductionOrderRow } from "@/lib/order-planning";
import { buildPreWeighingDocument, buildProductionSheetDocument } from "@/lib/printing-documents";
import {
  computePreWeighBatchSplit,
  deriveEconomicProductionKg,
  formatBatchSplitPhrase,
  planBatches,
} from "@/lib/production-batches";
import type { ProductionIngredient, ProductionProduct } from "@/lib/production-planning";

test("planilha Fubá 250g: lança medições e deriva quebra 7,53% / unidade 277,407 g", () => {
  const lab = computeLabTest({
    recipeTotalKg: 45,
    labTest: {
      ...emptyLabTest(),
      rawDoughKg: 45,
      bakedKg: 41.611,
      leftoverBakedKg: 0,
      unitCount: 150,
      labelWeightKg: 0.25,
    },
  });
  assert.ok(lab?.complete);
  assert.equal(Number(lab.breakPercent.toFixed(2)), 7.53);
  assert.equal(Number(lab.yieldPercent.toFixed(2)), 92.47);
  assert.equal(Number((lab.bakedUnitKg * 1000).toFixed(3)), 277.407);
});

test("planilha OP Pães Chama: 3600 Un cap 1200 → 3 cheias e kg de MP na folha", () => {
  const product = {
    id: "pao-cenoura",
    code: "PR-CEN",
    name: "Pão de Cenoura",
    description: "Pão de Cenoura",
    lineId: "line-1",
    active: true,
    availableForOrdering: true,
    validityDays: 1,
    minimumProductionKg: 0,
    economicProductionKg: 60,
    allowsStorage: false,
    productionDays: [],
    expeditionLeadDays: 0,
    unitProfiles: {
      sales: { unit: "Un", description: "Un", weightKg: 0.05 },
      production: { unit: "Un", description: "Un", weightKg: 0.05 },
      expedition: { unit: "Un", description: "Un", weightKg: 0.05 },
    },
    isSoldLoose: true,
    recipe: [
      {
        id: "r1",
        sourceType: "ingrediente",
        sourceId: "ing-farinha",
        label: "Farinha de trigo",
        quantity: 10,
        unit: "Kg",
        isMain: true,
      },
    ],
    preparationStages: ["em_producao"],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "depois_divisao",
    breakComment: "",
    canBeIngredient: false,
    weight: "0,050 Kg",
    productionUnit: "Un",
    salesUnit: "Un",
    salesToKgFactor: 0.05,
    expeditionUnit: "Un",
    expeditionToKgFactor: 0.05,
    isMpiIngredient: false,
    capacityPerBatch: 1200,
    economicBatchUnit: "maceira",
    mainIngredientLimitKg: 50,
  } as ProductionProduct;

  assert.equal(deriveEconomicProductionKg(1200, 0.05), 60);

  const totalKg = 3600 * 0.05;
  const plan = planBatches({
    totalKg,
    capacityPerBatch: 1200,
    salesToKgFactor: 0.05,
    salesUnit: "Un",
  });
  assert.deepEqual(plan.batchSizes, [1200, 1200, 1200]);

  const item: ProductionOrderItem = {
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    productionItemKey: `2026-09-17|line-1|schedule-1|${product.id}`,
    isIntermediate: false,
    demandSource: "pedido",
    totalKg,
    minimumProductionKg: 0,
    belowMinimum: false,
    productionSequence: 1,
    progress: 0,
    status: "nao_iniciado",
    batchCount: plan.batchCount,
    batchSizes: plan.batchSizes,
    batchUnitLabel: "Un",
    batchesDone: 0,
    capacityPerBatch: 1200,
    preparationStages: ["em_producao"],
    sourceItemsCount: 1,
  };
  const op: ProductionOrderRow = {
    id: "op-chama",
    code: "OP-CHAMA",
    productionDate: "2026-09-17",
    productionDateLabel: "17/09/2026",
    lineId: "line-1",
    lineName: "Pães",
    sectorId: "sector-1",
    sectorName: "Panificação",
    scheduleId: "schedule-1",
    scheduleCode: "SL-1",
    scheduleName: "Pães",
    itemsCount: 1,
    ordersCount: 1,
    totalKg,
    hasDemand: true,
    releasedToProduction: true,
    productionStarted: false,
    progress: 0,
    status: "agendado",
    orderCodes: ["PD-1"],
    items: [item],
    sourceItems: [
      {
        id: "src-1",
        orderId: "order-1",
        orderCode: "PD-1",
        storeName: "Loja 1",
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        requestedQuantity: 3600,
        requestedUnit: "Un",
        internalKg: totalKg,
        deliveryDate: "2026-09-18",
        deliveryDateLabel: "18/09/2026",
        saleDate: "2026-09-18",
        saleDateLabel: "18/09/2026",
        expeditionUnit: "Un",
        expeditionQuantity: 3600,
        productionItemKey: item.productionItemKey,
        productionSequence: 1,
        releasedToProduction: true,
        productionItemStatus: "nao_iniciado",
        workflowProgress: 0,
      },
    ],
  };

  const ingredients = [
    {
      id: "ing-farinha",
      code: "ING-1",
      name: "Farinha de trigo",
      type: "puro",
      unit: "Kg",
      metadata: "",
      observation: "",
      composition: [],
      status: "ativo",
    },
  ] as ProductionIngredient[];
  const source = { products: [product], ingredients };
  const folha = buildProductionSheetDocument(op, source);
  const pre = buildPreWeighingDocument(op, source);
  const section = folha.productSections[0];
  const split = computePreWeighBatchSplit({
    totalKg,
    capacityPerBatch: 1200,
    salesToKgFactor: 0.05,
    salesUnit: "Un",
  });

  assert.equal(formatBatchSplitPhrase(split), "3 cheias de 1200 Un");
  assert.equal(section?.batchSplit?.fullBatchCount, 3);
  assert.equal(section?.batchSplit?.partialUnits, 0);
  assert.equal(section?.items[0]?.batchQuantity, 60);
  assert.equal(pre.productSections[0]?.batchSplit?.fullBatchCount, 3);
  assert.equal(pre.productSections[0]?.baseIngredients[0]?.batchQuantity, 60);
});
