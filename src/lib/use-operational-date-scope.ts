"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { buildClientTenantCacheKey } from "@/lib/client-access-context";
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

const OPERATIONAL_SCOPE_CHANGE_EVENT = "xpan:operational-date-scope:change";
let cachedClientSnapshot: { key: string; value: OperationalDateScope } | null = null;
let cachedServerSnapshot: { key: string; value: OperationalDateScope } | null = null;

function getOperationalScopeStorageKey() {
  return buildClientTenantCacheKey("operational-date-scope", "v1");
}

function buildOperationalDateScopeCacheKey(scope: OperationalDateScope) {
  return `${getOperationalScopeStorageKey()}|${scope.mode}|${scope.date}|${scope.startDate}|${scope.endDate}`;
}

function memoizeOperationalDateScopeSnapshot(
  scope: OperationalDateScope,
  target: "client" | "server",
) {
  const key = buildOperationalDateScopeCacheKey(scope);
  const cache = target === "client" ? cachedClientSnapshot : cachedServerSnapshot;

  if (cache?.key === key) {
    return cache.value;
  }

  const value = Object.freeze({ ...scope });
  const nextCache = { key, value };

  if (target === "client") {
    cachedClientSnapshot = nextCache;
  } else {
    cachedServerSnapshot = nextCache;
  }

  return value;
}

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

  const storedValue = window.localStorage.getItem(getOperationalScopeStorageKey());
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

function subscribeOperationalDateScope(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener("popstate", handleChange);
  window.addEventListener(OPERATIONAL_SCOPE_CHANGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("popstate", handleChange);
    window.removeEventListener(OPERATIONAL_SCOPE_CHANGE_EVENT, handleChange);
  };
}

function getOperationalDateScopeClientSnapshot() {
  return memoizeOperationalDateScopeSnapshot(
    readStoredOperationalDateScope(getTodayDateKey()),
    "client",
  );
}

function getOperationalDateScopeServerSnapshot() {
  return memoizeOperationalDateScopeSnapshot(
    createDefaultOperationalDateScope(getTodayDateKey()),
    "server",
  );
}

function persistOperationalDateScope(scope: OperationalDateScope) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getOperationalScopeStorageKey(), JSON.stringify(scope));
  writeOperationalDateScopeToUrl(scope);
  window.dispatchEvent(new Event(OPERATIONAL_SCOPE_CHANGE_EVENT));
}

export function useOperationalDateScope() {
  const today = getTodayDateKey();
  const scope = useSyncExternalStore(
    subscribeOperationalDateScope,
    getOperationalDateScopeClientSnapshot,
    getOperationalDateScopeServerSnapshot,
  );
  const anchorDate = useMemo(() => resolveOperationalScopeAnchorDate(scope, today), [scope, today]);
  const summary = useMemo(() => formatOperationalDateScopeSummary(scope), [scope]);

  const setMode = useCallback((nextMode: OperationalDateScopeMode) => {
    persistOperationalDateScope(
      normalizeOperationalDateScope({ ...scope, mode: nextMode }, today),
    );
  }, [scope, today]);

  const setDate = useCallback((nextDate: string) => {
    persistOperationalDateScope(
      normalizeOperationalDateScope({ ...scope, date: nextDate }, today),
    );
  }, [scope, today]);

  const setStartDate = useCallback((nextDate: string) => {
    persistOperationalDateScope(
      normalizeOperationalDateScope({ ...scope, startDate: nextDate }, today),
    );
  }, [scope, today]);

  const setEndDate = useCallback((nextDate: string) => {
    persistOperationalDateScope(
      normalizeOperationalDateScope({ ...scope, endDate: nextDate }, today),
    );
  }, [scope, today]);

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
