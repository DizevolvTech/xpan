"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildClientTenantCacheKey } from "@/lib/client-access-context";
import type { MasterDataSnapshot } from "@/lib/supabase-data/master-data";

const emptySnapshot: MasterDataSnapshot = {
  operationalSettings: {
    orderCutoffTime: "18:00",
    expeditionLeadDays: 0,
    saleLeadDays: 1,
  },
  sectors: [],
  lines: [],
  ingredients: [],
  stores: [],
  products: [],
  schedules: [],
};

const MASTER_DATA_CLIENT_CACHE_TTL_MS = 15_000;
type MasterDataCacheEntry = {
  data: MasterDataSnapshot;
  fetchedAt: number;
};

const masterDataCache = new Map<string, MasterDataCacheEntry>();
const masterDataInflight = new Map<string, Promise<MasterDataSnapshot>>();

function getMasterDataCacheKey() {
  return buildClientTenantCacheKey("master-data");
}

function getMasterDataCacheEntry(cacheKey = getMasterDataCacheKey()) {
  return masterDataCache.get(cacheKey) ?? null;
}

function isMasterDataCacheFresh(entry: MasterDataCacheEntry) {
  return Date.now() - entry.fetchedAt < MASTER_DATA_CLIENT_CACHE_TTL_MS;
}

async function fetchMasterDataSnapshot(forceRefresh: boolean) {
  const cacheKey = getMasterDataCacheKey();
  const cachedEntry = getMasterDataCacheEntry(cacheKey);

  if (!forceRefresh && cachedEntry && isMasterDataCacheFresh(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = masterDataInflight.get(cacheKey);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = fetch("/api/master-data")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Falha ao carregar dados mestres");
      }

      const data = (await response.json()) as MasterDataSnapshot;
      masterDataCache.set(cacheKey, {
        data,
        fetchedAt: Date.now(),
      });
      return data;
    })
    .finally(() => {
      masterDataInflight.delete(cacheKey);
    });

  masterDataInflight.set(cacheKey, request);
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
