"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  defaultListStatusFilter,
  isListStatusFilterCustom,
  matchesListStatus,
  parseSavedListStatusFilter,
  serializeListStatusFilter,
  toggleListStatus,
  type ListStatusFilterState,
} from "@/lib/list-status-filter";
import type { SavedListFilters } from "@/lib/saved-list-filters";

const LEGACY_STORAGE_PREFIX = "xpan:list-status-filter:";
const ENDPOINT = "/api/me/list-filters";

// Uma leitura por carregamento do app, compartilhada entre as listas (sem N chamadas).
let savedFiltersRequest: Promise<SavedListFilters | null> | null = null;

function loadSavedFilters(): Promise<SavedListFilters | null> {
  if (!savedFiltersRequest) {
    savedFiltersRequest = fetch(ENDPOINT, { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<SavedListFilters>) : null))
      .catch(() => null);
    // Falha não fica em cache: a próxima tela tenta de novo.
    void savedFiltersRequest.then((result) => {
      if (result === null) savedFiltersRequest = null;
    });
  }
  return savedFiltersRequest;
}

async function persistSavedFilter(pageKey: string, value: ListStatusFilterState | null) {
  const response = await fetch(ENDPOINT, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageKey, value }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Não foi possível salvar o filtro.");
  }
  const next = (await response.json()) as SavedListFilters;
  savedFiltersRequest = Promise.resolve(next);
  return next;
}

function readLegacyDefault(pageKey: string): string | null {
  try {
    return window.localStorage.getItem(LEGACY_STORAGE_PREFIX + pageKey);
  } catch {
    return null;
  }
}

function dropLegacyDefault(pageKey: string) {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_PREFIX + pageKey);
  } catch {
    // sem storage: nada a limpar
  }
}

/**
 * Estado do filtro de status de uma lista (multi-seleção + Ver histórico) com "padrão da página"
 * salvo NO USUÁRIO (vale em qualquer computador; reunião 22/10, bloco 2).
 * `initialStatus` (deep-link ?status=) vence o padrão salvo. Padrão antigo deste navegador
 * (versão anterior) é levado para o usuário uma vez e apagado do navegador.
 */
export function useListStatusFilter({
  pageKey,
  finalStatuses,
  validStatuses,
  initialStatus,
}: {
  pageKey: string;
  finalStatuses: readonly string[];
  validStatuses: readonly string[];
  initialStatus?: string | null;
}) {
  const hasDeepLink = Boolean(initialStatus && initialStatus !== "all");
  const [state, setState] = useState<ListStatusFilterState>(() =>
    hasDeepLink ? { selected: [initialStatus as string], showHistory: false } : defaultListStatusFilter,
  );
  const [hasSavedDefault, setHasSavedDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSavedFilters().then(async (saved) => {
      if (cancelled || !saved) return;
      let value = saved[pageKey] ?? null;
      const legacy = readLegacyDefault(pageKey);
      if (!value && legacy) {
        const migrated = parseSavedListStatusFilter(legacy, validStatuses);
        try {
          await persistSavedFilter(pageKey, migrated);
          value = migrated;
        } catch {
          // migração falhou: tenta de novo na próxima abertura
          return;
        }
      }
      if (legacy) dropLegacyDefault(pageKey);
      if (cancelled || !value) return;
      setHasSavedDefault(true);
      if (!hasDeepLink) {
        setState(parseSavedListStatusFilter(serializeListStatusFilter(value), validStatuses));
      }
    });
    return () => {
      cancelled = true;
    };
    // só na montagem: o padrão salvo não deve sobrescrever escolhas feitas depois
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = useCallback(
    (status: string) => matchesListStatus(status, state, finalStatuses),
    [state, finalStatuses],
  );

  const toggleStatus = useCallback((status: string) => setState((current) => toggleListStatus(current, status)), []);
  const setShowHistory = useCallback(
    (showHistory: boolean) => setState((current) => ({ ...current, showHistory })),
    [],
  );
  const reset = useCallback(() => setState(defaultListStatusFilter), []);

  const saveAsDefault = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await persistSavedFilter(pageKey, state);
      setHasSavedDefault(true);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar o filtro.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [pageKey, state]);

  const clearSavedDefault = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await persistSavedFilter(pageKey, null);
      setHasSavedDefault(false);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível remover o filtro.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [pageKey]);

  return useMemo(
    () => ({
      state,
      matches,
      isCustom: isListStatusFilterCustom(state),
      toggleStatus,
      setShowHistory,
      reset,
      saveAsDefault,
      clearSavedDefault,
      hasSavedDefault,
      saving,
      saveError,
    }),
    [state, matches, toggleStatus, setShowHistory, reset, saveAsDefault, clearSavedDefault, hasSavedDefault, saving, saveError],
  );
}

export type ListStatusFilterControl = ReturnType<typeof useListStatusFilter>;
