/**
 * Filtro padrão das listas salvo POR USUÁRIO (reunião 22/10, bloco 2; Lucas 24/10:
 * "padrão salvo por usuário, não por computador").
 *
 * Guardado no `user_metadata.list_filters` do próprio usuário (Supabase Auth), uma entrada
 * por página. Sem tabela nova: o dado é só preferência de tela e segue o login para
 * qualquer computador. Regras puras e testáveis; a rota só aplica.
 */
import type { ListStatusFilterState } from "@/lib/list-status-filter";

export type SavedListFilters = Record<string, ListStatusFilterState>;

const PAGE_KEY = /^[a-z0-9-]{1,60}$/;
const STATUS_KEY = /^[a-z0-9_-]{1,40}$/;
const MAX_PAGES = 40;
const MAX_STATUSES = 20;

export function isValidListFilterPageKey(pageKey: unknown): pageKey is string {
  return typeof pageKey === "string" && PAGE_KEY.test(pageKey);
}

/** Valor salvo aceito: só status em formato de chave e o booleano do histórico. Inválido = null. */
export function sanitizeListFilterValue(value: unknown): ListStatusFilterState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { selected?: unknown; showHistory?: unknown };
  if (!Array.isArray(raw.selected) || raw.selected.length > MAX_STATUSES) return null;
  const selected = raw.selected.filter((entry): entry is string => typeof entry === "string" && STATUS_KEY.test(entry));
  if (selected.length !== raw.selected.length) return null;
  return { selected: Array.from(new Set(selected)), showHistory: raw.showHistory === true };
}

/** Lê o mapa salvo no metadata, descartando o que não for válido. */
export function readSavedListFilters(metadata: unknown): SavedListFilters {
  const source = (metadata as { list_filters?: unknown } | null | undefined)?.list_filters;
  if (!source || typeof source !== "object") return {};
  const result: SavedListFilters = {};
  for (const [pageKey, value] of Object.entries(source as Record<string, unknown>)) {
    if (!isValidListFilterPageKey(pageKey)) continue;
    const clean = sanitizeListFilterValue(value);
    if (clean) result[pageKey] = clean;
  }
  return result;
}

/** Novo mapa após salvar (`value`) ou remover (`null`) o padrão de uma página. */
export function applySavedListFilter(
  current: SavedListFilters,
  pageKey: string,
  value: ListStatusFilterState | null,
): SavedListFilters {
  const next = { ...current };
  if (value === null) {
    delete next[pageKey];
    return next;
  }
  if (!(pageKey in next) && Object.keys(next).length >= MAX_PAGES) {
    throw new Error("Limite de filtros salvos atingido.");
  }
  next[pageKey] = value;
  return next;
}
