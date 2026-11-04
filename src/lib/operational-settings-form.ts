/**
 * Quadro #235: regras do formulário "Regras de pedido e expedição" (horário limite, D+X).
 * Puro, testável: diz POR QUE não dá para salvar (nunca botão desabilitado sem explicação) e
 * traduz a falha do servidor/rede em mensagem clara.
 */
export interface OperationalSettingsDraft {
  orderCutoffTime: string;
  expeditionLeadDays: string;
  saleLeadDays: string;
}

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?$/;

function leadDaysProblem(label: string, raw: string): string | null {
  if (raw.trim() === "") return `Informe o ${label} (de 0 a 30 dias).`;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 30) return `O ${label} precisa ser um número inteiro de 0 a 30.`;
  return null;
}

/** Primeiro problema do formulário (null = válido). */
export function operationalSettingsFormProblem(draft: OperationalSettingsDraft): string | null {
  if (draft.orderCutoffTime.trim() === "") return "Informe o horário limite do pedido.";
  if (!TIME_PATTERN.test(draft.orderCutoffTime.trim())) return "O horário limite está inválido. Use o formato HH:MM.";
  return (
    leadDaysProblem("prazo de expedição (D+X)", draft.expeditionLeadDays) ??
    leadDaysProblem("prazo de venda", draft.saleLeadDays)
  );
}

/** Horário vindo do banco (HH:MM:SS) ou do campo de hora, no formato HH:MM do input. */
export function toTimeInputValue(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value;
}

/** Por que o botão "Salvar regras" está parado (null = pode salvar ou nada mudou). */
export function operationalSettingsSaveBlock(input: {
  draft: OperationalSettingsDraft;
  readOnlyTenant: boolean;
}): string | null {
  if (input.readOnlyTenant) {
    return "Este cliente está aberto em modo leitura (acesso master): as regras não podem ser alteradas por aqui.";
  }
  return operationalSettingsFormProblem(input.draft);
}

/** Mensagem para quando o salvamento falha: sempre diz o motivo, nunca "falhou" sem explicar. */
export function describeOperationalSettingsSaveError(input: { status?: number; serverMessage?: string | null; thrown?: unknown }): string {
  const server = input.serverMessage?.trim();
  if (server && !/^failed to /i.test(server)) return server;
  if (input.status === 401) return "Sua sessão expirou. Entre de novo e salve as regras outra vez.";
  if (input.status === 403) return "Você não tem permissão para alterar as regras de pedido e expedição.";
  if (input.status !== undefined && input.status >= 500) {
    return `Não foi possível gravar as regras agora (erro ${input.status}${server ? `: ${server}` : ""}). Tente de novo em instantes.`;
  }
  if (input.status === undefined && input.thrown instanceof TypeError) {
    return "Sem conexão com o servidor. Confira a internet e tente salvar de novo.";
  }
  if (input.thrown instanceof Error && input.thrown.message) return input.thrown.message;
  return "Não foi possível salvar as regras. Tente de novo.";
}
