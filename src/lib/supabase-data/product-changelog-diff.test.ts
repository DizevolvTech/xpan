import assert from "node:assert/strict";
import test from "node:test";

import { diffProductFields } from "@/lib/supabase-data/product-changelog-diff";

test("diffProductFields — detecta mudança de campos primitivos com rótulo e de/para legível", () => {
  const before = { name: "Pão Francês", minimum_production_kg: 900, active: true };
  const after = { name: "Pão Francês Especial", minimum_production_kg: 1200, active: true };

  const changes = diffProductFields(before, after);

  assert.deepEqual(changes, [
    { field: "name", label: "Nome", from: "Pão Francês", to: "Pão Francês Especial" },
    { field: "minimum_production_kg", label: "Produção mínima (Kg)", from: "900", to: "1.200" },
  ]);
});

test("diffProductFields — booleano vira Sim/Não", () => {
  const before = { available_for_ordering: true };
  const after = { available_for_ordering: false };

  const changes = diffProductFields(before, after);

  assert.deepEqual(changes, [
    { field: "available_for_ordering", label: "Disponível para pedido", from: "Sim", to: "Não" },
  ]);
});

test("diffProductFields — dias de produção (array) comparados por conteúdo", () => {
  const before = { production_days: ["segunda", "quarta"] };
  const after = { production_days: ["segunda", "quarta", "sexta"] };

  const changes = diffProductFields(before, after);

  assert.equal(changes.length, 1);
  assert.equal(changes[0].field, "production_days");
  assert.equal(changes[0].label, "Dias de produção");
  assert.match(changes[0].to, /sexta/);
});

test("diffProductFields — sem mudança nos campos auditados retorna lista vazia (tipos numéricos vs string)", () => {
  const before = { minimum_production_kg: "900", name: "Bolo" };
  const after = { minimum_production_kg: 900, name: "Bolo" };

  assert.deepEqual(diffProductFields(before, after), []);
});

test("diffProductFields — ignora campos fora da lista auditada", () => {
  const before = { internal_flag: 1, name: "X" };
  const after = { internal_flag: 2, name: "X" };

  assert.deepEqual(diffProductFields(before, after), []);
});
