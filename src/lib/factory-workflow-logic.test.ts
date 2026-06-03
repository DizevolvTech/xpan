import assert from "node:assert/strict";
import test from "node:test";

import type { FactoryPlanningData } from "@/lib/order-planning";
import { applyFactoryWorkflowState } from "@/lib/factory-workflow-logic";
import { defaultProductPreparationStages } from "@/lib/production-planning";
import type { DeliveryExecutionStatus } from "@/lib/delivery-workflow";

test("cancelled orders remain visible in pedidos and leave production/expedition queues", () => {
  const planning: FactoryPlanningData = {
    referenceDate: "2026-03-18",
    orders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        dPlusLabel: "D+1",
        deliveryDate: "2026-03-19",
        deliveryDateLabel: "19/03/2026",
        productionDateLabel: "19/03/2026",
        itemsCount: 1,
        totalKg: 12,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "em_espera",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-19",
        saleDate: "2026-03-19",
        productionDate: "2026-03-19",
        delayed: false,
        demandSource: "pedido",
        productId: "product-1",
        productCode: "PR-0001",
        productName: "Produto A",
        lineId: "line-1",
        lineName: "Linha A",
        sectorId: "sector-1",
        sectorName: "Setor A",
        scheduleId: "schedule-1",
        scheduleCode: "SL-0001",
        scheduleName: "Linha Executora",
        requestedQuantity: 12,
        requestedUnit: "Kg",
        internalKg: 12,
        minimumProductionKg: 0,
        expeditionUnit: "Kg",
        expeditionQuantityRaw: 12,
        expeditionQuantity: 12,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: false,
        productionStarted: false,
        capacityPerBatch: null,
        salesToKgFactor: 1,
        salesUnit: "Kg",
        batchesDone: 0,
        productionItemKey: "2026-03-19|sector-1|line-1|schedule-1|product-1",
        productionItemStatus: null,
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "em_espera",
      },
    ],
    productionOrders: [],
    expedition: [
      {
        id: "exp-1",
        orderId: "order-1",
        orderCode: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        deliveryDate: "2026-03-19",
        deliveryDateLabel: "19/03/2026",
        totalKg: 12,
        itemsCount: 1,
        itemsSummary: "1 item",
        releasedToProduction: false,
        workflowProgress: 0,
        status: "em_espera",
        items: [
          {
            itemId: "item-1",
            productId: "product-1",
            productCode: "PR-0001",
            productName: "Produto A",
            requestedQuantity: 12,
            requestedUnit: "Kg",
            internalKg: 12,
            expeditionQuantityRaw: 12,
            expeditionQuantity: 12,
            expeditionUnit: "Kg",
            productionDate: "2026-03-19",
            saleDate: "2026-03-19",
            workflowProgress: 0,
          },
        ],
      },
    ],
    expeditionItems: [],
    productionDates: ["2026-03-19"],
    deliveryDates: ["2026-03-19"],
  };

  const result = applyFactoryWorkflowState(planning, {
    isReleased: () => false,
    isCancelled: (orderId) => orderId === "order-1",
    resolveProductionItemStatus: () => null,
  });

  assert.equal(result.orders[0]?.status, "cancelado");
  assert.equal(result.orders[0]?.availableForRelease, false);
  assert.equal(result.productionOrders.length, 0);
  assert.equal(result.expedition.length, 0);
  assert.equal(result.orderItems[0]?.status, "cancelado");
});

