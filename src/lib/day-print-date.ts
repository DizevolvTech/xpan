/**
 * Dia que o botão "Imprimir folhas" usa (reunião 22/10, bloco 4: imprimir as OPs de amanhã
 * sem procurar). Ordem: filtro de data escolhido; hoje, se tiver OP; o PRÓXIMO dia com OP
 * (amanhã, em geral); senão o último dia com OP. Antes caía no dia MAIS ANTIGO com OP.
 */
export function resolveDayPrintDate(
  datesWithOps: readonly string[],
  anchorDate: string,
  productionDateFilter: string,
  pendingDates: readonly string[] = [],
): string {
  if (productionDateFilter !== "all") return productionDateFilter;
  const sorted = [...datesWithOps].sort((a, b) => a.localeCompare(b));
  if (sorted.includes(anchorDate)) return anchorDate;
  const next = sorted.find((date) => date > anchorDate);
  if (next) return next;
  // Quadro #10 (31/10): sem OP de hoje em diante, vale o último dia com OP ainda a produzir
  // (em espera ou em produção); antes caía num dia antigo só com OPs já entregues.
  const pending = [...pendingDates].sort((a, b) => a.localeCompare(b));
  return pending[pending.length - 1] ?? sorted[sorted.length - 1] ?? anchorDate;
}
