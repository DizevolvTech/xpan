/**
 * Filtro de status das listas de OP e pedidos (feedback 5 e 6 do cliente).
 *
 * - Seleção vazia = visão PADRÃO: só as pendências (esconde os status finalizados);
 * - `showHistory` = "Ver histórico": mostra tudo, inclusive os finalizados;
 * - seleção com 1+ status = esses status (multi-seleção), mesmo que finalizados — escolher
 *   explicitamente um status finalizado sempre mostra esse status.
 *
 * Só apresentação: nada aqui altera dado nem regra de negócio. Lógica pura e testável.
 */

export interface ListStatusFilterState {
  selected: string[];
  showHistory: boolean;
}

export const defaultListStatusFilter: ListStatusFilterState = { selected: [], showHistory: false };

export function matchesListStatus(
  status: string,
  state: ListStatusFilterState,
  finalStatuses: readonly string[],
): boolean {
  if (state.selected.length > 0) return state.selected.includes(status);
  if (state.showHistory) return true;
  return !finalStatuses.includes(status);
}

/** Há algo diferente do padrão (pendências) aplicado? Alimenta o contador de filtros ativos. */
export function isListStatusFilterCustom(state: ListStatusFilterState): boolean {
  return state.selected.length > 0 || state.showHistory;
}

export function toggleListStatus(state: ListStatusFilterState, status: string): ListStatusFilterState {
  const selected = state.selected.includes(status)
    ? state.selected.filter((entry) => entry !== status)
    : [...state.selected, status];
  return { ...state, selected };
}

/** Lê o padrão salvo da página; qualquer coisa inválida volta ao padrão de fábrica. */
export function parseSavedListStatusFilter(
  raw: string | null | undefined,
  validStatuses: readonly string[],
): ListStatusFilterState {
  if (!raw) return defaultListStatusFilter;
  try {
    const parsed = JSON.parse(raw) as Partial<ListStatusFilterState> | null;
    const selected = Array.isArray(parsed?.selected)
      ? parsed.selected.filter((entry): entry is string => typeof entry === "string" && validStatuses.includes(entry))
      : [];
    return { selected, showHistory: parsed?.showHistory === true };
  } catch {
    return defaultListStatusFilter;
  }
}

export function serializeListStatusFilter(state: ListStatusFilterState): string {
  return JSON.stringify({ selected: state.selected, showHistory: state.showHistory });
}
