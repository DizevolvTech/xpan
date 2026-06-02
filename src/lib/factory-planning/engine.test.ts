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
  saleLeadDays: 1,
};

test("operational order window respects cutoff and blocked weekdays", () => {
  const window = getOperationalOrderWindow("2026-03-17T19:30:00", baseStore, settings);

  assert.deepEqual(window, {
    baseDate: "2026-03-19",
    deliveryDate: "2026-03-21",
  });
});

test("production date resolves inside the base/delivery window when possible", () => {
  // produto com gap 0: pode produzir no mesmo dia da entrega
  const planning = resolveProductionDateInWindow(
    "2026-03-19",
    "2026-03-21",
    ["quinta", "sabado"] satisfies ProductionWeekDay[],
    0,
    ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"] satisfies ProductionWeekDay[],
  );

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
      productExpeditionLeadDays: 1,
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
      productExpeditionLeadDays: 1,
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
      productExpeditionLeadDays: 1,
      scheduleItem: {
        id: "schedule-item-1",
        productionDays: ["terca"],
      },
    },
  );

  // pedido segunda, base segunda, entrega quarta (D+2). Bolo gap=1: produção terça (terça+1=quarta) ✓
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
  // gap = 0 (produz e entrega no mesmo dia)
  const timeline = getOperationalTimeline(
    "2026-03-17T09:00:00",
    baseStore,
    settings,
    ["quinta"],
    1,
    0,
  );

  assert.deepEqual(timeline, {
    baseDate: "2026-03-17",
    deliveryDate: "2026-03-19",
    saleDate: "2026-03-20",
    productionDate: "2026-03-19",
    delayed: false,
  });
});

// Cenário do cliente — pedido PD-260429-0001:
// pedido em quarta (29/04), entrega sexta (01/05), 3 bolos com gap=1 individual.
// Só Bolo 5 (produz quinta) deveria estar disponível.

test("availability blocks product when production day + gap < deliveryDate (bolo 4 — produz quarta)", () => {
  const cakeStore: StoreProfile = {
    id: "store-cake",
    code: "LJ-002",
    name: "Loja Bolo",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
    receiveWindow: "07:00 - 10:00",
  };
  const availability = resolveScheduledProductAvailability(
    "2026-04-29T09:00:00",
    cakeStore,
    settings,
    {
      productProductionDays: ["quarta"],
      productExpeditionLeadDays: 1,
      scheduleItem: { id: "schedule-bolo4", productionDays: ["quarta"] },
    },
  );
  assert.equal(availability.available, false);
  assert.equal(availability.deliveryDate, "2026-05-01");
});

test("availability allows product when production day + gap = deliveryDate (bolo 5 — produz quinta)", () => {
  const cakeStore: StoreProfile = {
    id: "store-cake",
    code: "LJ-002",
    name: "Loja Bolo",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
    receiveWindow: "07:00 - 10:00",
  };
  const availability = resolveScheduledProductAvailability(
    "2026-04-29T09:00:00",
    cakeStore,
    settings,
    {
      productProductionDays: ["quinta"],
      productExpeditionLeadDays: 1,
      scheduleItem: { id: "schedule-bolo5", productionDays: ["quinta"] },
    },
  );
  assert.equal(availability.available, true);
  assert.equal(availability.productionDate, "2026-04-30");
  assert.equal(availability.deliveryDate, "2026-05-01");
});

test("availability blocks product when production day + gap > deliveryDate (bolo 6 — produz sexta)", () => {
  const cakeStore: StoreProfile = {
    id: "store-cake",
    code: "LJ-002",
    name: "Loja Bolo",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
    receiveWindow: "07:00 - 10:00",
  };
  const availability = resolveScheduledProductAvailability(
    "2026-04-29T09:00:00",
    cakeStore,
    settings,
    {
      productProductionDays: ["sexta"],
      productExpeditionLeadDays: 1,
      scheduleItem: { id: "schedule-bolo6", productionDays: ["sexta"] },
    },
  );
  assert.equal(availability.available, false);
  assert.equal(availability.deliveryDate, "2026-05-01");
});

test("AJ-0024: variante incompatível (produz só sexta, entrega sexta, lead 1) não agenda produção +7", () => {
  const cakeStore: StoreProfile = {
    id: "store-cake",
    code: "LJ-002",
    name: "Loja Bolo",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
    receiveWindow: "07:00 - 10:00",
  };
  const availability = resolveScheduledProductAvailability(
    "2026-04-29T09:00:00",
    cakeStore,
    settings,
    {
      productProductionDays: ["sexta"],
      productExpeditionLeadDays: 1,
      scheduleItem: { id: "schedule-bolo6", productionDays: ["sexta"] },
    },
  );

  // Bloqueado (já era), mas o ponto do AJ-0024: NÃO pode devolver a sexta seguinte
  // (+7) como `productionDate`. Caía no branch delayed e "agendava" 08/05 — a UI/o
  // catálogo mostravam essa data futura como se o pedido fosse produzir lá.
  assert.equal(availability.available, false);
  assert.equal(availability.delayed, true);
  assert.equal(availability.productionDate, null);
});