test("multiple orders on the same line and day collapse into one production order while expedition stays per order", () => {
  const planning: FactoryPlanningData = {
    referenceDate: "2026-03-18",
    orders: [
      {
        id: "order-1",
        code: "PD-0009",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        orderedAtKey: "2026-03-18",
        dPlusLabel: "D+2",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        productionDateLabel: "20/03/2026",
        itemsCount: 1,
        totalKg: 10,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "em_espera",
      },
      {
        id: "order-2",
        code: "PD-0010",
        storeId: "store-2",
        storeName: "Loja B",
        orderedAt: "18/03/2026 08:15",
        orderedAtKey: "2026-03-18",
        dPlusLabel: "D+2",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        productionDateLabel: "20/03/2026",
        itemsCount: 1,
        totalKg: 12,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "em_espera",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-0009",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-20",
        saleDate: "2026-03-20",
        productionDate: "2026-03-20",
        delayed: false,
        demandSource: "pedido",
        productId: "product-pan",
        productCode: "PR-PAO",
        productName: "Pao Frances",
        lineId: "line-pan",
        lineName: "Linha de Paes",
        sectorId: "sector-pan",
        sectorName: "Panificacao",
        scheduleId: "schedule-pan",
        scheduleCode: "SL-PAN",
        scheduleName: "Linha Panificacao",
        requestedQuantity: 10,
        requestedUnit: "Kg",
        internalKg: 10,
        minimumProductionKg: 0,
        expeditionUnit: "Kg",
        expeditionQuantityRaw: 10,
        expeditionQuantity: 10,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: false,
        productionStarted: false,
        capacityPerBatch: null,
        salesToKgFactor: 1,
        salesUnit: "Kg",
        batchesDone: 0,
        productionItemKey: "2026-03-20|line-pan|schedule-pan|product-pan",
        productionItemStatus: null,
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "em_espera",
      },
      {
        id: "item-2",
        orderId: "order-2",
        orderCode: "PD-0010",
        storeId: "store-2",
        storeName: "Loja B",
        orderedAt: "18/03/2026 08:15",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-20",
        saleDate: "2026-03-20",
        productionDate: "2026-03-20",
        delayed: false,
        demandSource: "pedido",
        productId: "product-pan-2",
        productCode: "PR-FORMA",
        productName: "Pao de Forma",
        lineId: "line-pan",
        lineName: "Linha de Paes",
        sectorId: "sector-pan",
        sectorName: "Panificacao",
        scheduleId: "schedule-pan",
        scheduleCode: "SL-PAN",
        scheduleName: "Linha Panificacao",
        requestedQuantity: 12,
        requestedUnit: "Kg",
        internalKg: 12,
        minimumProductionKg: 0,
        expeditionUnit: "Kg",
        expeditionQuantityRaw: 12,
        expeditionQuantity: 12,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: false,
        productionStarted: false,
        capacityPerBatch: null,
        salesToKgFactor: 1,
        salesUnit: "Kg",
        batchesDone: 0,
        productionItemKey: "2026-03-20|line-pan|schedule-pan|product-pan-2",
        productionItemStatus: null,
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "em_espera",
      },
    ],
    productionOrders: [],
    expedition: [
      {
        id: "exp-1",
        orderId: "order-1",
        orderCode: "PD-0009",
        storeId: "store-1",
        storeName: "Loja A",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        totalKg: 10,
        itemsCount: 1,
        itemsSummary: "1 item",
        releasedToProduction: false,
        workflowProgress: 0,
        status: "em_espera",
        items: [
          {
            itemId: "item-1",
            productId: "product-pan",
            productCode: "PR-PAO",
            productName: "Pao Frances",
            requestedQuantity: 10,
            requestedUnit: "Kg",
            internalKg: 10,
            expeditionQuantityRaw: 10,
            expeditionQuantity: 10,
            expeditionUnit: "Kg",
            productionDate: "2026-03-20",
            saleDate: "2026-03-20",
            workflowProgress: 0,
          },
        ],
      },
      {
        id: "exp-2",
        orderId: "order-2",
        orderCode: "PD-0010",
        storeId: "store-2",
        storeName: "Loja B",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        totalKg: 12,
        itemsCount: 1,
        itemsSummary: "1 item",
        releasedToProduction: false,
        workflowProgress: 0,
        status: "em_espera",
        items: [
          {
            itemId: "item-2",
            productId: "product-pan-2",
            productCode: "PR-FORMA",
            productName: "Pao de Forma",
            requestedQuantity: 12,
            requestedUnit: "Kg",
            internalKg: 12,
            expeditionQuantityRaw: 12,
            expeditionQuantity: 12,
            expeditionUnit: "Kg",
            productionDate: "2026-03-20",
            saleDate: "2026-03-20",
            workflowProgress: 0,
          },
        ],
      },
    ],
    expeditionItems: [],
    productionDates: ["2026-03-20"],
    deliveryDates: ["2026-03-20"],
  };

  const result = applyFactoryWorkflowState(planning, {
    isReleased: (orderId) => orderId === "order-1" || orderId === "order-2",
    isCancelled: () => false,
    resolveProductionItemStatus: () => null,
  });

  assert.equal(result.productionOrders.length, 1);
  assert.deepEqual(result.productionOrders[0]?.orderCodes, ["PD-0009", "PD-0010"]);
  assert.equal(result.productionOrders[0]?.ordersCount, 2);
  assert.equal(result.productionOrders[0]?.itemsCount, 2);
  assert.equal(new Set(result.orderItems.map((item) => item.opCode).filter(Boolean)).size, 1);
  assert.equal(result.orders[0]?.releasedToProduction, true);
  assert.equal(result.orders[1]?.releasedToProduction, true);
  assert.equal(result.orders[0]?.opsLabel, result.productionOrders[0]?.code);
  assert.equal(result.orders[1]?.opsLabel, result.productionOrders[0]?.code);
  assert.equal(result.expedition.length, 2);
  assert.deepEqual(
    result.expedition.map((row) => row.orderCode).sort((a, b) => a.localeCompare(b)),
    ["PD-0009", "PD-0010"],
  );
});

