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
 * Lança `FutureWorkflowDateError` se a produção (data da chave) estiver no futuro
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
      `Não é possível concluir a produção de ${formatDateKeyBr(productionDate)} antes da data chegar (hoje é ${formatDateKeyBr(today)}).`,
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
