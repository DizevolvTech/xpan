import { createRequire } from "node:module";
import Module from "node:module";

// `production-leftovers.ts` se blinda com `import "server-only"`, um módulo
// marcador do Next.js que não resolve dentro do runner tsx. Stub síncrono (CJS +
// cache) ANTES do require abaixo, para testar os helpers puros sem arrastar o
// runtime de servidor. Mesmo padrão de `workflow.test.ts`.
const require = createRequire(import.meta.url);
const ModuleAny = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
};
const STUB_ID = "\0server-only-stub";
const originalResolve = ModuleAny._resolveFilename;
ModuleAny._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return STUB_ID;
  return originalResolve.call(this, request, ...rest);
};
ModuleAny._cache[STUB_ID] = { id: STUB_ID, exports: {}, loaded: true };

import assert from "node:assert/strict";
import test from "node:test";

import type * as ProductionLeftoversModule from "@/lib/supabase-data/production-leftovers";

const { calculateProductionLeftover, recordProductionLeftover } = require(
  "@/lib/supabase-data/production-leftovers",
) as typeof ProductionLeftoversModule;

test("calculateProductionLeftover — lote único sem quantidade informada: produzido = planejado (sem sobra)", () => {
  const result = calculateProductionLeftover({ batchSizes: [40] });

  assert.deepEqual(result, {
    plannedQuantity: 40,
    producedQuantity: 40,
    leftoverQuantity: 0,
    isReported: false,
  });
});

test("calculateProductionLeftover — batido sem quantidade informada: estimativa arredonda a última batida para forma cheia", () => {
  // 3 batidas: 2 cheias de 50 + 1 parcial de 20 → o forno entrega 3 × 50 = 150
  // contra 120 demandados → sobra estimada de 30.
  const result = calculateProductionLeftover({ batchSizes: [50, 50, 20] });

  assert.deepEqual(result, {
    plannedQuantity: 120,
    producedQuantity: 150,
    leftoverQuantity: 30,
    isReported: false,
  });
});

test("calculateProductionLeftover — quantidade informada abaixo do planejado vira FALTA (leftover negativo)", () => {
  // Caso relatado na call: a OP dizia 100 pães, saíram 98 (massa crua pesada errado).
  const result = calculateProductionLeftover({
    batchSizes: [100],
    reportedProducedQuantity: 98,
  });

  assert.deepEqual(result, {
    plannedQuantity: 100,
    producedQuantity: 98,
    leftoverQuantity: -2,
    isReported: true,
  });
});

test("calculateProductionLeftover — quantidade informada acima do planejado vira SOBRA", () => {
  const result = calculateProductionLeftover({
    batchSizes: [50, 50, 20],
    reportedProducedQuantity: 160,
  });

  assert.equal(result.plannedQuantity, 120);
  assert.equal(result.producedQuantity, 160);
  assert.equal(result.leftoverQuantity, 40);
  assert.equal(result.isReported, true);
});

test("calculateProductionLeftover — informar exatamente a estimativa preserva o resultado de hoje", () => {
  const estimated = calculateProductionLeftover({ batchSizes: [50, 50, 20] });
  const confirmed = calculateProductionLeftover({
    batchSizes: [50, 50, 20],
    reportedProducedQuantity: estimated.producedQuantity,
  });

  assert.equal(confirmed.producedQuantity, estimated.producedQuantity);
  assert.equal(confirmed.leftoverQuantity, estimated.leftoverQuantity);
  // Muda só a procedência do número: agora foi o operador que confirmou.
  assert.equal(confirmed.isReported, true);
});

test("calculateProductionLeftover — zero informado é quantidade VÁLIDA (não cai na estimativa)", () => {
  const result = calculateProductionLeftover({
    batchSizes: [50, 50, 20],
    reportedProducedQuantity: 0,
  });

  assert.equal(result.producedQuantity, 0);
  assert.equal(result.leftoverQuantity, -120);
  assert.equal(result.isReported, true);
});

