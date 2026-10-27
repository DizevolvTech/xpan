import assert from "node:assert/strict";
import test from "node:test";

import {
  computeFactoryAlerts,
  OTIF_DANGER_THRESHOLD,
  type FactoryAlertsInput,
} from "@/lib/supabase-data/factory-alerts";

function baseInput(overrides: Partial<FactoryAlertsInput> = {}): FactoryAlertsInput {
  return {
    otif: { deliveredOnTime: 10, deliveredLate: 0, otifPercent: 100 },
    deliveryFailuresTotal: 0,
    storesWithoutOrder: 0,
    ...overrides,
  };
}

test("computeFactoryAlerts — sem divergências retorna lista vazia", () => {
  assert.deepEqual(computeFactoryAlerts(baseInput()), []);
});

test("Quadro #1 (27/10): alertas de produção (produzido x planejado, atraso por etapa) não existem mais", () => {
  const ids = computeFactoryAlerts(baseInput()).map((alert) => alert.id);
  assert.ok(!ids.some((id) => id.startsWith("produced-") || id.startsWith("stage-delay")));
});

test("computeFactoryAlerts — OTIF abaixo do limiar crítico é danger", () => {
  const alerts = computeFactoryAlerts(
    baseInput({
      otif: { deliveredOnTime: 5, deliveredLate: 5, otifPercent: OTIF_DANGER_THRESHOLD - 10 },
    }),
  );
  assert.equal(alerts.find((a) => a.id === "otif-below-threshold")?.severity, "danger");
});

test("computeFactoryAlerts — falhas de entrega disparam alerta", () => {
  const alerts = computeFactoryAlerts(baseInput({ deliveryFailuresTotal: 3 }));
  assert.equal(alerts.find((a) => a.id === "delivery-failures")?.metric, "3");
});

test("computeFactoryAlerts — lojas sem pedido disparam alerta", () => {
  const alerts = computeFactoryAlerts(baseInput({ storesWithoutOrder: 4 }));
  assert.equal(alerts.find((a) => a.id === "stores-without-order")?.metric, "4");
});
