import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStoreOccurrenceStatusUpdate,
  canOpenOccurrenceForDeliveryStatus,
  canTransitionStoreOccurrenceStatus,
  normalizeStoreOccurrenceComment,
  validateStoreOccurrenceDraft,
} from "@/lib/store-occurrence-workflow";

test("occurrences can only be opened after the order enters delivery flow", () => {
  assert.equal(canOpenOccurrenceForDeliveryStatus("aguardando_expedicao"), false);
  assert.equal(canOpenOccurrenceForDeliveryStatus("pronto_coleta"), false);
  assert.equal(canOpenOccurrenceForDeliveryStatus("em_rota"), true);
  assert.equal(canOpenOccurrenceForDeliveryStatus("no_destino"), true);
  assert.equal(canOpenOccurrenceForDeliveryStatus("entregue"), true);
  assert.equal(canOpenOccurrenceForDeliveryStatus("tentativa_falha"), false);
});

test("factory workflow can analyze, resolve and reopen occurrences", () => {
  assert.equal(canTransitionStoreOccurrenceStatus("aberta", "em_analise", "gestor-fabrica"), true);
  assert.equal(canTransitionStoreOccurrenceStatus("em_analise", "resolvida", "gestor-fabrica"), true);
  assert.equal(canTransitionStoreOccurrenceStatus("em_analise", "aberta", "gestor-fabrica"), true);
  assert.equal(canTransitionStoreOccurrenceStatus("resolvida", "aberta", "gestor-fabrica"), true);
  assert.equal(canTransitionStoreOccurrenceStatus("fechada", "aberta", "gestor-fabrica"), true);
  assert.equal(canTransitionStoreOccurrenceStatus("aberta", "fechada", "gestor-fabrica"), false);
});

test("store workflow can confirm closing or reopen after resolution", () => {
  assert.equal(canTransitionStoreOccurrenceStatus("resolvida", "fechada", "loja"), true);
  assert.equal(canTransitionStoreOccurrenceStatus("resolvida", "aberta", "loja"), true);
  assert.equal(canTransitionStoreOccurrenceStatus("fechada", "aberta", "loja"), true);
  assert.equal(canTransitionStoreOccurrenceStatus("aberta", "em_analise", "loja"), false);
  assert.equal(canTransitionStoreOccurrenceStatus("em_analise", "resolvida", "loja"), false);
});

test("occurrence draft validation trims payload and enforces minimum business rules", () => {
  assert.deepEqual(
    validateStoreOccurrenceDraft({
      problemType: "  Produto danificado  ",
      quantityType: "kg",
      quantity: 12.5,
      quantityUnitSnapshot: " Kg ",
      productNameSnapshot: " Coxa temperada ",
      description: "  Embalagem rasgada e parte do lote chegou avariada.  ",
    }),
    {
      problemType: "Produto danificado",
      quantityType: "kg",
      quantity: 12.5,
      quantityUnitSnapshot: "Kg",
      productNameSnapshot: "Coxa temperada",
      description: "Embalagem rasgada e parte do lote chegou avariada.",
    },
  );

  assert.throws(
    () =>
      validateStoreOccurrenceDraft({
        problemType: "Produto danificado",
        quantityType: "percentual",
        quantity: 101,
        quantityUnitSnapshot: "%",
        productNameSnapshot: "Coxa temperada",
        description: "Entrega com avaria e perdas acima do esperado.",
      }),
    /cannot exceed 100/,
  );

  assert.throws(
    () =>
      validateStoreOccurrenceDraft({
        problemType: "Produto danificado",
        quantityType: "kg",
        quantity: 1,
        quantityUnitSnapshot: "Kg",
        productNameSnapshot: "Coxa temperada",
        description: "Muito curto",
      }),
    /at least 20 characters/,
  );
});

test("reopening an occurrence clears previous resolution metadata", () => {
  assert.deepEqual(
    buildStoreOccurrenceStatusUpdate("em_analise", "resolvida", "profile-1", "2026-03-19T10:00:00.000Z"),
    {
      status: "resolvida",
      updated_at: "2026-03-19T10:00:00.000Z",
      resolved_at: "2026-03-19T10:00:00.000Z",
      resolved_by_profile_id: "profile-1",
    },
  );

  assert.deepEqual(
    buildStoreOccurrenceStatusUpdate("resolvida", "aberta", "profile-1", "2026-03-19T11:00:00.000Z"),
    {
      status: "aberta",
      updated_at: "2026-03-19T11:00:00.000Z",
      resolved_at: null,
      resolved_by_profile_id: null,
    },
  );

  assert.deepEqual(
    buildStoreOccurrenceStatusUpdate("fechada", "aberta", "profile-1", "2026-03-19T12:00:00.000Z"),
    {
      status: "aberta",
      updated_at: "2026-03-19T12:00:00.000Z",
      resolved_at: null,
      resolved_by_profile_id: null,
    },
  );
});

test("occurrence comments cannot be empty after trimming", () => {
  assert.equal(normalizeStoreOccurrenceComment("  Comentario valido  "), "Comentario valido");
  assert.throws(() => normalizeStoreOccurrenceComment("   "), /cannot be empty/);
});