test("AJ-0024: branch delayed não rouba a janela válida — variante compatível (quinta) segue na quinta", () => {
  // Regressão: a correção de +7 não pode empurrar uma variante VÁLIDA para delayed.
  const cakeStore: StoreProfile = {
    id: "store-cake",
    code: "LJ-002",
    name: "Loja Bolo",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
    receiveWindow: "07:00 - 10:00",
  };
  const availability = resolveScheduledProductAvailability(
    "2026-04-29T09:00:00",
    cakeStore,
    settings,
    {
      productProductionDays: ["quinta"],
      productExpeditionLeadDays: 1,
      scheduleItem: { id: "schedule-bolo5", productionDays: ["quinta"] },
    },
  );

  assert.equal(availability.available, true);
  assert.equal(availability.delayed, false);
  assert.equal(availability.productionDate, "2026-04-30");
});

test("availability allows fresh bread when gap = 0 (produz e entrega no mesmo dia)", () => {
  const breadStore: StoreProfile = {
    id: "store-bread",
    code: "LJ-003",
    name: "Loja Pão",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
    receiveWindow: "07:00 - 10:00",
  };
  const availability = resolveScheduledProductAvailability(
    "2026-04-29T09:00:00",
    breadStore,
    settings,
    {
      productProductionDays: ["sexta"],
      productExpeditionLeadDays: 0,
      scheduleItem: { id: "schedule-pao", productionDays: ["sexta"] },
    },
  );
  assert.equal(availability.available, true);
  assert.equal(availability.productionDate, "2026-05-01");
  assert.equal(availability.deliveryDate, "2026-05-01");
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
      expeditionLeadDays: 0,
      isMpiIngredient: false,
      capacityPerBatch: null,
      economicBatchUnit: null,
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

test("AJ-0006.1: OP sinaliza demanda consolidada abaixo do lote mínimo da fábrica", () => {
  const sectors: ProductionSector[] = [
    { id: "sector-1", code: "SE-001", name: "Panificacao", responsible: "Maria", status: "ativo" },
  ];
  const lines: ProductionLine[] = [
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
  const buildProduct = (): ProductionProduct => ({
    id: "product-1",
    code: "PR-0001",
    name: "Pao Frances",
    description: "",
    lineId: "line-operational",
    masterLineId: "line-operational",
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
    expeditionLeadDays: 0,
    isMpiIngredient: false,
    capacityPerBatch: null,
    economicBatchUnit: null,
  });
  const schedules: WeeklyProductionSchedule[] = [
    {
      id: "schedule-1",
      code: "SL-0001",
      name: "Linha Operacional",
      lineId: "line-operational",
      status: "ativo",
      createdAt: "2026-03-17T10:00:00.000Z",
      createdBy: "Fernanda",
      items: [{ id: "schedule-item-1", productId: "product-1", productionDays: ["quinta"], minimumProduction: 15 }],
    },
  ];

  // 10 Un × 0,1 kg = 1 kg de demanda consolidada — abaixo do lote mínimo (15 kg).
  const below = buildFactoryPlanningData("2026-03-19", {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-17T09:00:00.000Z",
        items: [{ id: "item-1", productId: "product-1", quantity: 10, unit: "Un" }],
      },
    ],
    settings,
    sectors,
    lines,
    products: [buildProduct()],
    schedules,
  });

  const belowItem = below.productionOrders[0]?.items[0];
  assert.equal(belowItem?.minimumProductionKg, 15);
  assert.equal(belowItem?.belowMinimum, true);

  // 200 Un × 0,1 kg = 20 kg — acima do lote mínimo: não sinaliza.
  const above = buildFactoryPlanningData("2026-03-19", {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-2",
        code: "PD-0002",
        storeId: "store-1",
        orderedAt: "2026-03-17T09:00:00.000Z",
        items: [{ id: "item-2", productId: "product-1", quantity: 200, unit: "Un" }],
      },
    ],
    settings,
    sectors,
    lines,
    products: [buildProduct()],
    schedules,
  });

  const aboveItem = above.productionOrders[0]?.items[0];
  assert.equal(aboveItem?.belowMinimum, false);
});

test("OP de produto batido divide a demanda em batidas (enche + sobra na última)", () => {
  const sectors: ProductionSector[] = [
    { id: "sector-1", code: "SE-001", name: "Panificacao", responsible: "Maria", status: "ativo" },
  ];
  const lines: ProductionLine[] = [
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
  const product: ProductionProduct = {
    id: "product-1",
    code: "PR-0001",
    name: "Pao Batido",
    description: "",
    lineId: "line-operational",
    masterLineId: "line-operational",
    operationalLineId: "line-operational",
    active: true,
    availableForOrdering: true,
    validityDays: 2,
    minimumProductionKg: 0,
    economicProductionKg: 0,
    allowsStorage: false,
    productionDays: ["quinta"],
    unitProfiles: {
      sales: { unit: "Un", description: "Unidade", weightKg: 0.11 },
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
    salesToKgFactor: 0.11,
    expeditionUnit: "Caixa",
    expeditionToKgFactor: 1,
    expeditionLeadDays: 0,
    isMpiIngredient: false,
    capacityPerBatch: 100,
    economicBatchUnit: null,
  };
  const schedules: WeeklyProductionSchedule[] = [
    {
      id: "schedule-1",
      code: "SL-0001",
      name: "Linha Operacional",
      lineId: "line-operational",
      status: "ativo",
      createdAt: "2026-03-17T10:00:00.000Z",
      createdBy: "Fernanda",
      items: [{ id: "schedule-item-1", productId: "product-1", productionDays: ["quinta"], minimumProduction: 0 }],
    },
  ];

  // 456 Un × 0,11 kg ≈ 50,16 kg → 456 Un / capacidade 100 = 5 batidas [100,100,100,100,56].
  const planning = buildFactoryPlanningData("2026-03-19", {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-17T09:00:00.000Z",
        items: [{ id: "item-1", productId: "product-1", quantity: 456, unit: "Un" }],
      },
    ],
    settings,
    sectors,
    lines,
    products: [product],
    schedules,
  });

  const opItem = planning.productionOrders[0]?.items[0];
  assert.equal(opItem?.batchCount, 5);
  assert.deepEqual(opItem?.batchSizes, [100, 100, 100, 100, 56]);
  assert.equal(opItem?.batchUnitLabel, "Un");
  assert.equal(opItem?.batchesDone, 0);
  assert.equal(opItem?.status, "nao_iniciado");
});

