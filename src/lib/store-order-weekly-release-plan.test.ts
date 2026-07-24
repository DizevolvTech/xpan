import assert from "node:assert/strict";
import test from "node:test";

import type {
  OperationalSettings,
  ProductionLine,
  ProductionProduct,
  ProductionSector,
  ProductionWeekDay,
  WeeklyProductionSchedule,
} from "@/lib/production-planning";
import { defaultProductPreparationStages } from "@/lib/production-planning";
import type { StoreProfile } from "@/lib/order-planning";
import { resolveScheduledProductAvailability } from "@/lib/order-planning";
import {
  activeStoreDateKey,
  planWeeklyStoreOrderReleases,
  type WeeklyStoreOrderReleasePlanInput,
} from "@/lib/store-order-weekly-release-plan";

// referenceDate 2026-06-01 é segunda. Horizonte de 7 dias varre 06-01..06-07.
const REFERENCE_DATE = "2026-06-01";

const SETTINGS: OperationalSettings = {
  orderCutoffTime: "18:00",
  expeditionLeadDays: 1,
  saleLeadDays: 1,
};

const SECTORS: ProductionSector[] = [
  {
    id: "sector-1",
    code: "SE-001",
    name: "Panificação",
    responsible: "Maria",
    status: "ativo",
    createdAt: "2026-03-17T08:00:00Z",
    updatedAt: "2026-03-17T08:00:00Z",
  },
];

const LINES: ProductionLine[] = [
  {
    id: "line-1",
    code: "LP-001",
    name: "Linha Pães",
    sectorId: "sector-1",
    type: "Seco",
    operatingHours: "05:00 - 14:00",
    capacityPerDayKg: 1000,
    status: "ativo",
    createdAt: "2026-03-17T08:00:00Z",
    updatedAt: "2026-03-17T08:00:00Z",
  },
];

function buildProduct(
  productionDays: ProductionWeekDay[],
  expeditionLeadDays = 0,
): ProductionProduct {
  return {
    ...buildProductBase(productionDays),
    expeditionLeadDays,
  };
}

