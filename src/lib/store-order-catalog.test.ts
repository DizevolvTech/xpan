import assert from "node:assert/strict";
import test from "node:test";

import { defaultProductPreparationStages } from "@/lib/production-planning";
import { buildStoreOrderCatalog } from "@/lib/store-order-catalog";
import type { MasterDataSnapshot } from "@/lib/supabase-data/master-data";

function buildSnapshot(
  scheduleItemDays: Array<"segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo">,
  includeScheduleItem = true,
): Pick<MasterDataSnapshot, "operationalSettings" | "stores" | "sectors" | "lines" | "products" | "schedules"> {
  return {
    operationalSettings: {
      orderCutoffTime: "18:00",
      expeditionLeadDays: 2,
      saleLeadDays: 1,
    },
    stores: [
      {
        id: "store-1",
        code: "LJ-001",
        name: "Loja Centro",
        createdAt: "2026-03-17T08:00:00Z",
        updatedAt: "2026-03-17T08:00:00Z",
        responsible: "Rommel",
        email: "loja@teste.com",
        phone: "85999999999",
        status: "ativo",
        receiveWindow: "07:00 - 10:00",
        orderingDays: ["segunda", "terca", "quarta", "quinta", "sexta"],
        receivingDays: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
        orderingBlockedDays: [],
        receivingBlockedDays: [],
      },
    ],
    sectors: [
      {
        id: "sector-1",
        code: "SE-001",
        name: "Panificação",
        responsible: "Maria",
        status: "ativo",
        createdAt: "2026-03-17T08:00:00Z",
        updatedAt: "2026-03-17T08:00:00Z",
      },
    ],
    lines: [
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
    ],
    products: [
      {
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
        productionDays: ["quinta", "sexta"],
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
      },
    ],
    schedules: [
      {
        id: "schedule-1",
        code: "SL-001",
        name: "Sublinha Ativa",
        lineId: "line-1",
        status: "ativo",
        createdAt: "2026-03-17T08:00:00Z",
        createdBy: "Fernanda",
        items: includeScheduleItem
          ? [
              {
                id: "schedule-item-1",
                productId: "product-1",
                productionDays: scheduleItemDays,
                minimumProduction: 15,
              },
            ]
          : [],
      },
    ],
  };
}

test("store catalog returns only products that match the active subline and valid delivery day", () => {
  const catalog = buildStoreOrderCatalog(buildSnapshot(["quinta"]), {
    storeId: "store-1",
    orderedAt: "2026-03-17T09:00:00Z",
  });

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.productId, "product-1");
  assert.equal(catalog[0]?.scheduleId, "schedule-1");
  assert.equal(catalog[0]?.available, true);
  assert.equal(catalog[0]?.blockedReason, null);
  assert.equal(catalog[0]?.unitKind, "discrete");
  assert.equal(catalog[0]?.minimumProductionKg, 15);
  assert.equal(catalog[0]?.salesToKgFactor, 0.1);
  assert.equal(catalog[0]?.baseDate, "2026-03-17");
  assert.equal(catalog[0]?.productionDate, "2026-03-19");
  assert.equal(catalog[0]?.deliveryDate, "2026-03-19");
  assert.equal(catalog[0]?.saleDate, "2026-03-20");
});

test("store catalog anchors availability/timeline at committed future delivery date (X) when provided", () => {
  const snapshot = buildSnapshot(["quinta"]);

  // SEM âncora: janela natural (pedido terça 17/03 → entrega/produção quinta 19/03).
  const natural = buildStoreOrderCatalog(snapshot, {
    storeId: "store-1",
    orderedAt: "2026-03-17T09:00:00Z",
  });
  assert.equal(natural[0]?.available, true);
  assert.equal(natural[0]?.deliveryDate, "2026-03-19");
  assert.equal(natural[0]?.productionDate, "2026-03-19");

  // COM âncora X = quinta 02/04 (entrega comprometida futura). Produto produz quinta,
  // lead 0 ⇒ produz no próprio dia da entrega = X.
  const anchored = buildStoreOrderCatalog(snapshot, {
    storeId: "store-1",
    orderedAt: "2026-03-17T09:00:00Z",
    targetDeliveryDate: "2026-04-02",
  });
  assert.equal(anchored[0]?.available, true);
  assert.equal(anchored[0]?.deliveryDate, "2026-04-02");
  assert.equal(anchored[0]?.productionDate, "2026-04-02");
  // saleLeadDays = 1 ⇒ venda em X + 1 = 03/04.
  assert.equal(anchored[0]?.saleDate, "2026-04-03");

  // Prova do efeito: ancorar mudou o plano vs. a janela natural.
  assert.notEqual(anchored[0]?.deliveryDate, natural[0]?.deliveryDate);
});

