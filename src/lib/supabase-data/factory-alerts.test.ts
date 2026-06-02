import assert from "node:assert/strict";
import test from "node:test";

import {
  computeFactoryAlerts,
  OTIF_DANGER_THRESHOLD,
  PRODUCED_VS_PLANNED_OVER_THRESHOLD,
  type FactoryAlertsInput,
} from "@/lib/supabase-data/factory-alerts";

function baseInput(overrides: Partial<FactoryAlertsInput> = {}): FactoryAlertsInput {
  return {
    scheduledKg: 100,
    producedKg: 100,
    leadTimePerStage: [],
    averageTotalMinutes: 0,
    otif: { deliveredOnTime: 10, deliveredLate: 0, otifPercent: 100 },
    deliveryFailuresTotal: 0,
    storesWithoutOrder: 0,
    stageLabels: { em_forno: "No forno" },
    ...overrides,
  };
}

test("computeFactoryAlerts — sem divergências retorna lista vazia", () => {
  assert.deepEqual(computeFactoryAlerts(baseInput()), []);
});

test("computeFactoryAlerts — produção abaixo do limiar dispara alerta", () => {
  const alerts = computeFactoryAlerts(baseInput({ producedKg: 50 }));
  const alert = alerts.find((a) => a.id === "produced-below-planned");
  assert.ok(alert);
  assert.equal(alert?.metric, "50%");
});

test("computeFactoryAlerts — produção muito abaixo (<40%) é danger", () => {
  const alerts = computeFactoryAlerts(baseInput({ producedKg: 30 }));
  assert.equal(alerts.find((a) => a.id === "produced-below-planned")?.severity, "danger");
});

test("computeFactoryAlerts — produção acima do limiar superior dispara alerta", () => {
  const producedKg = 100 * PRODUCED_VS_PLANNED_OVER_THRESHOLD + 10;
  const alerts = computeFactoryAlerts(baseInput({ producedKg }));
  assert.ok(alerts.some((a) => a.id === "produced-above-planned"));
});

test("computeFactoryAlerts — sem plano (scheduledKg=0) não compara produção", () => {
  const alerts = computeFactoryAlerts(baseInput({ scheduledKg: 0, producedKg: 0 }));
  assert.ok(!alerts.some((a) => a.id.startsWith("produced-")));
});

test("computeFactoryAlerts — etapa acima da média geral + margem dispara atraso", () => {
  const alerts = computeFactoryAlerts(
    baseInput({
      averageTotalMinutes: 60,
      leadTimePerStage: [
        { stage: "em_forno", averageMinutes: 200, samples: 5 },
        { stage: "embalando", averageMinutes: 30, samples: 5 },
      ],
    }),
  );
  const delay = alerts.find((a) => a.id === "stage-delay-em_forno");
  assert.ok(delay);
  assert.ok(delay?.title.includes("No forno"));
  assert.ok(!alerts.some((a) => a.id === "stage-delay-embalando"));
});

test("computeFactoryAlerts — etapa gargalo acima da média ENTRE etapas (não do total) dispara", () => {
  // Regressão: a etapa (100) excede a média entre etapas (mean[100,20]=60,
  // limite 90) mas NÃO excederia a soma ponta-a-ponta (120). A lógica antiga,
  // que comparava contra averageTotalMinutes, jamais dispararia aqui.
  const alerts = computeFactoryAlerts(
    baseInput({
      averageTotalMinutes: 120,
      leadTimePerStage: [
        { stage: "em_forno", averageMinutes: 100, samples: 4 },
        { stage: "embalando", averageMinutes: 20, samples: 4 },
      ],
    }),
  );
  assert.ok(alerts.some((a) => a.id === "stage-delay-em_forno"));
  assert.ok(!alerts.some((a) => a.id === "stage-delay-embalando"));
});

test("computeFactoryAlerts — etapa única não dispara atraso (sem base de comparação)", () => {
  const alerts = computeFactoryAlerts(
    baseInput({
      leadTimePerStage: [{ stage: "em_forno", averageMinutes: 999, samples: 9 }],
    }),
  );
  assert.ok(!alerts.some((a) => a.id.startsWith("stage-delay")));
});

test("computeFactoryAlerts — etapa com amostra insuficiente é ignorada", () => {
  const alerts = computeFactoryAlerts(
    baseInput({
      averageTotalMinutes: 60,
      leadTimePerStage: [{ stage: "em_forno", averageMinutes: 999, samples: 1 }],
    }),
  );
  assert.ok(!alerts.some((a) => a.id.startsWith("stage-delay")));
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