function buildProductBase(productionDays: ProductionWeekDay[]): ProductionProduct {
  return {
    id: "product-1",
    code: "PR-0001",
    name: "Pão Francês",
    description: "",
    lineId: "line-1",
    masterLineId: "line-1",
    operationalLineId: "line-1",
    active: true,
    availableForOrdering: true,
    validityDays: 1,
    minimumProductionKg: 15,
    economicProductionKg: 20,
    allowsStorage: false,
    productionDays,
    unitProfiles: {
      sales: { unit: "Un", description: "Unidade", weightKg: 0.1 },
      production: { unit: "Kg", description: "Quilo", weightKg: 1 },
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
    createdAt: "2026-03-17T08:00:00Z",
    updatedAt: "2026-03-17T08:00:00Z",
  };
}

function buildSchedule(
  productionDays: ProductionWeekDay[],
  status: WeeklyProductionSchedule["status"] = "ativo",
): WeeklyProductionSchedule {
  return {
    id: "schedule-1",
    code: "SL-001",
    name: "Cronograma Ativo",
    lineId: "line-1",
    status,
    createdAt: "2026-03-17T08:00:00Z",
    createdBy: "Fernanda",
    items: [
      {
        id: "schedule-item-1",
        productId: "product-1",
        productionDays,
        minimumProduction: 15,
      },
    ],
  };
}

function buildStore(overrides: Partial<StoreProfile> = {}): StoreProfile {
  return {
    id: "store-1",
    code: "LJ-001",
    name: "Loja Centro",
    orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
    receiveWindow: "07:00 - 10:00",
    deliveryZone: null,
    ...overrides,
  };
}

function buildInput(
  overrides: Partial<WeeklyStoreOrderReleasePlanInput> = {},
): WeeklyStoreOrderReleasePlanInput {
  return {
    referenceDate: REFERENCE_DATE,
    stores: [buildStore()],
    schedules: [buildSchedule(["segunda", "quarta", "sexta"])],
    // Gap DO PRODUTO = 1 dia: é ele (não o D+X global) que define a data de entrega do slot.
    products: [buildProduct(["segunda", "quarta", "sexta"], 1)],
    sectors: SECTORS,
    lines: LINES,
    settings: SETTINGS,
    existingActiveByStoreDate: new Set<string>(),
    ...overrides,
  };
}

test("(a) cronograma seg/qua/sex + loja recebe seg..sáb + gap do produto 1d → uma entrega por dia", () => {
  // Produção seg(06-01)/qua(06-03)/sex(06-05); gap 1d → entrega ter(06-02)/qui(06-04)/sáb(06-06).
  const plan = planWeeklyStoreOrderReleases(buildInput());

  assert.deepEqual(
    plan.toOpen.map((release) => release.deliveryDate),
    ["2026-06-02", "2026-06-04", "2026-06-06"],
  );
  assert.deepEqual(
    plan.toOpen.map((release) => release.deliveryWeekday),
    ["terca", "quinta", "sabado"],
  );
  // Cada liberação carrega o cronograma que a justificou.
  for (const release of plan.toOpen) {
    assert.deepEqual(release.sourceScheduleIds, ["schedule-1"]);
  }
  assert.deepEqual(plan.skipped, []);
});

test("(b) loja sem dias de recebimento válidos → toOpen vazio + skipped sem-recebimento", () => {
  const plan = planWeeklyStoreOrderReleases(
    buildInput({ stores: [buildStore({ receivingDays: [] })] }),
  );

  assert.deepEqual(plan.toOpen, []);
  assert.deepEqual(plan.skipped, [{ storeId: "store-1", reason: "sem-recebimento" }]);
});

test("(c) data já ativa em existingActiveByStoreDate não entra em toOpen (idempotência)", () => {
  const plan = planWeeklyStoreOrderReleases(
    buildInput({
      existingActiveByStoreDate: new Set([activeStoreDateKey("store-1", "2026-06-04")]),
    }),
  );

  assert.deepEqual(
    plan.toOpen.map((release) => release.deliveryDate),
    ["2026-06-02", "2026-06-06"],
  );
  assert.deepEqual(plan.skipped, [
    { storeId: "store-1", deliveryDate: "2026-06-04", reason: "ja-ativo" },
  ]);
});

test("(d) sem cronograma ativo → toOpen vazio + skipped sem-cobertura", () => {
  const plan = planWeeklyStoreOrderReleases(
    buildInput({ schedules: [buildSchedule(["segunda", "quarta", "sexta"], "pendente")] }),
  );

  assert.deepEqual(plan.toOpen, []);
  assert.deepEqual(plan.skipped, [{ storeId: "store-1", reason: "sem-cobertura" }]);
});

test("(e) blockedDays de recebimento reagendam a entrega para o próximo dia liberado", () => {
  // Bloqueia quinta. Sem bloqueio (caso a) a produção de qua(06-03) entregaria em qui(06-04);
  // com qui bloqueada o ajuste aos dias de recebimento (moveToNextAllowedWeekday) empurra a
  // entrega para sex(06-05). O dia 06-04 NÃO é aberto. Resultado: ter/sex/sáb.
  const plan = planWeeklyStoreOrderReleases(
    buildInput({ stores: [buildStore({ receivingBlockedDays: ["quinta"] })] }),
  );

  assert.deepEqual(
    plan.toOpen.map((release) => release.deliveryDate),
    ["2026-06-02", "2026-06-05", "2026-06-06"],
  );
  assert.ok(
    !plan.toOpen.some((release) => release.deliveryDate === "2026-06-04"),
    "nenhuma entrega cai na quinta bloqueada",
  );
  assert.deepEqual(plan.skipped, []);
});

test("(e2) bloquear o dia de entrega pode colapsar duas produções na mesma data (uma só liberação)", () => {
  // Bloqueia terça: prod seg(06-01) entregaria em ter(06-02) → empurra p/ qua(06-03).
  // Como qua não é dia de produção, nada mais cai em qua → segue distinto.
  const plan = planWeeklyStoreOrderReleases(
    buildInput({ stores: [buildStore({ receivingBlockedDays: ["terca"] })] }),
  );

  // ter bloqueada → seg→qua(06-03); qua→qui(06-04); sex→sáb(06-06).
  assert.deepEqual(
    plan.toOpen.map((release) => release.deliveryDate),
    ["2026-06-03", "2026-06-04", "2026-06-06"],
  );
  assert.ok(!plan.toOpen.some((release) => release.deliveryWeekday === "terca"));
});

/* -------------------------------------------------------------------------------------------------
 * CRUZAMENTO slot do lote × catálogo ancorado (call do cliente 24/07 — "aparece no dia errado").
 *
 * O lote abre um pedido para uma data de ENTREGA. Quando a loja preenche esse pedido, o catálogo
 * roda ANCORADO nessa data (`targetDeliveryDate`) e só aceita o produto se
 * `produção + gap DO PRODUTO === entrega`. Logo, todo slot que o lote abre PRECISA ser alcançável
 * pelo gap do produto que o justificou — senão a fábrica abre um pedido onde o produto some.
 * -----------------------------------------------------------------------------------------------*/

/** Espelha o que o catálogo faz ao preencher um pedido comprometido para `deliveryDate`. */
function isProductAvailableForSlot(
  product: ProductionProduct,
  store: StoreProfile,
  settings: OperationalSettings,
  scheduleProductionDays: ProductionWeekDay[],
  deliveryDate: string,
) {
  return resolveScheduledProductAvailability(
    `${REFERENCE_DATE}T09:00:00`,
    store,
    settings,
    {
      productProductionDays: product.productionDays,
      productExpeditionLeadDays: product.expeditionLeadDays,
      scheduleItem: { id: "schedule-item-1", productionDays: scheduleProductionDays },
      targetDeliveryDate: deliveryDate,
    },
  );
}

test("(f) slot aberto pelo lote é alcançável pelo catálogo quando gap do produto = lead global", () => {
  const productionDays: ProductionWeekDay[] = ["segunda", "quarta", "sexta"];
  const settings: OperationalSettings = { ...SETTINGS, expeditionLeadDays: 1 };
  const product = buildProduct(productionDays, 1);
  const store = buildStore();

  const plan = planWeeklyStoreOrderReleases(
    buildInput({ products: [product], settings, stores: [store] }),
  );

  assert.ok(plan.toOpen.length > 0, "o lote precisa abrir ao menos um pedido");
  for (const release of plan.toOpen) {
    const availability = isProductAvailableForSlot(
      product,
      store,
      settings,
      productionDays,
      release.deliveryDate,
    );
    assert.equal(
      availability.available,
      true,
      `slot ${release.deliveryDate} deveria aceitar o produto: ${availability.blockedReason}`,
    );
  }
});

test("(g) REGRESSÃO 24/07: gap do produto ≠ lead global — o slot ainda tem que aceitar o produto", () => {
  // Cenário do cliente: lead GLOBAL 2, produto com gap 1 produzindo só na terça.
  // Antes do fix o lote derivava o slot de `produção + lead global` (terça 06-02 + 2 = quinta
  // 06-04), mas o catálogo ancorado exige `produção + gap do produto` (terça + 1 = quarta 06-03).
  // Resultado: a fábrica abria o pedido de quinta e o produto de terça sumia do catálogo.
  const productionDays: ProductionWeekDay[] = ["terca"];
  const settings: OperationalSettings = { ...SETTINGS, expeditionLeadDays: 2 };
  const product = buildProduct(productionDays, 1);
  const store = buildStore();

  const plan = planWeeklyStoreOrderReleases(
    buildInput({
      products: [product],
      schedules: [buildSchedule(productionDays)],
      settings,
      stores: [store],
    }),
  );

  // Produção terça 06-02 + gap 1 = quarta 06-03 (não quinta 06-04, que vinha do lead global).
  assert.deepEqual(
    plan.toOpen.map((release) => release.deliveryDate),
    ["2026-06-03"],
  );

  const availability = isProductAvailableForSlot(
    product,
    store,
    settings,
    productionDays,
    plan.toOpen[0]!.deliveryDate,
  );
  assert.equal(availability.available, true, availability.blockedReason ?? "");
  assert.equal(availability.productionDate, "2026-06-02");
});

test("(h) produtos com gaps diferentes na mesma linha abrem slots distintos, todos alcançáveis", () => {
  // Um produto entrega no dia seguinte (gap 1) e outro no mesmo dia (gap 0). Ambos produzem
  // na quarta: o lote precisa abrir DOIS slots (qua 06-03 e qui 06-04), um para cada gap.
  const productionDays: ProductionWeekDay[] = ["quarta"];
  const settings: OperationalSettings = { ...SETTINGS, expeditionLeadDays: 3 };
  const store = buildStore();
  const mesmoDia = { ...buildProduct(productionDays, 0), id: "product-1", code: "PR-0001" };
  const diaSeguinte = { ...buildProduct(productionDays, 1), id: "product-2", code: "PR-0002" };

  const schedule: WeeklyProductionSchedule = {
    ...buildSchedule(productionDays),
    items: [
      { id: "schedule-item-1", productId: "product-1", productionDays, minimumProduction: 15 },
      { id: "schedule-item-2", productId: "product-2", productionDays, minimumProduction: 15 },
    ],
  };

  const plan = planWeeklyStoreOrderReleases(
    buildInput({
      products: [mesmoDia, diaSeguinte],
      schedules: [schedule],
      settings,
      stores: [store],
    }),
  );

  assert.deepEqual(
    plan.toOpen.map((release) => release.deliveryDate),
    ["2026-06-03", "2026-06-04"],
  );
  assert.equal(
    isProductAvailableForSlot(mesmoDia, store, settings, productionDays, "2026-06-03").available,
    true,
  );
  assert.equal(
    isProductAvailableForSlot(diaSeguinte, store, settings, productionDays, "2026-06-04").available,
    true,
  );
});

test("idempotência total: todas as datas já ativas → toOpen vazio", () => {
  const plan = planWeeklyStoreOrderReleases(
    buildInput({
      existingActiveByStoreDate: new Set([
        activeStoreDateKey("store-1", "2026-06-02"),
        activeStoreDateKey("store-1", "2026-06-04"),
        activeStoreDateKey("store-1", "2026-06-06"),
      ]),
    }),
  );

  assert.deepEqual(plan.toOpen, []);
  assert.equal(plan.skipped.length, 3);
  assert.ok(plan.skipped.every((entry) => entry.reason === "ja-ativo"));
});
