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
        isMpiIngredient: false,
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

test("store catalog blocks products from lines that are awaiting audit approval", () => {
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
  assert.equal(catalog[0]?.available, false);
  assert.equal(catalog[0]?.scheduleId, "schedule-2");
  assert.equal(catalog[0]?.scheduleName, "Sublinha em auditoria");
  assert.equal(catalog[0]?.blockedReason, "Linha aguardando auditoria do cronograma.");
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
