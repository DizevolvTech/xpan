export type BusinessCodePrefix = "PD" | "OC";

/**
 * Fuso operacional da fábrica — o mesmo do motor de planejamento.
 *
 * O código de negócio carrega a DATA e é lido por gente (`PD-260724-0001`). Os callers
 * passam `new Date().toISOString()`, que é UTC: fatiar isso direto fazia o código nascer com
 * a data de AMANHÃ a partir das 21h em Brasília. Foi visto ao vivo — ocorrências criadas na
 * noite de 24/07 saíram como `OC-260725-*`.
 */
const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";

const businessCodeDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OPERATIONAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `AAMMDD` da data do instante NO FUSO OPERACIONAL (não no UTC do ISO recebido). */
export function getBusinessCodeScopeKey(dateIso: string) {
  // Chave de data pura (`AAAA-MM-DD`) já É a data operacional — converter fuso aqui
  // devolveria o dia anterior, porque `new Date("2026-07-24")` é meia-noite UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return dateIso.slice(2).replaceAll("-", "");
  }

  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    // Entrada inesperada: degrada para o fatiamento antigo em vez de estourar no meio da
    // criação de pedido/ocorrência.
    return dateIso.slice(2, 10).replaceAll("-", "");
  }
  // en-CA formata como `AAAA-MM-DD`.
  return businessCodeDateFormatter.format(parsed).slice(2).replaceAll("-", "");
}

export function formatMonotonicBusinessCode(
  prefix: BusinessCodePrefix,
  sequenceValue: number,
  dateIso: string,
) {
  const normalizedSequence = Math.max(1, Math.trunc(sequenceValue));
  return `${prefix}-${getBusinessCodeScopeKey(dateIso)}-${String(normalizedSequence).padStart(4, "0")}`;
}

export function formatFallbackBusinessCode(
  prefix: BusinessCodePrefix,
  dateIso = new Date().toISOString(),
) {
  const compactDate = getBusinessCodeScopeKey(dateIso);
  const compactTime = dateIso.slice(11, 19).replaceAll(":", "");
  const randomSuffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `${prefix}-${compactDate}-${compactTime}-${randomSuffix}`;
}
