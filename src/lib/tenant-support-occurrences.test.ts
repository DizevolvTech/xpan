import assert from "node:assert/strict";
import test from "node:test";

import {
  canCommentOnTenantSupportOccurrence,
  canMasterActorUpdateSupportStatus,
  canTenantActorUpdateSupportStatus,
  normalizeTenantSupportOccurrenceDraft,
} from "@/lib/tenant-support-occurrences";

test("tenant support draft requires a clear title and description", () => {
  assert.throws(
    () =>
      normalizeTenantSupportOccurrenceDraft({
        title: "Senha",
        category: "usuarios",
        priority: "media",
        description: "Curto",
      }),
    /Descreva|assunto/i,
  );

  assert.deepEqual(
    normalizeTenantSupportOccurrenceDraft({
      title: "Reset de senha do administrador",
      category: "usuarios",
      priority: "alta",
      description: "O cliente trocou a senha e precisamos recuperar o acesso.",
    }),
    {
      title: "Reset de senha do administrador",
      category: "usuarios",
      priority: "alta",
      description: "O cliente trocou a senha e precisamos recuperar o acesso.",
    },
  );
});

test("master can move tenant support occurrences through the support workflow", () => {
  assert.equal(canMasterActorUpdateSupportStatus("aberta", "em_analise"), true);
  assert.equal(
    canMasterActorUpdateSupportStatus("aguardando_cliente", "resolvida"),
    true,
  );
  assert.equal(canMasterActorUpdateSupportStatus("fechada", "fechada"), false);
});

test("tenant admins only reopen or confirm closure of tenant support occurrences", () => {
  assert.equal(canTenantActorUpdateSupportStatus("resolvida", "fechada"), true);
  assert.equal(
    canTenantActorUpdateSupportStatus("aguardando_cliente", "aberta"),
    true,
  );
  assert.equal(canTenantActorUpdateSupportStatus("aberta", "resolvida"), false);
  assert.equal(canCommentOnTenantSupportOccurrence("fechada"), false);
});