test("productionStarted gates chão visibility: started OR advanced status, never when not released", () => {
  const buildPlanning = (): FactoryPlanningData => ({
    referenceDate: "2026-03-18",
    orders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        dPlusLabel: "D+1",
        deliveryDate: "2026-03-19",
        deliveryDateLabel: "19/03/2026",
        productionDateLabel: "19/03/2026",
        itemsCount: 1,
        totalKg: 12,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "em_espera",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-19",
        saleDate: "2026-03-19",
        productionDate: "2026-03-19",
        delayed: false,
        demandSource: "pedido",
        productId: "product-1",
        productCode: "PR-0001",
        productName: "Produto A",
        lineId: "line-1",
        lineName: "Linha A",
        sectorId: "sector-1",
        sectorName: "Setor A",
        scheduleId: "schedule-1",
        scheduleCode: "SL-0001",
        scheduleName: "Linha Executora",
        requestedQuantity: 12,
        requestedUnit: "Kg",
        internalKg: 12,
        minimumProductionKg: 0,
        expeditionUnit: "Kg",
        expeditionQuantityRaw: 12,
        expeditionQuantity: 12,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: false,
        productionStarted: false,
        capacityPerBatch: null,
        salesToKgFactor: 1,
        salesUnit: "Kg",
        batchesDone: 0,
        productionItemKey: "2026-03-19|line-1|product-1",
        productionItemStatus: null,
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "em_espera",
      },
    ],
    productionOrders: [],
    expedition: [],
    expeditionItems: [],
    productionDates: ["2026-03-19"],
    deliveryDates: ["2026-03-19"],
  });

  // Liberado mas NÃO iniciado (status nao_iniciado) → fora do chão.
  const releasedOnly = applyFactoryWorkflowState(buildPlanning(), {
    isReleased: () => true,
    isCancelled: () => false,
    resolveProductionItemStatus: () => "nao_iniciado",
    isProductionStarted: () => false,
  });
  assert.equal(releasedOnly.orderItems[0]?.productionStarted, false);
  assert.equal(releasedOnly.productionOrders[0]?.productionStarted, false);

  // Liberado E iniciado pelo gestor, ainda nao_iniciado → entra no chão (1ª coluna).
  const started = applyFactoryWorkflowState(buildPlanning(), {
    isReleased: () => true,
    isCancelled: () => false,
    resolveProductionItemStatus: () => "nao_iniciado",
    isProductionStarted: () => true,
  });
  assert.equal(started.orderItems[0]?.productionStarted, true);
  assert.equal(started.productionOrders[0]?.productionStarted, true);
  assert.equal(started.productionOrders[0]?.items[0]?.status, "nao_iniciado");

  // Compat: status já avançou sem registro de início → conta como iniciado.
  const advanced = applyFactoryWorkflowState(buildPlanning(), {
    isReleased: () => true,
    isCancelled: () => false,
    resolveProductionItemStatus: () => "em_preparacao",
    isProductionStarted: () => false,
  });
  assert.equal(advanced.orderItems[0]?.productionStarted, true);
  assert.equal(advanced.productionOrders[0]?.productionStarted, true);

  // Não liberado → nunca iniciado, mesmo com registro de início.
  const notReleased = applyFactoryWorkflowState(buildPlanning(), {
    isReleased: () => false,
    isCancelled: () => false,
    resolveProductionItemStatus: () => "nao_iniciado",
    isProductionStarted: () => true,
  });
  assert.equal(notReleased.orderItems[0]?.productionStarted, false);
});

