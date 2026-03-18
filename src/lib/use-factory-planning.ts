"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { FactoryPlanningData, ProductionItemStatus } from "@/lib/order-planning";

const emptyPlanningData: FactoryPlanningData = {
  referenceDate: "",
  orders: [],
  orderItems: [],
  productionOrders: [],
  expedition: [],
  expeditionItems: [],
  productionDates: [],
  deliveryDates: [],
};

const FACTORY_PLANNING_CLIENT_CACHE_TTL_MS = 10_000;

type FactoryPlanningCacheEntry = {
  data: FactoryPlanningData;
  fetchedAt: number;
};

const factoryPlanningCache = new Map<string, FactoryPlanningCacheEntry>();
const factoryPlanningInflight = new Map<string, Promise<FactoryPlanningData>>();

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

function getFactoryPlanningCacheEntry(referenceDate: string) {
  return factoryPlanningCache.get(referenceDate) ?? null;
}

function isFactoryPlanningCacheFresh(entry: FactoryPlanningCacheEntry) {
  return Date.now() - entry.fetchedAt < FACTORY_PLANNING_CLIENT_CACHE_TTL_MS;
}

async function fetchFactoryPlanningSnapshot(referenceDate: string, forceRefresh: boolean) {
  const cachedEntry = getFactoryPlanningCacheEntry(referenceDate);

  if (!forceRefresh && cachedEntry && isFactoryPlanningCacheFresh(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = factoryPlanningInflight.get(referenceDate);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = readJson<FactoryPlanningData>(`/api/factory-planning?referenceDate=${referenceDate}`)
    .then((data) => {
      factoryPlanningCache.set(referenceDate, {
        data,
        fetchedAt: Date.now(),
      });
      return data;
    })
    .finally(() => {
      factoryPlanningInflight.delete(referenceDate);
    });

  factoryPlanningInflight.set(referenceDate, request);
  return request;
}

export function useFactoryPlanningSnapshot(referenceDate: string) {
  const cachedEntry = getFactoryPlanningCacheEntry(referenceDate);
  const [planningData, setPlanningData] = useState<FactoryPlanningData>(
    cachedEntry?.data ?? {
      ...emptyPlanningData,
      referenceDate,
    },
  );
  const [isLoading, setIsLoading] = useState(!cachedEntry);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (forceRefresh = true) => {
    const previousCacheEntry = getFactoryPlanningCacheEntry(referenceDate);
    setIsLoading(forceRefresh || !previousCacheEntry);
    setError(null);

    try {
      const data = await fetchFactoryPlanningSnapshot(referenceDate, forceRefresh);
      setPlanningData(data);
      return data;
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar planejamento");
      setPlanningData(
        previousCacheEntry?.data ?? {
          ...emptyPlanningData,
          referenceDate,
        },
      );
      throw fetchError;
    } finally {
      setIsLoading(false);
    }
  }, [referenceDate]);

  useEffect(() => {
    void refresh(false).catch(() => undefined);
  }, [refresh]);

  const releaseOrder = useCallback(
    async (orderId: string) => {
      await readJson("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release-order",
          orderId,
        }),
      });
      await refresh();
    },
    [refresh],
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      await readJson("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel-order",
          orderId,
        }),
      });
      await refresh();
    },
    [refresh],
  );

  const reopenOrder = useCallback(
    async (orderId: string) => {
      await readJson("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reopen-order",
          orderId,
        }),
      });
      await refresh();
    },
    [refresh],
  );

  const updateProductionItemStatus = useCallback(
    async (productionItemKey: string, status: ProductionItemStatus) => {
      await readJson("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-production-item-status",
          productionItemKey,
          status,
        }),
      });
      await refresh();
    },
    [refresh],
  );

  return useMemo(
    () => ({
      planningData,
      isLoading,
      error,
      refresh,
      releaseOrder,
      cancelOrder,
      reopenOrder,
      updateProductionItemStatus,
    }),
    [cancelOrder, error, isLoading, planningData, refresh, releaseOrder, reopenOrder, updateProductionItemStatus],
  );
}
