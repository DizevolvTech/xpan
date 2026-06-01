import test from "node:test";
import assert from "node:assert/strict";

import {
  filterFactoryPlanningDataByOperationalScope,
  filterStoreOrderSummariesByOperationalScope,
  type OperationalDateScope,
} from "@/lib/operational-date-scope";
import type { FactoryPlanningData } from "@/lib/order-planning";
import { defaultProductPreparationStages } from "@/lib/production-planning";
import type { StoreOrderSummary } from "@/lib/store-order-types";

const baseScope: OperationalDateScope = {
  mode: "day",
  date: "2026-03-18",
  startDate: "2026-03-18",
  endDate: "2026-03-18",
};

test("store order summaries remain visible on the day they were created", () => {
  const orders: StoreOrderSummary[] = [
    {
      id: "order-1",
      code: "PD-260318-0012",
      storeId: "store-01",
      date: "18/03/2026 17:11",
      orderedAtKey: "2026-03-18",
      deliveryDate: "20/03/2026",
      deliveryDateKey: "2026-03-20",
      status: "em_espera",
      store: "Empório do Pão",
    },
  ];

  const filtered = filterStoreOrderSummariesByOperationalScope(orders, baseScope);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "order-1");
});

test("store order summaries remain visible on the delivery day as well", () => {
  const orders: StoreOrderSummary[] = [
    {
      id: "order-1",
      code: "PD-260318-0012",
      storeId: "store-01",
      date: "18/03/2026 17:11",
      orderedAtKey: "2026-03-18",
      deliveryDate: "20/03/2026",
      deliveryDateKey: "2026-03-20",
      status: "em_espera",
      store: "Empório do Pão",
    },
  ];

  const filtered = filterStoreOrderSummariesByOperationalScope(orders, {
    ...baseScope,
    date: "2026-03-20",
    startDate: "2026-03-20",
    endDate: "2026-03-20",
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "order-1");
});

test("factory orders remain visible on the day they were created even with later delivery", () => {
  const planning: FactoryPlanningData = {
    referenceDate: "2026-03-18",
    orders: [
      {
        id: "order-1",
        code: "PD-260318-0012",
        storeId: "store-01",
        storeName: "Empório do Pão",
        orderedAt: "18/03/2026 17:11",
        orderedAtKey: "2026-03-18",
        dPlusLabel: "D+2",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        productionDateLabel: "19/03/2026",
        itemsCount: 1,
        totalKg: 4.35,
        opsLabel: "-",
        releasedToProduction: false,
        availableForRelease: true,
        workflowProgress: 0,
        status: "agendado",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-260318-0012",
        storeId: "store-01",
        storeName: "Empório do Pão",
        orderedAt: "18/03/2026 17:11",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-20",
        saleDate: "2026-03-20",
        productionDate: "2026-03-19",
        delayed: false,
        productId: "product-1",
        productCode: "PR-02205",
        productName: "Pudim",
        lineId: "line-1",
        lineName: "Linha A",
        sectorId: "sector-1",
        sectorName: "Setor A",
        scheduleId: "schedule-1",
        scheduleCode: "SL-0001",
        scheduleName: "Linha Operacional",
        requestedQuantity: 14,
        requestedUnit: "Un",
        internalKg: 4.35,
        minimumProductionKg: 0,
        expeditionUnit: "Caixa",
        expeditionQuantityRaw: 1,
        expeditionQuantity: 1,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: false,
        productionStarted: false,
        productionItemKey: "2026-03-19|line-1|schedule-1|product-1",
        productionItemStatus: "nao_iniciado",
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: null,
        status: "agendado",
      },
    ],
    productionOrders: [],
    expedition: [],
    expeditionItems: [],
    productionDates: ["2026-03-19"],
    deliveryDates: ["2026-03-20"],
  };

  const filtered = filterFactoryPlanningDataByOperationalScope(planning, baseScope);

  assert.equal(filtered.orders.length, 1);
  assert.equal(filtered.orders[0]?.id, "order-1");
  assert.equal(filtered.orderItems.length, 1);
  assert.equal(filtered.orderItems[0]?.orderId, "order-1");
});

test("factory scope keeps related OP and expedition visible for the same selected demand", () => {
  const planning: FactoryPlanningData = {
    referenceDate: "2026-03-18",
    orders: [
      {
        id: "order-1",
        code: "PD-260318-0012",
        storeId: "store-01",
        storeName: "Empório do Pão",
        orderedAt: "18/03/2026 17:11",
        orderedAtKey: "2026-03-18",
        dPlusLabel: "D+2",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        productionDateLabel: "20/03/2026",
        itemsCount: 1,
        totalKg: 4.35,
        opsLabel: "OP-260320-001",
        releasedToProduction: true,
        availableForRelease: true,
        workflowProgress: 0,
        status: "agendado",
      },
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        orderCode: "PD-260318-0012",
        storeId: "store-01",
        storeName: "Empório do Pão",
        orderedAt: "18/03/2026 17:11",
        baseDate: "2026-03-18",
        deliveryDate: "2026-03-20",
        saleDate: "2026-03-20",
        productionDate: "2026-03-20",
        delayed: false,
        productId: "product-1",
        productCode: "PR-02205",
        productName: "Pudim",
        lineId: "line-1",
        lineName: "Linha A",
        sectorId: "sector-1",
        sectorName: "Setor A",
        scheduleId: "schedule-1",
        scheduleCode: "SL-0001",
        scheduleName: "Linha Operacional",
        requestedQuantity: 14,
        requestedUnit: "Un",
        internalKg: 4.35,
        minimumProductionKg: 0,
        expeditionUnit: "Caixa",
        expeditionQuantityRaw: 1,
        expeditionQuantity: 1,
        canPlan: true,
        scheduleDayPriority: null,
        availableForRelease: true,
        releasedToProduction: true,
        productionStarted: false,
        productionItemKey: "2026-03-20|line-1|schedule-1|product-1",
        productionItemStatus: "nao_iniciado",
        preparationStages: [...defaultProductPreparationStages],
        workflowProgress: 0,
        opCode: "OP-260320-001",
        status: "agendado",
      },
    ],
    productionOrders: [
      {
        id: "op-1",
        code: "OP-260320-001",
        productionDate: "2026-03-20",
        productionDateLabel: "20/03/2026",
        sectorId: "sector-1",
        sectorName: "Setor A",
        lineId: "line-1",
        lineName: "Linha A",
        scheduleId: "schedule-1",
        scheduleCode: "SL-0001",
        scheduleName: "Linha Operacional",
        itemsCount: 1,
        ordersCount: 1,
        totalKg: 4.35,
        releasedToProduction: true,
        productionStarted: true,
        progress: 0,
        status: "agendado",
        orderCodes: ["PD-260318-0012"],
        items: [
          {
            productId: "product-1",
            productCode: "PR-02205",
            productName: "Pudim",
            productionItemKey: "2026-03-20|line-1|schedule-1|product-1",
            totalKg: 4.35,
            minimumProductionKg: 0,
            belowMinimum: false,
            productionSequence: null,
            progress: 0,
            status: "nao_iniciado",
            preparationStages: [...defaultProductPreparationStages],
            sourceItemsCount: 1,
          },
        ],
        sourceItems: [
          {
            id: "item-1",
            orderId: "order-1",
            orderCode: "PD-260318-0012",
            storeName: "Empório do Pão",
            productId: "product-1",
            productCode: "PR-02205",
            productName: "Pudim",
            requestedQuantity: 14,
            requestedUnit: "Un",
            internalKg: 4.35,
            deliveryDate: "2026-03-20",
            deliveryDateLabel: "20/03/2026",
            saleDate: "2026-03-20",
            saleDateLabel: "20/03/2026",
            expeditionUnit: "Caixa",
            expeditionQuantity: 1,
            productionItemKey: "2026-03-20|line-1|schedule-1|product-1",
            productionSequence: null,
            releasedToProduction: true,
            productionItemStatus: "nao_iniciado",
            workflowProgress: 0,
          },
        ],
      },
    ],
    expedition: [
      {
        id: "exp-1",
        orderId: "order-1",
        orderCode: "PD-260318-0012",
        storeId: "store-01",
        storeName: "Empório do Pão",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        totalKg: 4.35,
        itemsCount: 1,
        itemsSummary: "PR-02205: 14 Un",
        releasedToProduction: true,
        workflowProgress: 0,
        status: "agendado",
        items: [
          {
            itemId: "item-1",
            productId: "product-1",
            productCode: "PR-02205",
            productName: "Pudim",
            requestedQuantity: 14,
            requestedUnit: "Un",
            internalKg: 4.35,
            expeditionQuantityRaw: 1,
            expeditionQuantity: 1,
            expeditionUnit: "Caixa",
            productionDate: "2026-03-20",
            saleDate: "2026-03-20",
            workflowProgress: 0,
          },
        ],
      },
    ],
    expeditionItems: [
      {
        id: "exp-1-item-1",
        expeditionId: "exp-1",
        orderId: "order-1",
        orderCode: "PD-260318-0012",
        storeId: "store-01",
        storeName: "Empório do Pão",
        deliveryDate: "2026-03-20",
        deliveryDateLabel: "20/03/2026",
        status: "agendado",
        productId: "product-1",
        productCode: "PR-02205",
        productName: "Pudim",
        requestedQuantity: 14,
        requestedUnit: "Un",
        internalKg: 4.35,
        expeditionQuantityRaw: 1,
        expeditionQuantity: 1,
        expeditionUnit: "Caixa",
      },
    ],
    productionDates: ["2026-03-20"],
    deliveryDates: ["2026-03-20"],
  };

  const filtered = filterFactoryPlanningDataByOperationalScope(planning, baseScope);

  assert.equal(filtered.orders.length, 1);
  assert.equal(filtered.productionOrders.length, 1);
  assert.equal(filtered.productionOrders[0]?.id, "op-1");
  assert.equal(filtered.expedition.length, 1);
  assert.equal(filtered.expedition[0]?.id, "exp-1");
  assert.equal(filtered.expeditionItems.length, 1);
});
