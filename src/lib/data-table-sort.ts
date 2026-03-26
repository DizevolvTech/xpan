export type ColumnSortDirection = "asc" | "desc";

export type ColumnSortState = {
  key: string;
  direction: ColumnSortDirection;
};

type ColumnSortResolver<T> = (item: T) => unknown;

export function toggleColumnSort(
  current: ColumnSortState | null,
  key: string,
): ColumnSortState | null {
  if (!current || current.key !== key) {
    return { key, direction: "asc" };
  }

  if (current.direction === "asc") {
    return { key, direction: "desc" };
  }

  return null;
}

function compareUnknownValues(left: unknown, right: unknown) {
  if (left === right) {
    return 0;
  }

  if (left === null || left === undefined || left === "") {
    return 1;
  }

  if (right === null || right === undefined || right === "") {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

export function applyColumnSort<T>(
  items: T[],
  sortState: ColumnSortState | null,
  resolvers: Record<string, ColumnSortResolver<T>>,
) {
  if (!sortState) {
    return items;
  }

  const resolver = resolvers[sortState.key];
  if (!resolver) {
    return items;
  }

  return [...items].sort((left, right) => {
    const comparison = compareUnknownValues(resolver(left), resolver(right));
    return sortState.direction === "asc" ? comparison : comparison * -1;
  });
}