test("resolveBatchesDone drives item status through apply→engine chain (0→nao_iniciado, 2→em_producao, 5→concluido)", () => {
  // 456 Un × 0.11 kg/Un = 50.16 kg → planBatches({ capacityPerBatch: 100 }) = 5 batidas.
  const buildPlanning = (): FactoryPlanningData => ({
    referenceDate: "2026-03-18",
    orders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        dPlusLabel: "D+1",
        deliveryDate: "2026-03-19",
        deliveryDateLabel: "19/03/2026",
        productionDateLabel: "19/03/2026",
        itemsCount: 1,
        totalKg: 50.16,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "em_espera",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-19",
        saleDate: "2026-03-19",
        productionDate: "2026-03-19",
        delayed: false,
        demandSource: "pedido",
        productId: "product-1",
        productCode: "PR-0001",
        productName: "Produto Batido",
        lineId: "line-1",
        lineName: "Linha A",
        sectorId: "sector-1",
        sectorName: "Setor A",
        scheduleId: "schedule-1",
        scheduleCode: "SL-0001",
        scheduleName: "Linha Executora",
        requestedQuantity: 456,
        requestedUnit: "Un",
        internalKg: 50.16,
        minimumProductionKg: 0,
        expeditionUnit: "Un",
        expeditionQuantityRaw: 456,
        expeditionQuantity: 456,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: false,
        productionStarted: false,
        capacityPerBatch: 100,
        salesToKgFactor: 0.11,
        salesUnit: "Un",
        batchesDone: 0,
        productionItemKey: "2026-03-19|line-1|product-1",
        productionItemStatus: null,
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "em_espera",
      },
    ],
    productionOrders: [],
    expedition: [],
    expeditionItems: [],
    productionDates: ["2026-03-19"],
    deliveryDates: ["2026-03-19"],
  });

  const baseWorkflow = {
    isReleased: () => true,
    isCancelled: () => false,
    resolveProductionItemStatus: () => "nao_iniciado" as const,
    isProductionStarted: () => true,
  };

  // 0 batidas → nao_iniciado
  const zeroBatches = applyFactoryWorkflowState(buildPlanning(), {
    ...baseWorkflow,
    resolveBatchesDone: () => 0,
  });
  assert.equal(zeroBatches.productionOrders[0]?.items[0]?.status, "nao_iniciado");

  // 2 batidas → em_producao
  const twoBatches = applyFactoryWorkflowState(buildPlanning(), {
    ...baseWorkflow,
    resolveBatchesDone: () => 2,
  });
  assert.equal(twoBatches.productionOrders[0]?.items[0]?.status, "em_producao");

  // 5 batidas (= batchCount) → concluido
  const fiveBatches = applyFactoryWorkflowState(buildPlanning(), {
    ...baseWorkflow,
    resolveBatchesDone: () => 5,
  });
  assert.equal(fiveBatches.productionOrders[0]?.items[0]?.status, "concluido");
});