test("calculateProductionLeftover — valores inválidos caem na estimativa", () => {
  const estimated = calculateProductionLeftover({ batchSizes: [50, 50, 20] });

  for (const reported of [null, undefined, Number.NaN, -1, Number.POSITIVE_INFINITY]) {
    const result = calculateProductionLeftover({
      batchSizes: [50, 50, 20],
      reportedProducedQuantity: reported,
    });
    assert.equal(result.producedQuantity, estimated.producedQuantity);
    assert.equal(result.leftoverQuantity, estimated.leftoverQuantity);
    assert.equal(result.isReported, false);
  }
});

test("calculateProductionLeftover — item sem plano de batidas não quebra", () => {
  assert.deepEqual(calculateProductionLeftover({ batchSizes: [] }), {
    plannedQuantity: 0,
    producedQuantity: 0,
    leftoverQuantity: 0,
    isReported: false,
  });
});

test("calculateProductionLeftover — arredonda em 3 casas (evita ruído de ponto flutuante)", () => {
  const result = calculateProductionLeftover({
    batchSizes: [0.1, 0.2],
    reportedProducedQuantity: 0.30000000000000004,
  });

  assert.equal(result.plannedQuantity, 0.3);
  assert.equal(result.producedQuantity, 0.3);
  assert.equal(result.leftoverQuantity, 0);
});

/** Fake mínimo: só `from("production_leftovers").upsert()`, com erros por chamada. */
function fakeSupabase(errors: Array<{ message: string; code?: string } | null>) {
  const payloads: Array<Record<string, unknown>> = [];
  let call = 0;
  const client = {
    from() {
      return {
        upsert(payload: Record<string, unknown>) {
          payloads.push(payload);
          const error = errors[call] ?? null;
          call += 1;
          return Promise.resolve({ error });
        },
      };
    },
  };
  return { client: client as never, payloads, calls: () => call };
}

test("recordProductionLeftover — coluna reported_produced_quantity ausente: regrava sem ela em vez de perder o registro", async () => {
  const { client, payloads } = fakeSupabase([
    {
      code: "PGRST204",
      message:
        "Could not find the 'reported_produced_quantity' column of 'production_leftovers' in the schema cache",
    },
    null,
  ]);

  await recordProductionLeftover(
    {
      tenantId: "tenant-1",
      planningKey: "2026-07-24|line-paes|product-pao",
      productId: "product-pao",
      productionDate: "2026-07-24",
      plannedQuantity: 100,
      producedQuantity: 98,
      reportedProducedQuantity: 98,
      unit: "Un",
    },
    client,
  );

  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].reported_produced_quantity, 98);
  assert.equal("reported_produced_quantity" in payloads[1], false);
  // O número real sobrevive mesmo sem a coluna de auditoria.
  assert.equal(payloads[1].produced_quantity, 98);
  assert.equal(payloads[1].leftover_quantity, -2);
});

test("recordProductionLeftover — tabela ausente é descartada em silêncio (não quebra a produção)", async () => {
  const { client, calls } = fakeSupabase([
    { code: "42P01", message: 'relation "public.production_leftovers" does not exist' },
  ]);

  await recordProductionLeftover(
    {
      tenantId: "tenant-1",
      planningKey: "2026-07-24|line-paes|product-pao",
      productId: "product-pao",
      productionDate: "2026-07-24",
      plannedQuantity: 100,
      producedQuantity: 98,
      unit: "Un",
    },
    client,
  );

  assert.equal(calls(), 1);
});

test("recordProductionLeftover — erro real continua estourando", async () => {
  const { client } = fakeSupabase([{ code: "23505", message: "boom" }]);

  await assert.rejects(
    recordProductionLeftover(
      {
        tenantId: "tenant-1",
        planningKey: "2026-07-24|line-paes|product-pao",
        productId: "product-pao",
        productionDate: "2026-07-24",
        plannedQuantity: 100,
        producedQuantity: 98,
        unit: "Un",
      },
      client,
    ),
    /Failed to record production leftover: boom/,
  );
});
