/**
 * Mantém a ordem da lista, mas junta as linhas do mesmo grupo logo depois da primeira linha do
 * grupo (quadro #4, 27/10: pedidos do mesmo lote ficam juntos). Linhas sem grupo (null) não mudam.
 */
export function clusterRowsByGroup<T>(rows: ReadonlyArray<T>, groupOf: (row: T) => string | null): T[] {
  const members = new Map<string, T[]>();
  for (const row of rows) {
    const key = groupOf(row);
    if (key === null) continue;
    const list = members.get(key) ?? [];
    list.push(row);
    members.set(key, list);
  }
  const placed = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    const key = groupOf(row);
    if (key === null) {
      result.push(row);
    } else if (!placed.has(key)) {
      placed.add(key);
      result.push(...(members.get(key) ?? []));
    }
  }
  return result;
}