test("production orders keep the daily schedule priority when listing products", () => {
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
      id: "product-a",
      code: "PR-0001",
      name: "Pao A",
      description: "",
      lineId: "line-operational",
      masterLineId: "line-operational",
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
      expeditionLeadDays: 0,
      isMpiIngredient: false,
      capacityPerBatch: null,
      economicBatchUnit: null,
    },
    {
      id: "product-b",
      code: "PR-0002",
      name: "Pao B",
      description: "",
      lineId: "line-operational",
      masterLineId: "line-operational",
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
      expeditionLeadDays: 0,
      isMpiIngredient: false,
      capacityPerBatch: null,
      economicBatchUnit: null,
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
          id: "schedule-item-a",
          productId: "product-a",
          productionDays: ["quinta"],
          minimumProduction: 15,
          dayPriorities: { quinta: 2 },
        },
        {
          id: "schedule-item-b",
          productId: "product-b",
          productionDays: ["quinta"],
          minimumProduction: 15,
          dayPriorities: { quinta: 1 },
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
            productId: "product-a",
            quantity: 10,
            unit: "Un",
          },
          {
            id: "item-2",
            productId: "product-b",
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

  assert.deepEqual(
    planning.productionOrders[0]?.items.map((item) => item.productId),
    ["product-b", "product-a"],
  );
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
      expeditionLeadDays: 0,
      isMpiIngredient: false,
      capacityPerBatch: null,
      economicBatchUnit: null,
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
      expeditionLeadDays: 1,
      isMpiIngredient: false,
      capacityPerBatch: null,
      economicBatchUnit: null,
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
      expeditionLeadDays: 0,
      isMpiIngredient: false,
      capacityPerBatch: null,
      economicBatchUnit: null,
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
      // Chave canônica estável (3 partes, sem scheduleId) — ver getProductionItemKey.
      if (itemKey === "2026-03-10|line-1|product-1") {
        return "concluido";
      }
      if (itemKey === "2026-03-11|line-1|product-2") {
        return "concluido";
      }
      return null;
    },
  });

  assert.equal(result.orders[0]?.workflowProgress, 100);
  assert.equal(result.orders[0]?.status, "aguardando_expedicao");
  assert.equal(result.expedition[0]?.status, "aguardando_expedicao");
});

// ---------------------------------------------------------------------------
// AJ-0008 / ADR_expansao_mpi_em_op — integração: motor expande MPI em OP
// separada apenas com EXPAND_MPI_INTO_OPS=true. Cobre o cenário canônico
// da Call 2026-05-13 (Bloco 4): "loja pede pizza → sistema gera OP da
// pizza E uma OP separada da massa de pizza".
// ---------------------------------------------------------------------------

function withMpiExpansion<T>(fn: () => T): T {
  // Default da flag agora é ON. Mantemos o wrapper para explicitar intenção
  // no nome do teste e garantir o estado mesmo se outro teste tiver mexido na env.
  const previous = process.env.EXPAND_MPI_INTO_OPS;
  delete process.env.EXPAND_MPI_INTO_OPS;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.EXPAND_MPI_INTO_OPS;
    else process.env.EXPAND_MPI_INTO_OPS = previous;
  }
}

function withMpiExpansionDisabled<T>(fn: () => T): T {
  const previous = process.env.EXPAND_MPI_INTO_OPS;
  process.env.EXPAND_MPI_INTO_OPS = "false";
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.EXPAND_MPI_INTO_OPS;
    else process.env.EXPAND_MPI_INTO_OPS = previous;
  }
}

