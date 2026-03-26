import assert from "node:assert/strict";
import test from "node:test";

import { applyFactoryWorkflowState } from "@/lib/factory-workflow-logic";
import {
  buildFactoryPlanningData,
  getOperationalOrderWindow,
  getOperationalTimeline,
  resolveScheduledProductAvailability,
  resolveProductionDateInWindow,
} from "@/lib/factory-planning/engine";
import { defaultProductPreparationStages } from "@/lib/production-planning";
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

test("scheduled availability requires schedule item membership", () => {
  const availability = resolveScheduledProductAvailability(
    "2026-03-17T09:00:00",
    baseStore,
    settings,
    {
      productProductionDays: ["quinta"],
      scheduleItem: null,
    },
  );

  assert.equal(availability.available, false);
  assert.equal(availability.blockedReason, "Produto fora da linha de produção ativa.");
});

test("scheduled availability requires intersection between product and schedule days", () => {
  const availability = resolveScheduledProductAvailability(
    "2026-03-17T09:00:00",
    baseStore,
    settings,
    {
      productProductionDays: ["quinta"],
      scheduleItem: {
        id: "schedule-item-1",
        productionDays: ["segunda"],
      },
    },
  );

  assert.equal(availability.available, false);
  assert.equal(
    availability.blockedReason,
    "Dias da ficha do produto não coincidem com a linha de produção ativa.",
  );
});

test("scheduled availability resolves an earlier production day inside the operational window", () => {
  const availability = resolveScheduledProductAvailability(
    "2026-03-09T09:00:00",
    baseStore,
    settings,
    {
      productProductionDays: ["terca"],
      scheduleItem: {
        id: "schedule-item-1",
        productionDays: ["terca"],
      },
    },
  );

  assert.deepEqual(availability, {
    baseDate: "2026-03-09",
    deliveryDate: "2026-03-11",
    deliveryWeekDay: "quarta",
    productionDate: "2026-03-10",
    available: true,
    delayed: false,
    blockedReason: null,
    matchingDays: ["terca"],
    scheduleItemId: "schedule-item-1",
  });
});

test("operational timeline derives sale day after delivery", () => {
  const timeline = getOperationalTimeline(
    "2026-03-17T09:00:00",
    baseStore,
    settings,
    ["quinta"],
    1,
  );

  assert.deepEqual(timeline, {
    baseDate: "2026-03-17",
    deliveryDate: "2026-03-19",
    saleDate: "2026-03-20",
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
      unitProfiles: {
        sales: { unit: "Un", description: "Unidade", weightKg: 0.1 },
        production: { unit: "Kg", description: "Kg", weightKg: 1 },
        expedition: { unit: "Caixa", description: "Caixa", weightKg: 1 },
      },
      packagingProfile: undefined,
      isSoldLoose: true,
      recipe: [],
      preparationStages: [...defaultProductPreparationStages],
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
      items: [
        {
          id: "schedule-item-1",
          productId: "product-1",
          productionDays: ["quinta"],
          minimumProduction: 15,
        },
      ],
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

test("factory planning keeps non-scheduled products out of production and expedition", () => {
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
      unitProfiles: {
        sales: { unit: "Un", description: "Unidade", weightKg: 0.1 },
        production: { unit: "Kg", description: "Kg", weightKg: 1 },
        expedition: { unit: "Caixa", description: "Caixa", weightKg: 1 },
      },
      packagingProfile: undefined,
      isSoldLoose: true,
      recipe: [],
      preparationStages: [...defaultProductPreparationStages],
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
  assert.equal(planning.orderItems[0]?.canPlan, false);
  assert.equal(planning.orderItems[0]?.productionDate, null);
  assert.equal(planning.productionOrders.length, 0);
  assert.equal(planning.orders[0]?.status, "em_espera");
});

test("workflow recognizes orders as ready for expedition when items finish on different days inside the same window", () => {
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
      id: "line-1",
      code: "LP-001",
      name: "Linha Operacional",
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
      name: "Pao Doce",
      description: "",
      lineId: "line-1",
      masterLineId: "line-1",
      operationalLineId: "line-1",
      active: true,
      availableForOrdering: true,
      validityDays: 2,
      minimumProductionKg: 15,
      economicProductionKg: 15,
      allowsStorage: false,
      productionDays: ["terca"],
      unitProfiles: {
        sales: { unit: "Un", description: "Unidade", weightKg: 0.1 },
        production: { unit: "Kg", description: "Kg", weightKg: 1 },
        expedition: { unit: "Caixa", description: "Caixa", weightKg: 1 },
      },
      packagingProfile: undefined,
      isSoldLoose: true,
      recipe: [],
      preparationStages: [...defaultProductPreparationStages],
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
    {
      id: "product-2",
      code: "PR-0002",
      name: "Empada",
      description: "",
      lineId: "line-1",
      masterLineId: "line-1",
      operationalLineId: "line-1",
      active: true,
      availableForOrdering: true,
      validityDays: 2,
      minimumProductionKg: 15,
      economicProductionKg: 15,
      allowsStorage: false,
      productionDays: ["quarta"],
      unitProfiles: {
        sales: { unit: "Un", description: "Unidade", weightKg: 0.1 },
        production: { unit: "Kg", description: "Kg", weightKg: 1 },
        expedition: { unit: "Caixa", description: "Caixa", weightKg: 1 },
      },
      packagingProfile: undefined,
      isSoldLoose: true,
      recipe: [],
      preparationStages: [...defaultProductPreparationStages],
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
      lineId: "line-1",
      status: "ativo",
      createdAt: "2026-03-09T08:00:00.000Z",
      createdBy: "Fernanda",
      items: [
        {
          id: "schedule-item-1",
          productId: "product-1",
          productionDays: ["terca"],
          minimumProduction: 15,
        },
        {
          id: "schedule-item-2",
          productId: "product-2",
          productionDays: ["quarta"],
          minimumProduction: 15,
        },
      ],
    },
  ];

  const planning = buildFactoryPlanningData("2026-03-11", {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-09T09:00:00.000Z",
        items: [
          {
            id: "item-1",
            productId: "product-1",
            quantity: 10,
            unit: "Un",
          },
          {
            id: "item-2",
            productId: "product-2",
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

  assert.equal(planning.orderItems.find((item) => item.productId === "product-1")?.productionDate, "2026-03-10");
  assert.equal(planning.orderItems.find((item) => item.productId === "product-1")?.canPlan, true);
  assert.equal(planning.orderItems.find((item) => item.productId === "product-2")?.productionDate, "2026-03-11");

  const result = applyFactoryWorkflowState(planning, {
    isReleased: () => true,
    isCancelled: () => false,
    resolveProductionItemStatus: (itemKey) => {
      if (itemKey === "2026-03-10|line-1|schedule-1|product-1") {
        return "concluido";
      }
      if (itemKey === "2026-03-11|line-1|schedule-1|product-2") {
        return "concluido";
      }
      return null;
    },
  });

  assert.equal(result.orders[0]?.workflowProgress, 100);
  assert.equal(result.orders[0]?.status, "aguardando_expedicao");
  assert.equal(result.expedition[0]?.status, "aguardando_expedicao");
});
