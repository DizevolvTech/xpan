import assert from "node:assert/strict";
import test from "node:test";

import { planScheduleRevisionRebuild } from "@/lib/supabase-data/schedule-revision-plan";

test("planScheduleRevisionRebuild — reaproveita a revisão pendente existente (não destrói)", () => {
  // AJ-0025: editar receita NÃO pode recriar a revisão com id novo, pois o
  // scheduleId entra no planning_key (productionDate|sectorId|lineId|scheduleId)
  // e recriar órfã as OPs/statuses persistidos. Reusar o id estável.
  const plan = planScheduleRevisionRebuild({
    pendingSchedules: [{ id: "sched-pending", created_at: "2026-05-20T10:00:00Z" }],
    activeScheduleId: null,
    productCount: 4,
  });

  assert.equal(plan.reuseScheduleLineId, "sched-pending");
  assert.equal(plan.recreated, false);
  assert.deepEqual(plan.staleScheduleLineIds, []);
  // Reaproveitando a pendente, o ativo já foi desativado quando ela nasceu —
  // não desativar de novo (evita zerar o cronograma a cada edição).
  assert.equal(plan.deactivateActiveScheduleId, null);
});

test("planScheduleRevisionRebuild — sem pendente, recria a partir do ativo e devolve impacto", () => {
  const plan = planScheduleRevisionRebuild({
    pendingSchedules: [],
    activeScheduleId: "sched-active",
    productCount: 7,
  });

  assert.equal(plan.reuseScheduleLineId, null);
  assert.equal(plan.recreated, true);
  // Recriação inevitável → desativa o ativo (revisão precisa de nova auditoria).
  assert.equal(plan.deactivateActiveScheduleId, "sched-active");
  assert.deepEqual(plan.impact, {
    affectedPendingRevisions: 0,
    affectedProducts: 7,
    recreated: true,
  });
});

test("planScheduleRevisionRebuild — múltiplas pendentes: reusa a mais recente e consolida o resto", () => {
  const plan = planScheduleRevisionRebuild({
    pendingSchedules: [
      { id: "sched-old", created_at: "2026-05-18T08:00:00Z" },
      { id: "sched-new", created_at: "2026-05-21T08:00:00Z" },
      { id: "sched-mid", created_at: "2026-05-19T08:00:00Z" },
    ],
    activeScheduleId: null,
    productCount: 2,
  });

  assert.equal(plan.reuseScheduleLineId, "sched-new");
  assert.equal(plan.recreated, false);
  assert.deepEqual(plan.staleScheduleLineIds.sort(), ["sched-mid", "sched-old"]);
  assert.equal(plan.impact.affectedPendingRevisions, 3);
});