function buildPizzaScenario() {
  const sectors: ProductionSector[] = [
    { id: "sector-1", code: "SE-001", name: "Salgados", responsible: "Ana", status: "ativo" },
  ];
  const lines: ProductionLine[] = [
    {
      id: "line-1",
      code: "LP-001",
      name: "Linha Forno",
      sectorId: "sector-1",
      type: "Seco",
      operatingHours: "05:00 - 14:00",
      capacityPerDayKg: 1000,
      status: "ativo",
    },
  ];
  const massa: ProductionProduct = {
    id: "mpi-massa",
    code: "MPI-001",
    name: "Massa de Pizza",
    description: "",
    lineId: "line-1",
    masterLineId: "line-1",
    operationalLineId: "line-1",
    active: true,
    availableForOrdering: false,
    validityDays: 1,
    minimumProductionKg: 0,
    economicProductionKg: 0,
    allowsStorage: false,
    productionDays: ["quinta"],
    expeditionLeadDays: 0,
    unitProfiles: {
      sales: { unit: "Kg", description: "kg", weightKg: 1 },
      production: { unit: "Kg", description: "kg", weightKg: 1 },
      expedition: { unit: "Kg", description: "kg", weightKg: 1 },
    },
    isSoldLoose: false,
    recipe: [],
    preparationStages: [...defaultProductPreparationStages],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "antes_divisao",
    breakComment: "",
    canBeIngredient: true,
    weight: "",
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    isMpiIngredient: true,
    capacityPerBatch: null,
    economicBatchUnit: null,
  };
  const pizza: ProductionProduct = {
    id: "pizza",
    code: "PZ-001",
    name: "Pizza Margherita",
    description: "",
    lineId: "line-1",
    masterLineId: "line-1",
    operationalLineId: "line-1",
    active: true,
    availableForOrdering: true,
    validityDays: 1,
    minimumProductionKg: 0,
    economicProductionKg: 0,
    allowsStorage: false,
    productionDays: ["quinta"],
    expeditionLeadDays: 0,
    unitProfiles: {
      sales: { unit: "Un", description: "Unidade", weightKg: 0.25 },
      production: { unit: "Kg", description: "kg", weightKg: 1 },
      expedition: { unit: "Kg", description: "kg", weightKg: 1 },
    },
    isSoldLoose: false,
    recipe: [
      { id: "r1", sourceType: "ingrediente", sourceId: "farinha", label: "Farinha", quantity: 0.6, unit: "Kg" },
      { id: "r2", sourceType: "produto", sourceId: "mpi-massa", label: "Massa", quantity: 0.4, unit: "Kg" },
    ],
    preparationStages: [...defaultProductPreparationStages],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "antes_divisao",
    breakComment: "",
    canBeIngredient: false,
    weight: "",
    productionUnit: "Kg",
    salesUnit: "Un",
    salesToKgFactor: 0.25,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    isMpiIngredient: false,
    capacityPerBatch: null,
    economicBatchUnit: null,
  };
  const schedules: WeeklyProductionSchedule[] = [
    {
      id: "schedule-1",
      code: "SL-0001",
      name: "Cronograma Forno",
      lineId: "line-1",
      status: "ativo",
      createdAt: "2026-03-17T10:00:00.000Z",
      createdBy: "Ana",
      items: [
        { id: "si-pizza", productId: "pizza", productionDays: ["quinta"], minimumProduction: 1 },
        { id: "si-massa", productId: "mpi-massa", productionDays: ["quinta"], minimumProduction: 1 },
      ],
    },
  ];

  return { sectors, lines, products: [pizza, massa], schedules };
}

test("buildFactoryPlanningData expande MPI quando flag ligada — pedido de pizza gera OP da massa", () => {
  withMpiExpansion(() => {
    const { sectors, lines, products, schedules } = buildPizzaScenario();
    const planning = buildFactoryPlanningData("2026-03-19", {
      stores: [baseStore],
      storeOrders: [
        {
          id: "order-1",
          code: "PD-0001",
          storeId: "store-1",
          orderedAt: "2026-03-17T09:00:00.000Z",
          items: [{ id: "item-1", productId: "pizza", quantity: 8, unit: "Un" }],
        },
      ],
      settings,
      sectors,
      lines,
      products,
      schedules,
    });

    const opsByProduct = new Map(planning.productionOrders.flatMap((op) => op.items.map((item) => [item.productId, item])));
    assert.ok(opsByProduct.has("pizza"), "OP da pizza presente");
    assert.ok(opsByProduct.has("mpi-massa"), "OP da massa (MPI) também presente — comportamento que o cliente pediu");
    // 8 pizzas × 0.25kg/un = 2kg de pizza. Receita base 1kg → 0.4kg de massa por kg → 0.8kg de massa.
    assert.equal(opsByProduct.get("mpi-massa")?.totalKg, 0.8);
  });
});

test("buildFactoryPlanningData soma demanda de MPI em uma única OP quando flag ligada", () => {
  withMpiExpansion(() => {
    const { sectors, lines, products, schedules } = buildPizzaScenario();
    // Dois pedidos da mesma pizza, mesmo dia → motor deve gerar UMA OP de pizza
    // (já agrupa por design) E UMA OP de massa somada (graças à mesma planning key).
    const planning = buildFactoryPlanningData("2026-03-19", {
      stores: [baseStore],
      storeOrders: [
        {
          id: "order-1",
          code: "PD-0001",
          storeId: "store-1",
          orderedAt: "2026-03-17T09:00:00.000Z",
          items: [{ id: "item-1", productId: "pizza", quantity: 8, unit: "Un" }],
        },
        {
          id: "order-2",
          code: "PD-0002",
          storeId: "store-1",
          orderedAt: "2026-03-17T10:00:00.000Z",
          items: [{ id: "item-2", productId: "pizza", quantity: 4, unit: "Un" }],
        },
      ],
      settings,
      sectors,
      lines,
      products,
      schedules,
    });

    const massaOps = planning.productionOrders.flatMap((op) =>
      op.items.filter((item) => item.productId === "mpi-massa"),
    );
    assert.equal(massaOps.length, 1, "demanda de massa de 2 pedidos vira UMA OP");
    // Pizza total: 12un × 0.25kg = 3kg. Massa = 0.4kg/kg × 3kg = 1.2kg.
    assert.equal(massaOps[0]?.totalKg, 1.2);
    assert.equal(massaOps[0]?.sourceItemsCount, 2, "duas fontes (uma por pedido) contam para o agrupamento");
  });
});