test("batched completion propagates to the ORDER and expedition side (flows to aguardando_expedicao)", () => {
  // 456 Un × 0.11 kg/Un = 50.16 kg → planBatches({ capacityPerBatch: 100 }) = 5 batidas.
  // Produtos batidos NÃO escrevem em workflow_production_items (resolveProductionItemStatus
  // sempre "nao_iniciado"); o status do pedido tem que vir do derivado das batidas.
  const buildPlanning = (): FactoryPlanningData => ({
    referenceDate: "2026-03-18",
    orders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        dPlusLabel: "D+1",
        deliveryDate: "2026-03-19",
        deliveryDateLabel: "19/03/2026",
        productionDateLabel: "19/03/2026",
        itemsCount: 1,
        totalKg: 50.16,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "em_espera",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-19",
        saleDate: "2026-03-19",
        productionDate: "2026-03-19",
        delayed: false,
        demandSource: "pedido",
        productId: "product-1",
        productCode: "PR-0001",
        productName: "Produto Batido",
        lineId: "line-1",
        lineName: "Linha A",
        sectorId: "sector-1",
        sectorName: "Setor A",
        scheduleId: "schedule-1",
        scheduleCode: "SL-0001",
        scheduleName: "Linha Executora",
        requestedQuantity: 456,
        requestedUnit: "Un",
        internalKg: 50.16,
        minimumProductionKg: 0,
        expeditionUnit: "Un",
        expeditionQuantityRaw: 456,
        expeditionQuantity: 456,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: false,
        productionStarted: false,
        capacityPerBatch: 100,
        salesToKgFactor: 0.11,
        salesUnit: "Un",
        batchesDone: 0,
        productionItemKey: "2026-03-19|line-1|product-1",
        productionItemStatus: null,
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "em_espera",
      },
    ],
    productionOrders: [],
    expedition: [
      {
        id: "exp-1",
        orderId: "order-1",
        orderCode: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        deliveryDate: "2026-03-19",
        deliveryDateLabel: "19/03/2026",
        totalKg: 50.16,
        itemsCount: 1,
        itemsSummary: "1 item",
        releasedToProduction: false,
        workflowProgress: 0,
        status: "em_espera",
        items: [
          {
            itemId: "item-1",
            productId: "product-1",
            productCode: "PR-0001",
            productName: "Produto Batido",
            requestedQuantity: 456,
            requestedUnit: "Un",
            internalKg: 50.16,
            expeditionQuantityRaw: 456,
            expeditionQuantity: 456,
            expeditionUnit: "Un",
            productionDate: "2026-03-19",
            saleDate: "2026-03-19",
            workflowProgress: 0,
          },
        ],
      },
    ],
    expeditionItems: [],
    productionDates: ["2026-03-19"],
    deliveryDates: ["2026-03-19"],
  });

  const baseWorkflow = {
    isReleased: () => true,
    isCancelled: () => false,
    resolveProductionItemStatus: () => "nao_iniciado" as const,
  };

  // 0 batidas → pedido NÃO está pronto p/ expedição.
  const zeroBatches = applyFactoryWorkflowState(buildPlanning(), {
    ...baseWorkflow,
    resolveBatchesDone: () => 0,
  });
  assert.notEqual(zeroBatches.orders[0]?.status, "aguardando_expedicao");
  assert.equal(zeroBatches.orders[0]?.status, "agendado");
  assert.notEqual(zeroBatches.expedition[0]?.status, "aguardando_expedicao");

  // 5 batidas (= batchCount) → pedido fecha 100% e flui p/ expedição.
  const fiveBatches = applyFactoryWorkflowState(buildPlanning(), {
    ...baseWorkflow,
    resolveBatchesDone: () => 5,
  });
  assert.equal(fiveBatches.orders[0]?.status, "aguardando_expedicao");
  assert.equal(fiveBatches.orderItems[0]?.productionItemStatus, "concluido");
  assert.equal(fiveBatches.expedition[0]?.status, "aguardando_expedicao");
});

