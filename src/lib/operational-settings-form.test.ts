import assert from "node:assert/strict";
import test from "node:test";

import {
  describeOperationalSettingsSaveError,
  operationalSettingsFormProblem,
  operationalSettingsSaveBlock,
  toTimeInputValue,
  isOperationalSettingsReady,
} from "@/lib/operational-settings-form";

const OK = { orderCutoffTime: "16:30", expeditionLeadDays: "1", saleLeadDays: "1" };

test("#235: formulário válido não tem problema; HH:MM:SS também vale", () => {
  assert.equal(operationalSettingsFormProblem(OK), null);
  assert.equal(operationalSettingsFormProblem({ ...OK, orderCutoffTime: "16:30:00" }), null);
});

test("#235: prazo vazio NÃO vira 0 em silêncio: explica o que falta", () => {
  assert.match(operationalSettingsFormProblem({ ...OK, expeditionLeadDays: "" }) ?? "", /Informe o prazo de expedição/);
  assert.match(operationalSettingsFormProblem({ ...OK, saleLeadDays: "  " }) ?? "", /Informe o prazo de venda/);
  assert.match(operationalSettingsFormProblem({ ...OK, saleLeadDays: "31" }) ?? "", /0 a 30/);
  assert.match(operationalSettingsFormProblem({ ...OK, expeditionLeadDays: "1.5" }) ?? "", /inteiro/);
});

test("#235: horário vazio ou inválido tem mensagem", () => {
  assert.match(operationalSettingsFormProblem({ ...OK, orderCutoffTime: "" }) ?? "", /Informe o horário limite/);
  assert.match(operationalSettingsFormProblem({ ...OK, orderCutoffTime: "25:00" }) ?? "", /inválido/);
});

test("#235: cliente aberto em modo leitura (master) explica por que não salva", () => {
  assert.match(operationalSettingsSaveBlock({ draft: OK, readOnlyTenant: true }) ?? "", /modo leitura/);
  assert.equal(operationalSettingsSaveBlock({ draft: OK, readOnlyTenant: false }), null);
});

test("#235: horário do banco vira o valor do campo de hora", () => {
  assert.equal(toTimeInputValue("16:30:00"), "16:30");
  assert.equal(toTimeInputValue("9:05"), "09:05");
});

test("#235: erro de salvar sempre tem mensagem clara", () => {
  assert.equal(describeOperationalSettingsSaveError({ status: 403, serverMessage: "O cliente selecionado está aberto em modo leitura." }), "O cliente selecionado está aberto em modo leitura.");
  assert.match(describeOperationalSettingsSaveError({ status: 403 }), /permissão/);
  assert.match(describeOperationalSettingsSaveError({ status: 401 }), /sessão expirou/);
  assert.match(describeOperationalSettingsSaveError({ status: 500, serverMessage: "Failed to update operational settings: x" }), /erro 500/);
  assert.match(describeOperationalSettingsSaveError({ status: 502 }), /erro 502/);
  assert.match(describeOperationalSettingsSaveError({ thrown: new TypeError("Failed to fetch") }), /Sem conexão/);
  assert.match(describeOperationalSettingsSaveError({}), /Não foi possível salvar/);
});

test("#235 regras só editáveis quando o valor real é conhecido (sem mostrar 18:00/D+0 padrão editável)", () => {
  assert.equal(isOperationalSettingsReady({ savedSettingsLoaded: false, masterDataLoading: true, masterDataError: false }), false);
  assert.equal(isOperationalSettingsReady({ savedSettingsLoaded: false, masterDataLoading: false, masterDataError: true }), false);
  assert.equal(isOperationalSettingsReady({ savedSettingsLoaded: true, masterDataLoading: true, masterDataError: false }), true);
  assert.equal(isOperationalSettingsReady({ savedSettingsLoaded: false, masterDataLoading: false, masterDataError: false }), true);
});
