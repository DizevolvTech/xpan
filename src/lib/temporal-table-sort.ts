export type TemporalSortOrder = "recent_first" | "old_first";

const defaultTemporalSortKeys = [
  "updatedAt",
  "createdAt",
  "auditedAt",
  "deactivatedAt",
  "orderedAtKey",
  "orderedAt",
  "productionDate",
  "deliveryDateKey",
  "deliveryDate",
  "saleDate",
  "executionUpdatedAt",
  "date",
] as const;

function parseBrDateTime(value: string) {
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[,\s-]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (!match) {
    return null;
  }

  const [, day, month, year, hours = "00", minutes = "00", seconds = "00"] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );

  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function parseTemporalSortValue(value: unknown): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const date = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  const brDateTime = parseBrDateTime(normalized);
  if (brDateTime !== null) {
    return brDateTime;
  }

  const isoTimestamp = Date.parse(normalized);
  if (!Number.isNaN(isoTimestamp)) {
    return isoTimestamp;
  }

  return null;
}

function getCandidateKeys(candidateKeys?: string[]) {
  return candidateKeys?.length ? candidateKeys : [...defaultTemporalSortKeys];
}

export function resolveTemporalSortKey<T extends object>(items: T[], candidateKeys?: string[]) {
  const keys = getCandidateKeys(candidateKeys);

  return (
    keys.find((key) =>
      items.some((item) => parseTemporalSortValue((item as Record<string, unknown>)[key]) !== null),
    ) ?? null
  );
}

export function hasTemporalSortValue<T extends object>(items: T[], candidateKeys?: string[]) {
  return resolveTemporalSortKey(items, candidateKeys) !== null;
}

export function sortItemsByTemporalValue<T extends object>(
  items: T[],
  sortOrder: TemporalSortOrder,
  candidateKeys?: string[],
) {
  const sortKey = resolveTemporalSortKey(items, candidateKeys);
  if (!sortKey) {
    return items;
  }

  return items
    .map((item, index) => ({
      item,
      index,
      timestamp: parseTemporalSortValue((item as Record<string, unknown>)[sortKey]),
    }))
    .sort((left, right) => {
      if (left.timestamp === null && right.timestamp === null) {
        return left.index - right.index;
      }
      if (left.timestamp === null) {
        return 1;
      }
      if (right.timestamp === null) {
        return -1;
      }

      const diff =
        sortOrder === "recent_first"
          ? right.timestamp - left.timestamp
          : left.timestamp - right.timestamp;

      if (diff !== 0) {
        return diff;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.item);
}