test("buildFactoryPlanningData respeita escape hatch EXPAND_MPI_INTO_OPS=false (rollback sem deploy)", () => {
  withMpiExpansionDisabled(() => {
    const { sectors, lines, products, schedules } = buildPizzaScenario();
    const planning = buildFactoryPlanningData("2026-03-19", {
      stores: [baseStore],
      storeOrders: [
        {
          id: "order-1",
          code: "PD-0001",
          storeId: "store-1",
          orderedAt: "2026-03-17T09:00:00.000Z",
          items: [{ id: "item-1", productId: "pizza", quantity: 8, unit: "Un" }],
        },
      ],
      settings,
      sectors,
      lines,
      products,
      schedules,
    });

    const productIds = new Set(planning.productionOrders.flatMap((op) => op.items.map((item) => item.productId)));
    assert.ok(productIds.has("pizza"), "pizza presente");

    // Escape hatch da EXPANSÃO MPI: nenhuma DEMANDA de massa derivada da receita.
    // (A massa ainda pode aparecer como SLOT do cronograma — FASE 1 — mas com qtd 0
    // e demandSource "cronograma", nunca como demanda expandida do pedido de pizza.)
    const massaDemandItems = planning.orderItems.filter(
      (item) => item.productId === "mpi-massa" && item.demandSource === "pedido",
    );
    assert.equal(
      massaDemandItems.length,
      0,
      "massa NÃO deve ganhar demanda via expansão quando EXPAND_MPI_INTO_OPS=false (escape hatch)",
    );
    const massaOpItems = planning.productionOrders.flatMap((op) =>
      op.items.filter((item) => item.productId === "mpi-massa"),
    );
    massaOpItems.forEach((item) =>
      assert.equal(item.totalKg, 0, "qualquer slot de massa visível é do cronograma (qtd 0), não demanda expandida"),
    );
  });
});

// ---------------------------------------------------------------------------
// FASE 1 — Esqueleto do cronograma (slots produto×linha×dia sem pedido, qtd 0).
// O cronograma ativo deve "preencher" a produção do dia mesmo sem pedido. Onde
// há pedido, o item real vence a lacuna (qtd real, demandSource "pedido"); onde
// não há, aparece um slot do cronograma com totalKg 0 e demandSource "cronograma".
// ---------------------------------------------------------------------------

const skeletonSectors: ProductionSector[] = [
  { id: "sector-1", code: "SE-001", name: "Panificacao", responsible: "Maria", status: "ativo" },
];

const skeletonLines: ProductionLine[] = [
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

function buildSkeletonProduct(
  overrides: Partial<ProductionProduct> & Pick<ProductionProduct, "id" | "code" | "name">,
): ProductionProduct {
  return {
    description: "",
    lineId: "line-operational",
    masterLineId: "line-operational",
    operationalLineId: "line-operational",
    active: true,
    availableForOrdering: true,
    validityDays: 2,
    minimumProductionKg: 0,
    economicProductionKg: 0,
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
    expeditionLeadDays: 0,
    isMpiIngredient: false,
    capacityPerBatch: null,
    economicBatchUnit: null,
    ...overrides,
  } as ProductionProduct;
}

// referenceDate quarta (2026-03-18); horizonte de 7 dias [18/03, 25/03) cobre exatamente
// uma quarta (o próprio 18/03). Pedido feito 16/03 produz 18/03 (lead 0).
const SKELETON_REFERENCE_WEDNESDAY = "2026-03-18";

test("Fase 1: cronograma ativo gera slot qtd 0 (demandSource cronograma) sem pedido nenhum", () => {
  const products = [buildSkeletonProduct({ id: "product-1", code: "PR-0001", name: "Pao Quarta" })];
  const schedules: WeeklyProductionSchedule[] = [
    {
      id: "schedule-1",
      code: "SL-0001",
      name: "Linha Operacional",
      lineId: "line-operational",
      status: "ativo",
      createdAt: "2026-03-10T10:00:00.000Z",
      createdBy: "Fernanda",
      items: [{ id: "schedule-item-1", productId: "product-1", productionDays: ["quarta"], minimumProduction: 0 }],
    },
  ];

  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules,
  });

  const ops = planning.productionOrders.filter((op) => op.productionDate === SKELETON_REFERENCE_WEDNESDAY);
  assert.equal(ops.length, 1, "uma OP na quarta a partir do cronograma");
  const items = ops[0]!.items;
  assert.equal(items.length, 1, "um item de produto");
  assert.equal(items[0]?.productId, "product-1");
  assert.equal(items[0]?.totalKg, 0, "slot sem demanda tem totalKg 0");

  const skeletonItem = planning.orderItems.find((item) => item.productId === "product-1");
  assert.ok(skeletonItem, "item esqueleto presente em orderItems");
  assert.equal(skeletonItem?.demandSource, "cronograma");
  assert.equal(skeletonItem?.internalKg, 0);
  assert.equal(skeletonItem?.canPlan, true);
  assert.equal(skeletonItem?.productionDate, SKELETON_REFERENCE_WEDNESDAY);
});

test("Fase 1: pedido na quarta vence a lacuna — qtd real, sem duplicar, demandSource pedido", () => {
  const products = [buildSkeletonProduct({ id: "product-1", code: "PR-0001", name: "Pao Quarta" })];
  const schedules: WeeklyProductionSchedule[] = [
    {
      id: "schedule-1",
      code: "SL-0001",
      name: "Linha Operacional",
      lineId: "line-operational",
      status: "ativo",
      createdAt: "2026-03-10T10:00:00.000Z",
      createdBy: "Fernanda",
      items: [{ id: "schedule-item-1", productId: "product-1", productionDays: ["quarta"], minimumProduction: 0 }],
    },
  ];

  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-16T09:00:00.000Z",
        items: [{ id: "item-1", productId: "product-1", quantity: 50, unit: "Un" }],
      },
    ],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules,
  });

  const ops = planning.productionOrders.filter((op) => op.productionDate === SKELETON_REFERENCE_WEDNESDAY);
  assert.equal(ops.length, 1);
  const items = ops[0]!.items;
  assert.equal(items.length, 1, "não duplica: um único item para o produto");
  assert.equal(items[0]?.productId, "product-1");
  // 50 Un × 0,1 kg = 5 kg (demanda real do pedido vence o slot vazio).
  assert.equal(items[0]?.totalKg, 5);

  const realItems = planning.orderItems.filter((item) => item.productId === "product-1");
  assert.equal(realItems.length, 1, "só o item real do pedido — nenhum esqueleto duplicado");
  assert.equal(realItems[0]?.demandSource, "pedido");
  assert.equal(realItems[0]?.internalKg, 5);
});

