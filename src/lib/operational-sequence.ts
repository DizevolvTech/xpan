import { formatDateBr } from "@/lib/production-planning";

export interface OperationalDateSummary {
  value: string;
  helper: string | null;
  count: number;
}

export function summarizeOperationalDates(
  rawDates: Array<string | null | undefined>,
  options: {
    emptyValue?: string;
    emptyHelper?: string | null;
    mixedValue?: string;
  } = {},
): OperationalDateSummary {
  const dates = Array.from(
    new Set(rawDates.filter((value): value is string => Boolean(value))),
  ).sort((left, right) => left.localeCompare(right));

  if (dates.length === 0) {
    return {
      value: options.emptyValue ?? "Sem agenda",
      helper: options.emptyHelper ?? null,
      count: 0,
    };
  }

  if (dates.length === 1) {
    return {
      value: formatDateBr(dates[0]),
      helper: null,
      count: 1,
    };
  }

  return {
    value: options.mixedValue ?? "Varia por item",
    helper: `${dates.length} datas possíveis: ${formatDateBr(dates[0])} a ${formatDateBr(
      dates[dates.length - 1],
    )}.`,
    count: dates.length,
  };
}
