import assert from "node:assert/strict";
import test from "node:test";

import {
  changeAffectsCronograma,
  diffProductFields,
} from "@/lib/supabase-data/product-changelog-diff";

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

// XPAN-6.3: auditoria de cronograma só exigida em mudanças cronograma-relevantes.

test("XPAN-6.3: changeAffectsCronograma — TRUE quando muda dias de produção / lead / mínimo / capacity / active / disponível", () => {
  assert.ok(changeAffectsCronograma(diffProductFields({ production_days: ["segunda"] }, { production_days: ["segunda", "quarta"] })));
  assert.ok(changeAffectsCronograma(diffProductFields({ expedition_lead_days: 1 }, { expedition_lead_days: 0 })));
  assert.ok(changeAffectsCronograma(diffProductFields({ minimum_production_kg: 10 }, { minimum_production_kg: 20 })));
  assert.ok(changeAffectsCronograma(diffProductFields({ capacity_per_batch: 50 }, { capacity_per_batch: 100 })));
  assert.ok(changeAffectsCronograma(diffProductFields({ active: true }, { active: false })));
  assert.ok(changeAffectsCronograma(diffProductFields({ available_for_ordering: true }, { available_for_ordering: false })));
});

test("XPAN-6.3: changeAffectsCronograma — FALSE quando muda só receita/dados não-cronograma", () => {
  assert.equal(changeAffectsCronograma(diffProductFields({ name: "A" }, { name: "B" })), false);
  assert.equal(changeAffectsCronograma(diffProductFields({ description: "x" }, { description: "y" })), false);
  assert.equal(changeAffectsCronograma(diffProductFields({ preparation_mode: "manual" }, { preparation_mode: "automático" })), false);
  assert.equal(changeAffectsCronograma(diffProductFields({ break_percent: 5 }, { break_percent: 7 })), false);
  assert.equal(changeAffectsCronograma(diffProductFields({ validity_days: 3 }, { validity_days: 5 })), false);
  assert.equal(changeAffectsCronograma(diffProductFields({ economic_production_kg: 100 }, { economic_production_kg: 140 })), false);
});

test("XPAN-6.3: changeAffectsCronograma — lista vazia retorna false", () => {
  assert.equal(changeAffectsCronograma([]), false);
});
