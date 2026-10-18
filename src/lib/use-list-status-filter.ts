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

const STORAGE_PREFIX = "xpan:list-status-filter:";

/**
 * Estado do filtro de status de uma lista (multi-seleção + Ver histórico) com "padrão da página"
 * salvo no navegador de quem usa. `initialStatus` (deep-link ?status=) vence o padrão salvo.
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
  const [state, setState] = useState<ListStatusFilterState>(() =>
    initialStatus && initialStatus !== "all"
      ? { selected: [initialStatus], showHistory: false }
      : defaultListStatusFilter,
  );
  const [hasSavedDefault, setHasSavedDefault] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + pageKey);
      setHasSavedDefault(raw != null);
      if (raw != null && !(initialStatus && initialStatus !== "all")) {
        setState(parseSavedListStatusFilter(raw, validStatuses));
      }
    } catch {
      // navegador sem storage: segue com o padrão de fábrica
    }
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

  const saveAsDefault = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + pageKey, serializeListStatusFilter(state));
      setHasSavedDefault(true);
    } catch {
      // sem storage: ignora
    }
  }, [pageKey, state]);

  const clearSavedDefault = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + pageKey);
    } catch {
      // ignora
    }
    setHasSavedDefault(false);
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
    }),
    [state, matches, toggleStatus, setShowHistory, reset, saveAsDefault, clearSavedDefault, hasSavedDefault],
  );
}

export type ListStatusFilterControl = ReturnType<typeof useListStatusFilter>;
