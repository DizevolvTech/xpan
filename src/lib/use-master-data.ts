"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { MasterDataSnapshot } from "@/lib/supabase-data/master-data";

const emptySnapshot: MasterDataSnapshot = {
  operationalSettings: {
    orderCutoffTime: "18:00",
    expeditionLeadDays: 0,
  },
  sectors: [],
  lines: [],
  ingredients: [],
  stores: [],
  products: [],
  schedules: [],
};

const MASTER_DATA_CLIENT_CACHE_TTL_MS = 15_000;
const MASTER_DATA_CACHE_KEY = "default";

type MasterDataCacheEntry = {
  data: MasterDataSnapshot;
  fetchedAt: number;
};

const masterDataCache = new Map<string, MasterDataCacheEntry>();
const masterDataInflight = new Map<string, Promise<MasterDataSnapshot>>();

function getMasterDataCacheEntry() {
  return masterDataCache.get(MASTER_DATA_CACHE_KEY) ?? null;
}

function isMasterDataCacheFresh(entry: MasterDataCacheEntry) {
  return Date.now() - entry.fetchedAt < MASTER_DATA_CLIENT_CACHE_TTL_MS;
}

async function fetchMasterDataSnapshot(forceRefresh: boolean) {
  const cachedEntry = getMasterDataCacheEntry();

  if (!forceRefresh && cachedEntry && isMasterDataCacheFresh(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = masterDataInflight.get(MASTER_DATA_CACHE_KEY);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = fetch("/api/master-data")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Falha ao carregar dados mestres");
      }

      const data = (await response.json()) as MasterDataSnapshot;
      masterDataCache.set(MASTER_DATA_CACHE_KEY, {
        data,
        fetchedAt: Date.now(),
      });
      return data;
    })
    .finally(() => {
      masterDataInflight.delete(MASTER_DATA_CACHE_KEY);
    });

  masterDataInflight.set(MASTER_DATA_CACHE_KEY, request);
  return request;
}

export function useMasterDataSnapshot() {
  const cachedEntry = getMasterDataCacheEntry();
  const [snapshot, setSnapshot] = useState<MasterDataSnapshot>(cachedEntry?.data ?? emptySnapshot);
  const [isLoading, setIsLoading] = useState(!cachedEntry);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (forceRefresh = true) => {
    const previousCacheEntry = getMasterDataCacheEntry();
    setIsLoading(forceRefresh || !previousCacheEntry);
    setError(null);

    try {
      const data = await fetchMasterDataSnapshot(forceRefresh);
      setSnapshot(data);
      return data;
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar dados mestres");
      setSnapshot(previousCacheEntry?.data ?? emptySnapshot);
      throw fetchError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false).catch(() => undefined);
  }, [refresh]);

  return useMemo(
    () => ({
      snapshot,
      isLoading,
      error,
      refresh,
    }),
    [error, isLoading, refresh, snapshot],
  );
}
