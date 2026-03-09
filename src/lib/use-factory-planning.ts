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

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export function useFactoryPlanningSnapshot(referenceDate: string) {
  const [planningData, setPlanningData] = useState<FactoryPlanningData>(emptyPlanningData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<FactoryPlanningData>(`/api/factory-planning?referenceDate=${referenceDate}`);
      setPlanningData(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar planejamento");
      setPlanningData({
        ...emptyPlanningData,
        referenceDate,
      });
    } finally {
      setIsLoading(false);
    }
  }, [referenceDate]);

  useEffect(() => {
    void refresh();
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
      updateProductionItemStatus,
    }),
    [error, isLoading, planningData, refresh, releaseOrder, updateProductionItemStatus],
  );
}