test("Fase 1: cenário misto — A com pedido (qtd) e B sem pedido (qtd 0) na mesma linha/dia", () => {
  const products = [
    buildSkeletonProduct({ id: "product-a", code: "PR-000A", name: "Pao A" }),
    buildSkeletonProduct({ id: "product-b", code: "PR-000B", name: "Pao B" }),
  ];
  const schedules: WeeklyProductionSchedule[] = [
    {
      id: "schedule-1",
      code: "SL-0001",
      name: "Linha Operacional",
      lineId: "line-operational",
      status: "ativo",
      createdAt: "2026-03-10T10:00:00.000Z",
      createdBy: "Fernanda",
      items: [
        { id: "si-a", productId: "product-a", productionDays: ["quarta"], minimumProduction: 0 },
        { id: "si-b", productId: "product-b", productionDays: ["quarta"], minimumProduction: 0 },
      ],
    },
  ];

  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-16T09:00:00.000Z",
        items: [{ id: "item-1", productId: "product-a", quantity: 30, unit: "Un" }],
      },
    ],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules,
  });

  const ops = planning.productionOrders.filter((op) => op.productionDate === SKELETON_REFERENCE_WEDNESDAY);
  assert.equal(ops.length, 1, "A e B compartilham linha/dia → uma OP só");
  const byProduct = new Map(ops[0]!.items.map((item) => [item.productId, item]));
  assert.equal(byProduct.get("product-a")?.totalKg, 3, "A: 30 Un × 0,1 = 3 kg");
  assert.equal(byProduct.get("product-b")?.totalKg, 0, "B: slot do cronograma, qtd 0");

  const itemA = planning.orderItems.find((item) => item.productId === "product-a");
  const itemB = planning.orderItems.find((item) => item.productId === "product-b");
  assert.equal(itemA?.demandSource, "pedido");
  assert.equal(itemB?.demandSource, "cronograma");
});

test("Fase 1 regressão: item real mantém productionItemKey e status iguais (esqueleto não altera reais)", () => {
  const products = [buildSkeletonProduct({ id: "product-1", code: "PR-0001", name: "Pao Quarta" })];
  const schedules: WeeklyProductionSchedule[] = [
    {
      id: "schedule-1",
      code: "SL-0001",
      name: "Linha Operacional",
      lineId: "line-operational",
      status: "ativo",
      createdAt: "2026-03-10T10:00:00.000Z",
      createdBy: "Fernanda",
      items: [{ id: "schedule-item-1", productId: "product-1", productionDays: ["quarta"], minimumProduction: 0 }],
    },
  ];

  const orderInput = {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-16T09:00:00.000Z",
        items: [{ id: "item-1", productId: "product-1", quantity: 50, unit: "Un" as const }],
      },
    ],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules,
  };

  // Sem esqueleto seria impossível desligar via flag, então comparamos contra os
  // invariantes documentados: chave canônica 3 partes + status agendado/em_producao.
  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, orderInput);
  const realItem = planning.orderItems.find((item) => item.id === "item-1");
  assert.ok(realItem);
  assert.equal(realItem?.productionItemKey, "2026-03-18|line-operational|product-1");
  // referenceDate === productionDate → em_producao (getPotentialItemStatus).
  assert.equal(realItem?.status, "em_producao");
  assert.equal(realItem?.demandSource, "pedido");
});

test("Fase 1: produto cujo dia NÃO intersecta o cronograma não gera slot (nem esqueleto)", () => {
  // Produto produz quinta, cronograma só libera o item na terca → interseção vazia.
  const products = [
    buildSkeletonProduct({ id: "product-1", code: "PR-0001", name: "Pao Quinta", productionDays: ["quinta"] }),
  ];
  const schedules: WeeklyProductionSchedule[] = [
    {
      id: "schedule-1",
      code: "SL-0001",
      name: "Linha Operacional",
      lineId: "line-operational",
      status: "ativo",
      createdAt: "2026-03-10T10:00:00.000Z",
      createdBy: "Fernanda",
      items: [{ id: "schedule-item-1", productId: "product-1", productionDays: ["terca"], minimumProduction: 0 }],
    },
  ];

  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules,
  });

  assert.equal(planning.productionOrders.length, 0, "sem interseção de dias → nenhuma OP");
  assert.equal(
    planning.orderItems.filter((item) => item.demandSource === "cronograma").length,
    0,
    "nenhum slot esqueleto criado",
  );
});

// ---------------------------------------------------------------------------
// FASE 2 — Blindagem do slot sem demanda. Um slot do cronograma (sem pedido,
// qtd 0) é APENAS visão de planejamento: não é liberável, propaga demandSource
// até a OP, não vira "OP com demanda", e não entra na avaliação de entrega.
// ---------------------------------------------------------------------------

