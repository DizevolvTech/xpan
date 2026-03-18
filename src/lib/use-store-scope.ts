"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildStoreScopeStorageKey,
  resolveActiveStoreId,
  resolveAvailableStores,
} from "@/lib/store-scope";

type StoreLike = {
  id: string;
  name: string;
};

export function useStoreScope<TStore extends StoreLike>(
  stores: TStore[],
  allowedStoreIds?: string[],
) {
  const availableStores = useMemo(
    () => resolveAvailableStores(stores, allowedStoreIds),
    [allowedStoreIds, stores],
  );
  const storageKey = useMemo(
    () => buildStoreScopeStorageKey(availableStores),
    [availableStores],
  );
  const [preferredStoreId, setPreferredStoreIdState] = useState("");
  const activeStoreId = useMemo(() => {
    const persisted =
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    return resolveActiveStoreId(availableStores, preferredStoreId, persisted);
  }, [availableStores, preferredStoreId, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeStoreId) {
      return;
    }

    window.localStorage.setItem(storageKey, activeStoreId);
  }, [activeStoreId, storageKey]);

  const setActiveStoreId = useCallback(
    (nextStoreId: string) => {
      if (!availableStores.some((store) => store.id === nextStoreId)) {
        return;
      }
      setPreferredStoreIdState(nextStoreId);
    },
    [availableStores],
  );

  return useMemo(
    () => ({
      availableStores,
      activeStoreId,
      activeStore: availableStores.find((store) => store.id === activeStoreId) ?? null,
      setActiveStoreId,
      shouldShowStoreSelector: availableStores.length > 1,
    }),
    [activeStoreId, availableStores, setActiveStoreId],
  );
}
