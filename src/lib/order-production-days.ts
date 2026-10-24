/**
 * Datas de produção de um pedido (reunião 22/10, bloco 6: "eu tenho a entrega prevista,
 * mas não tenho a data da produção prevista"). Cada produto tem seu próprio prazo de
 * produção, então um pedido pode produzir em vários dias.
 */
export interface OrderProductionDays {
  dates: string[];
  /** Texto curto: "Produz 27/10" ou "Produz 25/10 a 27/10 (3 dias)". */
  label: string;
}

function shortBr(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return day && month ? `${day}/${month}` : dateKey;
}

export function summarizeOrderProductionDays(
  items: ReadonlyArray<{ productionDate: string | null; demandSource?: string; isIntermediate?: boolean }>,
): OrderProductionDays {
  const dates = Array.from(
    new Set(
      items
        .filter((item) => item.demandSource !== "cronograma")
        .map((item) => item.productionDate)
        .filter((date): date is string => Boolean(date)),
    ),
  ).sort((a, b) => a.localeCompare(b));
  if (dates.length === 0) return { dates, label: "" };
  if (dates.length === 1) return { dates, label: `Produz ${shortBr(dates[0])}` };
  return {
    dates,
    label: `Produz ${shortBr(dates[0])} a ${shortBr(dates[dates.length - 1])} (${dates.length} dias)`,
  };
}