const phase2Schedule: WeeklyProductionSchedule = {
  id: "schedule-1",
  code: "SL-0001",
  name: "Linha Operacional",
  lineId: "line-operational",
  status: "ativo",
  createdAt: "2026-03-10T10:00:00.000Z",
  createdBy: "Fernanda",
  items: [{ id: "schedule-item-1", productId: "product-1", productionDays: ["quarta"], minimumProduction: 0 }],
};

test("Fase 2: slot de esqueleto NÃO é liberável (availableForRelease false)", () => {
  const products = [buildSkeletonProduct({ id: "product-1", code: "PR-0001", name: "Pao Quarta" })];

  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules: [phase2Schedule],
  });

  const skeletonItem = planning.orderItems.find((item) => item.demandSource === "cronograma");
  assert.ok(skeletonItem, "slot esqueleto presente");
  assert.equal(skeletonItem?.availableForRelease, false, "esqueleto não tem o que liberar");
  assert.equal(skeletonItem?.releasedToProduction, false);
});

test("Fase 2: OP só de esqueleto → item demandSource 'cronograma' e OP hasDemand false", () => {
  const products = [buildSkeletonProduct({ id: "product-1", code: "PR-0001", name: "Pao Quarta" })];

  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules: [phase2Schedule],
  });

  const op = planning.productionOrders.find((o) => o.productionDate === SKELETON_REFERENCE_WEDNESDAY);
  assert.ok(op, "OP de esqueleto existe (visão de planejamento)");
  assert.equal(op?.hasDemand, false, "OP só de slots qtd 0 não tem demanda");
  assert.equal(op?.items[0]?.demandSource, "cronograma");
  assert.equal(op?.items[0]?.totalKg, 0);
});

test("Fase 2: OP com pedido → item demandSource 'pedido' e OP hasDemand true", () => {
  const products = [buildSkeletonProduct({ id: "product-1", code: "PR-0001", name: "Pao Quarta" })];

  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-16T09:00:00.000Z",
        items: [{ id: "item-1", productId: "product-1", quantity: 50, unit: "Un" }],
      },
    ],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules: [phase2Schedule],
  });

  const op = planning.productionOrders.find((o) => o.productionDate === SKELETON_REFERENCE_WEDNESDAY);
  assert.ok(op);
  assert.equal(op?.hasDemand, true, "pedido real → OP tem demanda");
  assert.equal(op?.items[0]?.demandSource, "pedido");
  assert.equal(op?.items[0]?.totalKg, 5);
});

test("Fase 2: OP mista (A com pedido, B só esqueleto) → hasDemand true; demandSource por item", () => {
  const products = [
    buildSkeletonProduct({ id: "product-a", code: "PR-000A", name: "Pao A" }),
    buildSkeletonProduct({ id: "product-b", code: "PR-000B", name: "Pao B" }),
  ];
  const schedules: WeeklyProductionSchedule[] = [
    {
      ...phase2Schedule,
      items: [
        { id: "si-a", productId: "product-a", productionDays: ["quarta"], minimumProduction: 0 },
        { id: "si-b", productId: "product-b", productionDays: ["quarta"], minimumProduction: 0 },
      ],
    },
  ];

  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-16T09:00:00.000Z",
        items: [{ id: "item-1", productId: "product-a", quantity: 30, unit: "Un" }],
      },
    ],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules,
  });

  const op = planning.productionOrders.find((o) => o.productionDate === SKELETON_REFERENCE_WEDNESDAY);
  assert.ok(op);
  assert.equal(op?.hasDemand, true, "ao menos um item com kg > 0 → OP tem demanda");
  const byProduct = new Map(op!.items.map((it) => [it.productId, it]));
  assert.equal(byProduct.get("product-a")?.demandSource, "pedido");
  assert.equal(byProduct.get("product-b")?.demandSource, "cronograma");
});

test("Fase 2 (chão): rebuild por itens liberados NÃO inclui esqueleto", () => {
  // Pedido para A (liberado) + esqueleto de B (sem pedido). applyFactoryWorkflowState
  // reconstrói as OPs só dos itens liberados → o esqueleto não desce pro chão.
  const products = [
    buildSkeletonProduct({ id: "product-a", code: "PR-000A", name: "Pao A" }),
    buildSkeletonProduct({ id: "product-b", code: "PR-000B", name: "Pao B" }),
  ];
  const schedules: WeeklyProductionSchedule[] = [
    {
      ...phase2Schedule,
      items: [
        { id: "si-a", productId: "product-a", productionDays: ["quarta"], minimumProduction: 0 },
        { id: "si-b", productId: "product-b", productionDays: ["quarta"], minimumProduction: 0 },
      ],
    },
  ];

  const base = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [
      {
        id: "order-1",
        code: "PD-0001",
        storeId: "store-1",
        orderedAt: "2026-03-16T09:00:00.000Z",
        items: [{ id: "item-1", productId: "product-a", quantity: 30, unit: "Un" }],
      },
    ],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules,
  });

  const applied = applyFactoryWorkflowState(base, {
    isReleased: (orderId) => orderId === "order-1",
    isCancelled: () => false,
    resolveProductionItemStatus: () => "nao_iniciado",
  });

  // Nenhum item de esqueleto entra como liberado.
  assert.equal(
    applied.orderItems.some((item) => item.demandSource === "cronograma" && item.releasedToProduction),
    false,
    "esqueleto nunca é releasedToProduction",
  );

  // A OP reconstruída só contém o item com demanda real (A); B (esqueleto) sumiu.
  const op = applied.productionOrders.find((o) => o.productionDate === SKELETON_REFERENCE_WEDNESDAY);
  assert.ok(op, "OP reconstruída dos liberados");
  assert.equal(op?.hasDemand, true);
  const productIds = op!.items.map((it) => it.productId);
  assert.deepEqual(productIds, ["product-a"], "só o item liberado com demanda real entra no chão");
});