// --- Entrega dobra no status da OP (gestor-fabrica/ordens-producao) ----------
// Duas ordens na MESMA linha/dia → colapsam numa única OP. Produção concluída
// (resolveProductionItemStatus = "concluido") → OP satura em aguardando_expedicao.
// O resolveDeliveryStatus por pedido então move a OP para frente (rota_entrega /
// entregue) pelo elo mais fraco.
function buildTwoOrderSameOpPlanning(): FactoryPlanningData {
  return {
    referenceDate: "2026-03-18",
    orders: [
      {
        id: "order-1",
        code: "PD-0009",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        orderedAtKey: "2026-03-18",
        dPlusLabel: "D+2",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        productionDateLabel: "20/03/2026",
        itemsCount: 1,
        totalKg: 10,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "em_espera",
      },
      {
        id: "order-2",
        code: "PD-0010",
        storeId: "store-2",
        storeName: "Loja B",
        orderedAt: "18/03/2026 08:15",
        orderedAtKey: "2026-03-18",
        dPlusLabel: "D+2",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        productionDateLabel: "20/03/2026",
        itemsCount: 1,
        totalKg: 12,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "em_espera",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-0009",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-20",
        saleDate: "2026-03-20",
        productionDate: "2026-03-20",
        delayed: false,
        demandSource: "pedido",
        productId: "product-pan",
        productCode: "PR-PAO",
        productName: "Pao Frances",
        lineId: "line-pan",
        lineName: "Linha de Paes",
        sectorId: "sector-pan",
        sectorName: "Panificacao",
        scheduleId: "schedule-pan",
        scheduleCode: "SL-PAN",
        scheduleName: "Linha Panificacao",
        requestedQuantity: 10,
        requestedUnit: "Kg",
        internalKg: 10,
        minimumProductionKg: 0,
        expeditionUnit: "Kg",
        expeditionQuantityRaw: 10,
        expeditionQuantity: 10,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: false,
        productionStarted: false,
        capacityPerBatch: null,
        salesToKgFactor: 1,
        salesUnit: "Kg",
        batchesDone: 0,
        productionItemKey: "2026-03-20|sector-pan|line-pan|schedule-pan|product-pan",
        productionItemStatus: null,
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "em_espera",
      },
      {
        id: "item-2",
        orderId: "order-2",
        orderCode: "PD-0010",
        storeId: "store-2",
        storeName: "Loja B",
        orderedAt: "18/03/2026 08:15",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-20",
        saleDate: "2026-03-20",
        productionDate: "2026-03-20",
        delayed: false,
        demandSource: "pedido",
        productId: "product-pan-2",
        productCode: "PR-FORMA",
        productName: "Pao de Forma",
        lineId: "line-pan",
        lineName: "Linha de Paes",
        sectorId: "sector-pan",
        sectorName: "Panificacao",
        scheduleId: "schedule-pan",
        scheduleCode: "SL-PAN",
        scheduleName: "Linha Panificacao",
        requestedQuantity: 12,
        requestedUnit: "Kg",
        internalKg: 12,
        minimumProductionKg: 0,
        expeditionUnit: "Kg",
        expeditionQuantityRaw: 12,
        expeditionQuantity: 12,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: false,
        productionStarted: false,
        capacityPerBatch: null,
        salesToKgFactor: 1,
        salesUnit: "Kg",
        batchesDone: 0,
        productionItemKey: "2026-03-20|sector-pan|line-pan|schedule-pan|product-pan-2",
        productionItemStatus: null,
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "em_espera",
      },
    ],
    productionOrders: [],
    expedition: [],
    expeditionItems: [],
    productionDates: ["2026-03-20"],
    deliveryDates: ["2026-03-20"],
  };
}

const completedProductionWorkflow = {
  isReleased: () => true,
  isCancelled: () => false,
  resolveProductionItemStatus: () => "concluido" as const,
};

test("OP com TODOS os pedidos entregues reporta status entregue", () => {
  const deliveryByOrder: Record<string, DeliveryExecutionStatus> = {
    "order-1": "entregue",
    "order-2": "entregue",
  };
  const result = applyFactoryWorkflowState(buildTwoOrderSameOpPlanning(), {
    ...completedProductionWorkflow,
    resolveDeliveryStatus: (orderId) => deliveryByOrder[orderId] ?? null,
  });

  assert.equal(result.productionOrders.length, 1);
  assert.equal(result.productionOrders[0]?.status, "entregue");
  // produção continua 100% — entrega não mexe em progress.
  assert.equal(result.productionOrders[0]?.progress, 100);
});

