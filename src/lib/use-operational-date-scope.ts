"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getTodayDateKey } from "@/lib/order-planning";
import {
  createDefaultOperationalDateScope,
  formatOperationalDateScopeSummary,
  normalizeOperationalDateScope,
  parseOperationalDateScopeFromSearchParams,
  resolveOperationalScopeAnchorDate,
  type OperationalDateScope,
  type OperationalDateScopeMode,
} from "@/lib/operational-date-scope";

const OPERATIONAL_SCOPE_STORAGE_KEY = "xpan:operational-date-scope:v1";

function readStoredOperationalDateScope(today: string) {
  if (typeof window === "undefined") {
    return createDefaultOperationalDateScope(today);
  }

  const searchParams = new URLSearchParams(window.location.search);
  const fromQuery = parseOperationalDateScopeFromSearchParams(searchParams, today);
  if (fromQuery) {
    return fromQuery;
  }

  const legacyReferenceDate = searchParams.get("ref");
  if (legacyReferenceDate) {
    return normalizeOperationalDateScope(
      {
        mode: "day",
        date: legacyReferenceDate,
        startDate: legacyReferenceDate,
        endDate: legacyReferenceDate,
      },
      today,
    );
  }

  const storedValue = window.localStorage.getItem(OPERATIONAL_SCOPE_STORAGE_KEY);
  if (!storedValue) {
    return createDefaultOperationalDateScope(today);
  }

  try {
    return normalizeOperationalDateScope(
      JSON.parse(storedValue) as Partial<OperationalDateScope>,
      today,
    );
  } catch {
    return createDefaultOperationalDateScope(today);
  }
}

function writeOperationalDateScopeToUrl(scope: OperationalDateScope) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (scope.mode === "all") {
    url.searchParams.delete("scope");
    url.searchParams.delete("date");
    url.searchParams.delete("start");
    url.searchParams.delete("end");
  } else if (scope.mode === "day") {
    url.searchParams.set("scope", "day");
    url.searchParams.set("date", scope.date);
    url.searchParams.delete("start");
    url.searchParams.delete("end");
  } else {
    url.searchParams.set("scope", "range");
    url.searchParams.set("start", scope.startDate);
    url.searchParams.set("end", scope.endDate);
    url.searchParams.delete("date");
  }

  const search = url.searchParams.toString();
  window.history.replaceState({}, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
}

export function useOperationalDateScope() {
  const [scope, setScope] = useState<OperationalDateScope>(() =>
    readStoredOperationalDateScope(getTodayDateKey()),
  );
  const today = getTodayDateKey();
  const anchorDate = useMemo(() => resolveOperationalScopeAnchorDate(scope, today), [scope, today]);
  const summary = useMemo(() => formatOperationalDateScopeSummary(scope), [scope]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(OPERATIONAL_SCOPE_STORAGE_KEY, JSON.stringify(scope));
    writeOperationalDateScopeToUrl(scope);
  }, [scope]);

  const setMode = useCallback((nextMode: OperationalDateScopeMode) => {
    setScope((current) => normalizeOperationalDateScope({ ...current, mode: nextMode }, today));
  }, [today]);

  const setDate = useCallback((nextDate: string) => {
    setScope((current) => normalizeOperationalDateScope({ ...current, date: nextDate }, today));
  }, [today]);

  const setStartDate = useCallback((nextDate: string) => {
    setScope((current) =>
      normalizeOperationalDateScope({ ...current, startDate: nextDate }, today),
    );
  }, [today]);

  const setEndDate = useCallback((nextDate: string) => {
    setScope((current) =>
      normalizeOperationalDateScope({ ...current, endDate: nextDate }, today),
    );
  }, [today]);

  return useMemo(
    () => ({
      scope,
      anchorDate,
      summary,
      setMode,
      setDate,
      setStartDate,
      setEndDate,
    }),
    [anchorDate, scope, setDate, setEndDate, setMode, setStartDate, summary],
  );
}