test("Fase 2 (métrica): ocupação/produção iguais com e sem slots de esqueleto", () => {
  // Reproduz o cálculo de ocupação/produzido de computeFactoryMetrics
  // (factory-metrics.ts): soma totalKg por linha das OPs com demanda, no dia de
  // referência, depois de aplicar o workflow. Prova que os slots de esqueleto
  // (hasDemand false) NÃO mudam os números.
  const products = [
    buildSkeletonProduct({ id: "product-a", code: "PR-000A", name: "Pao A" }),
    buildSkeletonProduct({ id: "product-b", code: "PR-000B", name: "Pao B" }),
  ];
  const storeOrders = [
    {
      id: "order-1",
      code: "PD-0001",
      storeId: "store-1",
      orderedAt: "2026-03-16T09:00:00.000Z",
      items: [{ id: "item-1", productId: "product-a", quantity: 30, unit: "Un" as const }],
    },
  ];

  // COM cronograma: gera esqueleto de B (sem pedido) + slot real de A.
  const withSkeleton = applyFactoryWorkflowState(
    buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
      stores: [baseStore],
      storeOrders,
      settings,
      sectors: skeletonSectors,
      lines: skeletonLines,
      products,
      schedules: [
        {
          ...phase2Schedule,
          items: [
            { id: "si-a", productId: "product-a", productionDays: ["quarta"], minimumProduction: 0 },
            { id: "si-b", productId: "product-b", productionDays: ["quarta"], minimumProduction: 0 },
          ],
        },
      ],
    }),
    {
      isReleased: (orderId) => orderId === "order-1",
      isCancelled: () => false,
      resolveProductionItemStatus: () => "nao_iniciado",
    },
  );

  // Controle: MESMO cronograma para A (pedido planeja igual), mas SEM o item de B
  // no cronograma → nenhum slot de esqueleto é gerado. A diferença entre os dois
  // cenários é exatamente "existe esqueleto de B ou não".
  const withoutSkeleton = applyFactoryWorkflowState(
    buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
      stores: [baseStore],
      storeOrders,
      settings,
      sectors: skeletonSectors,
      lines: skeletonLines,
      products,
      schedules: [
        {
          ...phase2Schedule,
          items: [
            { id: "si-a", productId: "product-a", productionDays: ["quarta"], minimumProduction: 0 },
          ],
        },
      ],
    }),
    {
      isReleased: (orderId) => orderId === "order-1",
      isCancelled: () => false,
      resolveProductionItemStatus: () => "nao_iniciado",
    },
  );

  // Sanidade: o cenário "com" realmente gerou um slot de esqueleto de B.
  assert.ok(
    withSkeleton.orderItems.some((item) => item.productId === "product-b" && item.demandSource === "cronograma"),
    "cenário COM esqueleto deve conter o slot de B",
  );
  assert.ok(
    !withoutSkeleton.orderItems.some((item) => item.demandSource === "cronograma"),
    "cenário SEM esqueleto não deve conter slots de cronograma",
  );

  const occupancyByLine = (planning: ReturnType<typeof buildFactoryPlanningData>) => {
    const byLine = new Map<string, number>();
    planning.productionOrders
      .filter((op) => op.hasDemand && op.productionDate === SKELETON_REFERENCE_WEDNESDAY)
      .forEach((op) => byLine.set(op.lineId, (byLine.get(op.lineId) ?? 0) + op.totalKg));
    return byLine;
  };

  assert.deepEqual(
    Array.from(occupancyByLine(withSkeleton).entries()).sort(),
    Array.from(occupancyByLine(withoutSkeleton).entries()).sort(),
    "ocupação por linha idêntica com/sem esqueleto",
  );

  // Contagem de OPs/itens com demanda também idêntica (esqueleto não conta).
  const opsWithDemand = (p: ReturnType<typeof buildFactoryPlanningData>) =>
    p.productionOrders.filter((op) => op.hasDemand).length;
  assert.equal(opsWithDemand(withSkeleton), opsWithDemand(withoutSkeleton));
});

test("Fase 2 (entrega): esqueleto não entra em expedition/expeditionItems de nenhum pedido", () => {
  const products = [buildSkeletonProduct({ id: "product-1", code: "PR-0001", name: "Pao Quarta" })];

  const planning = buildFactoryPlanningData(SKELETON_REFERENCE_WEDNESDAY, {
    stores: [baseStore],
    storeOrders: [],
    settings,
    sectors: skeletonSectors,
    lines: skeletonLines,
    products,
    schedules: [phase2Schedule],
  });

  // Há slot de esqueleto no planejamento...
  assert.ok(planning.orderItems.some((item) => item.demandSource === "cronograma"));
  // ...mas a expedição é derivada de StoreOrders reais — sem pedido, nada a expedir,
  // e nenhum orderId `skeleton:` vaza para a trava de entrega.
  assert.equal(planning.expedition.length, 0, "esqueleto não cria linha de expedição");
  assert.equal(planning.expeditionItems.length, 0, "esqueleto não cria item de separação");
  assert.equal(
    planning.expedition.some((row) => row.orderId.startsWith("skeleton:")),
    false,
  );
});
