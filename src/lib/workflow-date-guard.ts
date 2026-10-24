/**
 * Trava de DATA FUTURA para o workflow de produção/entrega.
 *
 * Motivação (incidente 2026-06): o status de produção (`workflow_production_items`)
 * e de entrega (`delivery_executions`) podia ser marcado como `concluido`/`entregue`
 * ANTES da data agendada chegar (ex.: produção de amanhã marcada como feita hoje).
 * Como `concluido` é o portão que joga o pedido para "Aguardando expedição", isso
 * fazia pedidos não produzidos pularem direto para a expedição, confundindo o chão.
 *
 * Esta trava impede registrar produção CONCLUÍDA ou entrega ENTREGUE para uma data
 * estritamente no futuro. Hoje e datas passadas continuam permitidos (conclusão no
 * dia ou registro tardio são legítimos). Desfazer/corrigir nunca é bloqueado.
 */

/** Erro de validação: tentativa de concluir produção/entrega em data futura. Mapeado para HTTP 400 nos routes. */
export class FutureWorkflowDateError extends Error {
  readonly reason: "production_in_future" | "delivery_in_future";

  constructor(reason: "production_in_future" | "delivery_in_future", message: string) {
    super(message);
    this.name = "FutureWorkflowDateError";
    this.reason = reason;
  }
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Quem pode FORÇAR a conclusão/entrega em data futura (override da trava).
 * Só gestor de fábrica e administrador — o chão nunca força (a decisão de role é
 * SEMPRE no servidor; nunca confiar no cliente). Mesmo critério do override de
 * checklist na entrega.
 */
export function canOverrideFutureWorkflowDate(role: string | null | undefined): boolean {
  return role === "administrador" || role === "gestor-fabrica";
}

/** "Hoje" no fuso operacional (America/Sao_Paulo), como `YYYY-MM-DD`. */
export function getOperationalTodayKey(): string {
  // en-CA formata como ISO `YYYY-MM-DD`; timeZone fixo evita depender do TZ do
  // servidor (Vercel roda em UTC, o que adiantaria o "hoje" perto da meia-noite).
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** `DD/MM/AAAA` para mensagens ao usuário. */
function formatDateKeyBr(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return day && month && year ? `${day}/${month}/${year}` : dateKey;
}

/** Extrai a data (1ª parte) de uma `production_item_key` no formato `data|linha|produto`. */
export function getProductionDateFromKey(productionItemKey: string): string | null {
  const datePart = productionItemKey.split("|")[0];
  return DATE_KEY.test(datePart) ? datePart : null;
}

/**
 * Feedback 10 (cliente): em data futura o que se trava é o INÍCIO da produção, não a conclusão.
 * Quem já iniciou (item fora de `nao_iniciado`, ou com ao menos uma batida) conclui sem override.
 * Saltar direto de `nao_iniciado` para `concluido` conta como início — continua travado.
 */
export function isProductionStartTransition(currentStatus: string | null | undefined): boolean {
  return !currentStatus || currentStatus === "nao_iniciado";
}

/** Batida nº 1 é o início da produção em batidas; da 2ª em diante a produção já começou. */
export function isFirstProductionBatch(batchesDoneBefore: number): boolean {
  return batchesDoneBefore <= 0;
}

/**
 * Lança `FutureWorkflowDateError` se o INÍCIO da produção (data da chave) estiver no futuro
 * relativo a `today`. Chaves sem data válida (formato inesperado) não bloqueiam —
 * a trava nunca deve travar por não conseguir interpretar a chave.
 */
export function assertProductionNotInFuture(
  productionItemKey: string,
  today: string = getOperationalTodayKey(),
): void {
  const productionDate = getProductionDateFromKey(productionItemKey);
  if (productionDate && productionDate > today) {
    throw new FutureWorkflowDateError(
      "production_in_future",
      `Não é possível iniciar a produção de ${formatDateKeyBr(productionDate)} antes da data chegar (hoje é ${formatDateKeyBr(today)}). Só o gestor pode liberar o início antecipado; depois de iniciada, a produção pode ser concluída normalmente.`,
    );
  }
}

/**
 * Lança `FutureWorkflowDateError` se a entrega estiver agendada para uma data
 * futura relativa a `today`. Data ausente/inválida não bloqueia.
 */
export function assertDeliveryNotInFuture(
  deliveryDate: string | null | undefined,
  today: string = getOperationalTodayKey(),
): void {
  if (deliveryDate && DATE_KEY.test(deliveryDate) && deliveryDate > today) {
    throw new FutureWorkflowDateError(
      "delivery_in_future",
      `Não é possível marcar como entregue antes da data de entrega (${formatDateKeyBr(deliveryDate)}); hoje é ${formatDateKeyBr(today)}.`,
    );
  }
}

/**
 * Reunião 22/10 (bloco 6) — decisão do Lucas (24/10): antecipar produção é só AVISO, sem
 * bloqueio, para qualquer usuário. Devolve a mensagem de aviso quando o INÍCIO da produção
 * acontece antes da data prevista; `null` quando está no dia ou atrasada.
 */
export function describeProductionAnticipation(
  productionItemKey: string,
  today: string = getOperationalTodayKey(),
): string | null {
  const productionDate = getProductionDateFromKey(productionItemKey);
  if (!productionDate || productionDate <= today) return null;
  return `Produção antecipada: estava prevista para ${formatDateKeyBr(productionDate)} (hoje é ${formatDateKeyBr(today)}).`;
}