test("store catalog with null/absent targetDeliveryDate is identical to legacy window behavior", () => {
  const legacy = buildStoreOrderCatalog(buildSnapshot(["quinta"]), {
    storeId: "store-1",
    orderedAt: "2026-03-17T09:00:00Z",
  });
  const explicitNull = buildStoreOrderCatalog(buildSnapshot(["quinta"]), {
    storeId: "store-1",
    orderedAt: "2026-03-17T09:00:00Z",
    targetDeliveryDate: null,
  });

  assert.deepEqual(explicitNull, legacy);
});

test("store catalog keeps products available when a pending schedule revision exists alongside the active one", () => {
  const snapshot = buildSnapshot(["quinta"]);

  snapshot.schedules.push({
    id: "schedule-2",
    code: "SL-002",
    name: "Sublinha em auditoria",
    lineId: "line-1",
    status: "pendente",
    createdAt: "2026-03-18T08:00:00Z",
    createdBy: "Fernanda",
    items: [
      {
        id: "schedule-item-2",
        productId: "product-1",
        productionDays: ["quinta"],
        minimumProduction: 15,
      },
    ],
  });

  const catalog = buildStoreOrderCatalog(snapshot, {
    storeId: "store-1",
    orderedAt: "2026-03-17T09:00:00Z",
  });

  assert.equal(catalog.length, 1);
  // Products remain available using the active schedule even when a pending revision exists
  assert.equal(catalog[0]?.available, true);
  assert.equal(catalog[0]?.scheduleId, "schedule-1");
});

test("store catalog keeps products outside the active schedule snapshot with a blocked reason", () => {
  const catalog = buildStoreOrderCatalog(buildSnapshot(["quinta"], false), {
    storeId: "store-1",
    orderedAt: "2026-03-17T09:00:00Z",
  });

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.available, false);
  assert.equal(catalog[0]?.blockedReason, "Produto fora da linha de produção ativa.");
});

test("store catalog keeps blocked products when subline day and product day do not intersect", () => {
  const catalog = buildStoreOrderCatalog(buildSnapshot(["segunda"]), {
    storeId: "store-1",
    orderedAt: "2026-03-17T09:00:00Z",
  });

  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.available, false);
  assert.equal(
    catalog[0]?.blockedReason,
    "Dias da ficha do produto não coincidem com a linha de produção ativa.",
  );
});

// XPAN-9: MPI (canBeIngredient) nunca é pedível direto — só via demanda do produto
// que o consome. Mesmo se vier mal-cadastrado com availableForOrdering=true.
test("XPAN-9: store catalog excludes MPI products (canBeIngredient) from the orderable list", () => {
  const snapshot = buildSnapshot(["quinta"]);

  // Clona o produto base e marca como MPI (canBeIngredient = true).
  const baseProduct = snapshot.products[0]!;
  const mpiProduct = {
    ...baseProduct,
    id: "product-mpi",
    code: "MPI-0001",
    name: "Massa de Pizza (MPI)",
    canBeIngredient: true,
    availableForOrdering: true,
  };
  snapshot.products.push(mpiProduct);
  // O cronograma ativo também prevê o MPI (caso contrário ele seria bloqueado,
  // não pedível — queremos provar que o filtro por canBeIngredient é o que age).
  snapshot.schedules[0]!.items.push({
    id: "schedule-item-mpi",
    productId: "product-mpi",
    productionDays: ["quinta"],
    minimumProduction: 10,
  });

  const catalog = buildStoreOrderCatalog(snapshot, {
    storeId: "store-1",
    orderedAt: "2026-03-17T09:00:00Z",
  });

  assert.equal(catalog.length, 1, "MPI não deve aparecer no catálogo pedível");
  assert.equal(catalog[0]?.productId, "product-1");
  assert.ok(
    catalog.every((entry) => entry.productId !== "product-mpi"),
    "nenhum item do catálogo aponta para o MPI",
  );
});
