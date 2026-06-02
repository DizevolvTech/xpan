"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildClientTenantCacheKey } from "@/lib/client-access-context";
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

export type ReleaseBlockReason =
  | "order_cancelled"
  | "order_not_planned"
  | "order_not_releasable";

export class ReleaseOrderBlockedError extends Error {
  readonly reason: ReleaseBlockReason;
  readonly forceable: boolean;

  constructor(message: string, reason: ReleaseBlockReason, forceable: boolean) {
    super(message);
    this.name = "ReleaseOrderBlockedError";
    this.reason = reason;
    this.forceable = forceable;
  }
}

type ApiErrorBody = {
  message?: string;
  reason?: ReleaseBlockReason;
  forceable?: boolean;
};

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    if (response.status === 400 && body?.reason) {
      throw new ReleaseOrderBlockedError(
        body.message ?? "Liberação bloqueada",
        body.reason,
        body.forceable ?? body.reason !== "order_cancelled",
      );
    }
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

function buildFactoryPlanningCacheKey(referenceDate: string) {
  return buildClientTenantCacheKey("factory-planning", referenceDate);
}

function getFactoryPlanningCacheEntry(cacheKey: string) {
  return factoryPlanningCache.get(cacheKey) ?? null;
}

function isFactoryPlanningCacheFresh(entry: FactoryPlanningCacheEntry) {
  return Date.now() - entry.fetchedAt < FACTORY_PLANNING_CLIENT_CACHE_TTL_MS;
}

async function fetchFactoryPlanningSnapshot(referenceDate: string, forceRefresh: boolean) {
  const cacheKey = buildFactoryPlanningCacheKey(referenceDate);
  const cachedEntry = getFactoryPlanningCacheEntry(cacheKey);

  if (!forceRefresh && cachedEntry && isFactoryPlanningCacheFresh(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = factoryPlanningInflight.get(cacheKey);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = readJson<FactoryPlanningData>(`/api/factory-planning?referenceDate=${referenceDate}`)
    .then((data) => {
      factoryPlanningCache.set(cacheKey, {
        data,
        fetchedAt: Date.now(),
      });
      return data;
    })
    .finally(() => {
      factoryPlanningInflight.delete(cacheKey);
    });

  factoryPlanningInflight.set(cacheKey, request);
  return request;
}

export function useFactoryPlanningSnapshot(referenceDate: string) {
  const cacheKey = buildFactoryPlanningCacheKey(referenceDate);
  const cachedEntry = getFactoryPlanningCacheEntry(cacheKey);
  const [planningData, setPlanningData] = useState<FactoryPlanningData>(
    cachedEntry?.data ?? {
      ...emptyPlanningData,
      referenceDate,
    },
  );
  const [isLoading, setIsLoading] = useState(!cachedEntry);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (forceRefresh = true) => {
    const previousCacheEntry = getFactoryPlanningCacheEntry(cacheKey);
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
  }, [cacheKey, referenceDate]);

  useEffect(() => {
    void refresh(false).catch(() => undefined);
  }, [refresh]);

  const releaseOrder = useCallback(
    async (orderId: string, options: { force?: boolean } = {}) => {
      await readJson("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release-order",
          orderId,
          force: options.force === true,
          // AJ-A1 fix: passar referenceDate evita que a validação rode contra
          // hoje quando o gestor está olhando outra data.
          referenceDate,
        }),
      });
      await refresh();
    },
    [refresh, referenceDate],
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

  const completeProductionBatch = useCallback(
    async (productionItemKey: string, batchCount: number) => {
      await readJson("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-production-batch", productionItemKey, batchCount }),
      });
      await refresh();
    },
    [refresh],
  );

  const undoProductionBatch = useCallback(
    async (productionItemKey: string) => {
      await readJson("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo-production-batch", productionItemKey }),
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
      completeProductionBatch,
      undoProductionBatch,
    }),
    [
      cancelOrder,
      completeProductionBatch,
      error,
      isLoading,
      planningData,
      refresh,
      releaseOrder,
      reopenOrder,
      undoProductionBatch,
      updateProductionItemStatus,
    ],
  );
}
