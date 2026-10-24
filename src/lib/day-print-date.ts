/**
 * Dia que o botão "Imprimir folhas" usa (reunião 22/10, bloco 4: imprimir as OPs de amanhã
 * sem procurar). Ordem: filtro de data escolhido; hoje, se tiver OP; o PRÓXIMO dia com OP
 * (amanhã, em geral); senão o último dia com OP. Antes caía no dia MAIS ANTIGO com OP.
 */
export function resolveDayPrintDate(
  datesWithOps: readonly string[],
  anchorDate: string,
  productionDateFilter: string,
): string {
  if (productionDateFilter !== "all") return productionDateFilter;
  const sorted = [...datesWithOps].sort((a, b) => a.localeCompare(b));
  if (sorted.includes(anchorDate)) return anchorDate;
  return sorted.find((date) => date > anchorDate) ?? sorted[sorted.length - 1] ?? anchorDate;
}
