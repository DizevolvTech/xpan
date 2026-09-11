import assert from "node:assert/strict";
import test from "node:test";

import { countOpenOrders, isOpenOrderStatus } from "@/lib/factory-planning/order-status";
import type { OrderStatus } from "@/lib/factory-planning/types";

test("isOpenOrderStatus ignora cancelado e entregue", () => {
  assert.equal(isOpenOrderStatus("em_producao"), true);
  assert.equal(isOpenOrderStatus("agendado"), true);
  assert.equal(isOpenOrderStatus("aguardando_expedicao"), true);
  assert.equal(isOpenOrderStatus("cancelado"), false);
  assert.equal(isOpenOrderStatus("entregue"), false);
});

test("countOpenOrders soma só pedidos ativos", () => {
  const orders: { status: OrderStatus }[] = [
    { status: "agendado" },
    { status: "em_producao" },
    { status: "cancelado" },
    { status: "entregue" },
  ];
  assert.equal(countOpenOrders(orders), 2);
});
