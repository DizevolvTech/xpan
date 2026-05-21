import assert from "node:assert/strict";
import test from "node:test";

import type { StoreProfile } from "@/lib/factory-planning/types";

import { buildDeliveryRoutes } from "./delivery-routing";

function makeStore(overrides: Partial<StoreProfile>): StoreProfile {
  return {
    id: "store-1",
    code: "LJ-001",
    name: "Loja",
    orderingDays: [],
    receivingDays: [],
    orderingBlockedDays: [],
    receivingBlockedDays: [],
    receiveWindow: "08:00 - 11:00",
    ...overrides,
  };
}

test("buildDeliveryRoutes — agrupa por deliveryZone quando preenchida", () => {
  const stores: StoreProfile[] = [
    makeStore({ id: "s1", code: "L1", deliveryZone: "Centro" }),
    makeStore({ id: "s2", code: "L2", deliveryZone: "Centro" }),
    makeStore({ id: "s3", code: "L3", deliveryZone: "Norte" }),
  ];
  const deliveries = [
    { orderId: "o1", storeId: "s1", deliveryDate: "2026-05-21" },
    { orderId: "o2", storeId: "s2", deliveryDate: "2026-05-21" },
    { orderId: "o3", storeId: "s3", deliveryDate: "2026-05-21" },
  ];

  const result = buildDeliveryRoutes(deliveries, stores);

  const o1 = result.find((r) => r.orderId === "o1");
  const o2 = result.find((r) => r.orderId === "o2");
  const o3 = result.find((r) => r.orderId === "o3");

  assert.equal(o1?.zone, "Zona Centro");
  assert.equal(o2?.zone, "Zona Centro");
  assert.equal(o3?.zone, "Zona Norte");
  assert.equal(o1?.routeCode, o2?.routeCode, "mesma zona compartilha route code");
  assert.notEqual(o1?.routeCode, o3?.routeCode, "zonas distintas em rotas distintas");
});

test("buildDeliveryRoutes — sem deliveryZone agrupa por receiveWindow", () => {
  const stores: StoreProfile[] = [
    makeStore({ id: "s1", code: "L1", receiveWindow: "07:00 - 10:00" }),
    makeStore({ id: "s2", code: "L2", receiveWindow: "07:00 - 10:00" }),
    makeStore({ id: "s3", code: "L3", receiveWindow: "10:00 - 13:00" }),
  ];
  const deliveries = [
    { orderId: "o1", storeId: "s1", deliveryDate: "2026-05-21" },
    { orderId: "o2", storeId: "s2", deliveryDate: "2026-05-21" },
    { orderId: "o3", storeId: "s3", deliveryDate: "2026-05-21" },
  ];

  const result = buildDeliveryRoutes(deliveries, stores);

  const o1 = result.find((r) => r.orderId === "o1");
  const o3 = result.find((r) => r.orderId === "o3");

  assert.equal(o1?.zone, "Janela 07:00 - 10:00");
  assert.equal(o3?.zone, "Janela 10:00 - 13:00");
  assert.notEqual(o1?.routeCode, o3?.routeCode, "janelas distintas → rotas distintas");
});

test("buildDeliveryRoutes — paradas ordenadas por janela mais cedo, depois code", () => {
  const stores: StoreProfile[] = [
    makeStore({ id: "s1", code: "LZ-99", deliveryZone: "Centro", receiveWindow: "09:00 - 11:00" }),
    makeStore({ id: "s2", code: "LA-01", deliveryZone: "Centro", receiveWindow: "07:00 - 10:00" }),
    makeStore({ id: "s3", code: "LB-02", deliveryZone: "Centro", receiveWindow: "07:00 - 10:00" }),
  ];
  const deliveries = [
    { orderId: "o1", storeId: "s1", deliveryDate: "2026-05-21" },
    { orderId: "o2", storeId: "s2", deliveryDate: "2026-05-21" },
    { orderId: "o3", storeId: "s3", deliveryDate: "2026-05-21" },
  ];

  const result = buildDeliveryRoutes(deliveries, stores);

  // o2 (LA-01, 07:00) → parada 1; o3 (LB-02, 07:00) → parada 2; o1 (LZ-99, 09:00) → parada 3
  assert.equal(result.find((r) => r.orderId === "o2")?.stopNumber, 1);
  assert.equal(result.find((r) => r.orderId === "o3")?.stopNumber, 2);
  assert.equal(result.find((r) => r.orderId === "o1")?.stopNumber, 3);
});

test("buildDeliveryRoutes — entregas em datas distintas geram rotas distintas mesmo na mesma zona", () => {
  const stores: StoreProfile[] = [makeStore({ id: "s1", code: "L1", deliveryZone: "Centro" })];
  const deliveries = [
    { orderId: "o1", storeId: "s1", deliveryDate: "2026-05-21" },
    { orderId: "o2", storeId: "s1", deliveryDate: "2026-05-22" },
  ];

  const result = buildDeliveryRoutes(deliveries, stores);

  const o1 = result.find((r) => r.orderId === "o1");
  const o2 = result.find((r) => r.orderId === "o2");

  assert.notEqual(o1?.routeCode, o2?.routeCode, "datas distintas → rotas distintas");
  assert.match(o1?.routeCode ?? "", /^R-260521-/);
  assert.match(o2?.routeCode ?? "", /^R-260522-/);
});

test("buildDeliveryRoutes — pedido com storeId inexistente cai em 'Sem agrupamento'", () => {
  const deliveries = [{ orderId: "o-orphan", storeId: "missing", deliveryDate: "2026-05-21" }];

  const result = buildDeliveryRoutes(deliveries, []);

  assert.equal(result.length, 1);
  assert.equal(result[0].zone, "Sem agrupamento");
  assert.equal(result[0].stopNumber, 1);
});