test("OP com pedidos mistos (1 entregue, 1 ainda aguardando) reporta o elo mais fraco aguardando_expedicao", () => {
  const deliveryByOrder: Record<string, DeliveryExecutionStatus> = {
    "order-1": "entregue",
    // order-2 sem execução de entrega → mantém status de produção (aguardando_expedicao)
  };
  const result = applyFactoryWorkflowState(buildTwoOrderSameOpPlanning(), {
    ...completedProductionWorkflow,
    resolveDeliveryStatus: (orderId) => deliveryByOrder[orderId] ?? null,
  });

  assert.equal(result.productionOrders[0]?.status, "aguardando_expedicao");
});

test("OP com entrega em rota (sem todos entregues) reporta rota_entrega", () => {
  const deliveryByOrder: Record<string, DeliveryExecutionStatus> = {
    "order-1": "entregue",
    "order-2": "em_rota",
  };
  const result = applyFactoryWorkflowState(buildTwoOrderSameOpPlanning(), {
    ...completedProductionWorkflow,
    resolveDeliveryStatus: (orderId) => deliveryByOrder[orderId] ?? null,
  });

  assert.equal(result.productionOrders[0]?.status, "rota_entrega");
});

test("sem resolveDeliveryStatus o status da OP é idêntico ao de hoje (só produção)", () => {
  const result = applyFactoryWorkflowState(buildTwoOrderSameOpPlanning(), {
    ...completedProductionWorkflow,
  });

  assert.equal(result.productionOrders[0]?.status, "aguardando_expedicao");
});

// --- ramo !canPlan: item fora do fluxo (sem OP) vai para em_espera ------------
// Quando o cronograma ativo some (canPlan vira false), o motor SEMPRE zera
// productionItemKey/productionDate e o item NUNCA gera OP (buildProductionOrders
// filtra `canPlan && productionDate`). O defense-in-depth do A5, que tentava
// PRESERVAR release/status nesse ramo, criava um item "agendado"/liberado preso SEM
// OP no chão (resolveProductionItemStatus(null) é null → caminho de status avançado
// era código morto). Revertido ao comportamento coerente: sem OP = em_espera. A
// proteção REAL contra orfanar OPs ao editar receita é o preserveActiveSchedule
// (master-data-admin), que mantém o item canPlan — não este ramo.
function buildNotPlannableItemPlanning(): FactoryPlanningData {
  return {
    referenceDate: "2026-03-18",
    orders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        dPlusLabel: "D+1",
        deliveryDate: "2026-03-19",
        deliveryDateLabel: "19/03/2026",
        productionDateLabel: "19/03/2026",
        itemsCount: 1,
        totalKg: 12,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "em_espera",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-0001",
        storeId: "store-1",
        storeName: "Loja A",
        orderedAt: "18/03/2026 08:00",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-19",
        saleDate: "2026-03-19",
        productionDate: "2026-03-19",
        delayed: false,
        demandSource: "pedido",
        productId: "product-1",
        productCode: "PR-0001",
        productName: "Produto A",
        lineId: "line-1",
        lineName: "Linha A",
        sectorId: "sector-1",
        sectorName: "Setor A",
        scheduleId: "schedule-1",
        scheduleCode: "SL-0001",
        scheduleName: "Linha Executora",
        requestedQuantity: 12,
        requestedUnit: "Kg",
        internalKg: 12,
        minimumProductionKg: 0,
        expeditionUnit: "Kg",
        expeditionQuantityRaw: 12,
        expeditionQuantity: 12,
        // Cronograma ativo desapareceu → motor marca canPlan=false. Nesse caso o
        // motor SEMPRE zera productionItemKey/productionDate (engine.ts) e o item
        // nunca gera OP — refletido aqui para exercitar o caminho REAL.
        canPlan: false,
        scheduleDayPriority: null,
        availableForRelease: false,
        releasedToProduction: false,
        productionStarted: false,
        capacityPerBatch: null,
        salesToKgFactor: 1,
        salesUnit: "Kg",
        batchesDone: 0,
        productionItemKey: null,
        productionItemStatus: null,
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "em_espera",
      },
    ],
    productionOrders: [],
    expedition: [],
    expeditionItems: [],
    productionDates: ["2026-03-19"],
    deliveryDates: ["2026-03-19"],
  };
}

