import assert from "node:assert/strict";
import test from "node:test";

import { findActiveWindowOrder } from "@/lib/store-order-window";

type Row = { id: string; storeId: string; deliveryDateKey: string; status: string };

const base: Row[] = [
  { id: "ontem", storeId: "loja-a", deliveryDateKey: "2026-05-29", status: "em_producao" },
  { id: "hoje", storeId: "loja-a", deliveryDateKey: "2026-05-30", status: "em_espera" },
  { id: "outra-loja", storeId: "loja-b", deliveryDateKey: "2026-05-30", status: "em_espera" },
];

test("findActiveWindowOrder — retorna o pedido em andamento da janela ATUAL", () => {
  const found = findActiveWindowOrder(base, { storeId: "loja-a", deliveryDateKey: "2026-05-30" });
  assert.equal(found?.id, "hoje");
});

test("findActiveWindowOrder — NÃO bloqueia por pedido de janela anterior (bug do dia anterior)", () => {
  // A loja tem um pedido de ontem (em_producao) mas a janela de hoje está livre →
  // deve retornar null (pode fazer um novo pedido para a janela de hoje).
  const semHoje = base.filter((row) => row.id !== "hoje");
  const found = findActiveWindowOrder(semHoje, { storeId: "loja-a", deliveryDateKey: "2026-05-30" });
  assert.equal(found, null);
});

test("findActiveWindowOrder — ignora outras lojas", () => {
  const found = findActiveWindowOrder(base, { storeId: "loja-a", deliveryDateKey: "2026-05-31" });
  assert.equal(found, null);
});

test("findActiveWindowOrder — ignora status finalizados (cancelado/entregue/tentativa_falha)", () => {
  const rows: Row[] = [
    { id: "cancelado", storeId: "loja-a", deliveryDateKey: "2026-05-30", status: "cancelado" },
    { id: "entregue", storeId: "loja-a", deliveryDateKey: "2026-05-30", status: "entregue" },
    { id: "falha", storeId: "loja-a", deliveryDateKey: "2026-05-30", status: "tentativa_falha" },
  ];
  const found = findActiveWindowOrder(rows, { storeId: "loja-a", deliveryDateKey: "2026-05-30" });
  assert.equal(found, null);
});

test("findActiveWindowOrder — sem loja selecionada retorna null", () => {
  const found = findActiveWindowOrder(base, { storeId: null, deliveryDateKey: "2026-05-30" });
  assert.equal(found, null);
});
