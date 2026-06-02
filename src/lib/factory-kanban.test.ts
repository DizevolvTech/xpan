import assert from "node:assert/strict";
import test from "node:test";

import {
  getProductionOrderNavKey,
  isOpInProductionColumn,
  isOrderAwaitingAcceptance,
} from "@/lib/factory-kanban";

// Coluna "Aberto" = pedidos aguardando ACEITE (liberação) — independe da data.
test("isOrderAwaitingAcceptance — pedido não liberado fica em Aberto (mesmo agendado p/ futuro)", () => {
  assert.equal(isOrderAwaitingAcceptance({ releasedToProduction: false, status: "agendado" }), true);
  assert.equal(isOrderAwaitingAcceptance({ releasedToProduction: false, status: "em_espera" }), true);
});

test("isOrderAwaitingAcceptance — pedido LIBERADO sai da coluna Aberto (vai pra produção)", () => {
  // bug: antes ficava em Aberto porque o status (agendado) é derivado por data.
  assert.equal(isOrderAwaitingAcceptance({ releasedToProduction: true, status: "agendado" }), false);
  assert.equal(isOrderAwaitingAcceptance({ releasedToProduction: true, status: "em_producao" }), false);
});

test("isOrderAwaitingAcceptance — cancelado/expedição/rota não ficam em Aberto", () => {
  assert.equal(isOrderAwaitingAcceptance({ releasedToProduction: false, status: "cancelado" }), false);
  assert.equal(isOrderAwaitingAcceptance({ releasedToProduction: false, status: "aguardando_expedicao" }), false);
  assert.equal(isOrderAwaitingAcceptance({ releasedToProduction: false, status: "rota_entrega" }), false);
});

// Coluna "Em produção" = OPs LIBERADAS e ainda não prontas — independe da data.
test("isOpInProductionColumn — OP liberada aparece em produção (mesmo agendada p/ futuro)", () => {
  // bug: antes só aparecia com status em_producao (produção hoje).
  assert.equal(isOpInProductionColumn({ releasedToProduction: true, status: "agendado" }), true);
  assert.equal(isOpInProductionColumn({ releasedToProduction: true, status: "em_producao" }), true);
});

test("isOpInProductionColumn — OP não liberada NÃO aparece em produção", () => {
  assert.equal(isOpInProductionColumn({ releasedToProduction: false, status: "agendado" }), false);
});

test("isOpInProductionColumn — OP concluída (aguardando expedição) sai de produção", () => {
  assert.equal(isOpInProductionColumn({ releasedToProduction: true, status: "aguardando_expedicao" }), false);
});

test("isOpInProductionColumn — OP em rota ou JÁ ENTREGUE sai de produção", () => {
  assert.equal(isOpInProductionColumn({ releasedToProduction: true, status: "rota_entrega" }), false);
  assert.equal(isOpInProductionColumn({ releasedToProduction: true, status: "entregue" }), false);
  assert.equal(isOpInProductionColumn({ releasedToProduction: true, status: "cancelado" }), false);
});

// Chave de navegação estável da OP — não depende de posição/index.
test("getProductionOrderNavKey — deriva da identidade do agrupamento", () => {
  assert.equal(
    getProductionOrderNavKey({
      productionDate: "2026-06-02",
      sectorId: "setor-1",
      lineId: "line-paes",
      scheduleId: "schedule-x",
    }),
    "2026-06-02|setor-1|line-paes|schedule-x",
  );
});

test("getProductionOrderNavKey — duas OPs distintas geram chaves distintas; iguais geram iguais", () => {
  const a = { productionDate: "2026-06-02", sectorId: "s1", lineId: "l1", scheduleId: "sc1" };
  const b = { productionDate: "2026-06-02", sectorId: "s1", lineId: "l1", scheduleId: "sc2" };
  assert.notEqual(getProductionOrderNavKey(a), getProductionOrderNavKey(b));
  assert.equal(getProductionOrderNavKey(a), getProductionOrderNavKey({ ...a }));
});

test("getProductionOrderNavKey — tolera campos nulos sem quebrar", () => {
  assert.equal(
    getProductionOrderNavKey({ productionDate: null, sectorId: "s1", lineId: "l1", scheduleId: null }),
    "sem-data|s1|l1|sem-schedule",
  );
});