test("item !canPlan e LIBERADO no DB NÃO reporta agendado/em_producao sem OP — vai para em_espera", () => {
  // Caminho REAL: canPlan=false → productionItemKey=null → resolveProductionItemStatus(null)
  // (que o caller real só chama com chave válida) jamais entrega status avançado. O stub
  // aqui devolveria "em_producao" para QUALQUER chave, mas a chave é null e o ramo é
  // destrutivo: o item sai do fluxo. Garante que um item sem OP nunca aparece liberado/
  // produzindo (estado preso).
  const result = applyFactoryWorkflowState(buildNotPlannableItemPlanning(), {
    isReleased: () => true,
    isCancelled: () => false,
    resolveProductionItemStatus: () => "em_producao",
  });

  const item = result.orderItems[0];
  assert.equal(item?.releasedToProduction, false);
  assert.equal(item?.productionItemStatus, null);
  assert.equal(item?.status, "em_espera");
  assert.equal(item?.workflowProgress, 0);
  assert.notEqual(item?.status, "agendado");
  assert.notEqual(item?.status, "em_producao");
});

test("item !canPlan com produção 'avançada' (chave null) ainda vai para em_espera — sem OP", () => {
  const result = applyFactoryWorkflowState(buildNotPlannableItemPlanning(), {
    isReleased: () => false,
    isCancelled: () => false,
    resolveProductionItemStatus: () => "concluido",
  });

  const item = result.orderItems[0];
  // Sem chave de produção (canPlan=false) não há OP nem status persistido real:
  // não há como reportar concluido/aguardando_expedicao.
  assert.equal(item?.productionItemStatus, null);
  assert.equal(item?.status, "em_espera");
  assert.notEqual(item?.status, "aguardando_expedicao");
});

test("item !canPlan NÃO liberado e sem produção vai para em_espera", () => {
  const result = applyFactoryWorkflowState(buildNotPlannableItemPlanning(), {
    isReleased: () => false,
    isCancelled: () => false,
    resolveProductionItemStatus: () => null,
  });

  const item = result.orderItems[0];
  assert.equal(item?.releasedToProduction, false);
  assert.equal(item?.productionItemStatus, null);
  assert.equal(item?.status, "em_espera");
  assert.equal(item?.workflowProgress, 0);
});

// FIX A — order.releasedToProduction deriva do estado AUTORITATIVO de release (DB)
// por order_id, não só dos itens. Pedido cujos itens perderam canPlan (ou pedido
// vazio) mantinha o flag false mesmo com release gravado → estado preso (voltava pra
// "Aberto", cancelamento bloqueado).
test("FIX A: order com release gravado no DB mas SEM itens liberáveis reporta releasedToProduction=true", () => {
  // O item é !canPlan → applyItemWorkflowState zera item.releasedToProduction.
  // Mesmo assim, com release gravado por order_id, o PEDIDO deve aparecer liberado.
  const result = applyFactoryWorkflowState(buildNotPlannableItemPlanning(), {
    isReleased: (orderId) => orderId === "order-1",
    isCancelled: () => false,
    resolveProductionItemStatus: () => null,
  });

  const order = result.orders.find((o) => o.id === "order-1");
  assert.equal(
    result.orderItems[0]?.releasedToProduction,
    false,
    "o item em si não está liberado (sem plano de produção)",
  );
  assert.equal(
    order?.releasedToProduction,
    true,
    "o PEDIDO reporta liberado pelo estado autoritativo (DB), mantendo a UI coerente",
  );
});

test("FIX A: pedido cancelado nunca reporta releasedToProduction, mesmo com release no DB", () => {
  const result = applyFactoryWorkflowState(buildNotPlannableItemPlanning(), {
    isReleased: () => true,
    isCancelled: () => true,
    resolveProductionItemStatus: () => null,
  });

  const order = result.orders.find((o) => o.id === "order-1");
  assert.equal(order?.releasedToProduction, false, "cancelado vence o release autoritativo");
});
