import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFactoryPlanningData,
  getOperationalOrderWindow,
  getOperationalTimeline,
  resolveProductionDateInWindow,
} from "@/lib/factory-planning/engine";
import type {
  OperationalSettings,
  ProductionLine,
  ProductionProduct,
  ProductionSector,
  ProductionWeekDay,
  WeeklyProductionSchedule,
} from "@/lib/production-planning";
import type { StoreProfile } from "@/lib/factory-planning/types";

const baseStore: StoreProfile = {
  id: "store-1",
  code: "LJ-001",
  name: "Loja Centro",
  orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
  receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
  orderingBlockedDays: ["quarta"],
  receivingBlockedDays: ["sexta"],
  receiveWindow: "07:00 - 10:00",
};

const settings: OperationalSettings = {
  orderCutoffTime: "18:00",
  expeditionLeadDays: 2,
};

test("operational order window respects cutoff and blocked weekdays", () => {
  const window = getOperationalOrderWindow("2026-03-17T19:30:00", baseStore, settings);

  assert.deepEqual(window, {
    baseDate: "2026-03-19",
    deliveryDate: "2026-03-21",
  });
});

test("production date resolves inside the base/delivery window when possible", () => {
  const planning = resolveProductionDateInWindow("2026-03-19", "2026-03-21", [
    "quinta",
    "sabado",
  ] satisfies ProductionWeekDay[]);

  assert.deepEqual(planning, {
    date: "2026-03-21",
    delayed: false,
  });
});

test("operational timeline falls forward when no production day exists inside the window", () => {
  const timeline = getOperationalTimeline("2026-03-17T19:30:00", baseStore, settings, [
    "segunda",
  ]);

  assert.deepEqual(timeline, {
    baseDate: "2026-03-19",
    deliveryDate: "2026-03-23",
    saleDate: "2026-03-23",
    productionDate: "2026-03-23",
    delayed: true,
  });
});

test("operational timeline calculates sale date after delivery lead time", () => {
  const timeline = getOperationalTimeline(
    "2026-03-17T09:00:00",
    baseStore,
    settings,
    ["quinta", "sabado"],
    2,
  );

  assert.deepEqual(timeline, {
    baseDate: "2026-03-17",
    deliveryDate: "2026-03-19",
    saleDate: "2026-03-21",
    productionDate: "2026-03-19",
    delayed: false,
  });
});

test("factory planning uses operational subcategory instead of cadastral subcategory", () => {
  const sectors: ProductionSector[] = [
    {
      id: "sector-1",
      code: "SE-001",
      name: "Panificacao",
      responsible: "Maria",
      status: "ativo",
    },
  ];
  const lines: ProductionLine[] = [
    {
      id: "line-master",
      code: "LP-001",
      name: "Cadastro Base",
      sectorId: "sector-1",
      type: "Seco",
      operatingHours: "05:00 - 14:00",
      capacityPerDayKg: 1000,
      status: "ativo",
    },
    {
      id: "line-operational",
      code: "LP-002",
      name: "Carteira Operacional",
      sectorId: "sector-1",
      type: "Seco",
      operatingHours: "05:00 - 14:00",
      capacityPerDayKg: 1000,
      status: "ativo",
    },
  ];
  const products: ProductionProduct[] = [
    {
      id: "product-1",
      code: "PR-0001",
      name: "Pao Frances",
      description: "",
      lineId: "line-master",
      masterLineId: "line-master",
      operationalLineId: "line-operational",
      active: true,
      availableForOrdering: true,
      validityDays: 2,
      minimumProductionKg: 15,
      economicProductionKg: 15,
      allowsStorage: false,
      productionDays: ["quinta"],
      saleLeadDays: 0,
      unitProfiles: {
        sales: { unit: "Un", description: "Unidade", weightKg: 0.1 },
        production: { unit: "Kg", description: "Kg", weightKg: 1 },
        expedition: { unit: "Caixa", description: "Caixa", weightKg: 1 },
      },
      packagingProfile: undefined,
      isSoldLoose: true,
      recipe: [],
      preparationMode: "",
      breakPercent: 0,
      breakStage: "antes_divisao",
      breakComment: "",
      canBeIngredient: false,
      ingredientProfile: undefined,
      weight: "",
      productionUnit: "Kg",
      salesUnit: "Un",
      salesToKgFactor: 0.1,
      expeditionUnit: "Caixa",
      expeditionToKgFactor: 1,
      isMpiIngredient: false,
    },
  ];
  const schedules: WeeklyProductionSchedule[] = [
    {
      id: "schedule-1",
      code: "SL-0001",
      name: "Linha Operacional",
      lineId: "line-operational",
      status: "ativo",
      createdAt: "2026-03-17T10:00:00.000Z",
      createdBy: "Fernanda",
      items: [],
    },
  ];

  const planning = buildFactoryPlanningData("2026-03-19", {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-17T09:00:00.000Z",
        items: [
          {
            id: "item-1",
            productId: "product-1",
            quantity: 10,
            unit: "Un",
          },
        ],
      },
    ],
    settings,
    sectors,
    lines,
    products,
    schedules,
  });

  assert.equal(planning.orderItems.length, 1);
  assert.equal(planning.orderItems[0]?.lineId, "line-operational");
  assert.equal(planning.orderItems[0]?.lineName, "Carteira Operacional");
  assert.equal(planning.orderItems[0]?.scheduleId, "schedule-1");
});
