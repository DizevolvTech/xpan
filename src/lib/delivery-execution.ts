"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canTransitionDeliveryStatus,
  type DeliveryChecklistState,
  type DeliveryExecutionStatus,
} from "@/lib/delivery-workflow";

export type { DeliveryChecklistState, DeliveryExecutionStatus } from "@/lib/delivery-workflow";

export type DeliveryExecutionEntry = {
  status: DeliveryExecutionStatus;
  checklistState: DeliveryChecklistState;
  checklistCompletedAt: string | null;
  updatedAt: string;
};

type DeliveryExecutionState = Record<string, DeliveryExecutionEntry>;
type DeliveryExecutionCacheEntry = {
  data: DeliveryExecutionState;
  fetchedAt: number;
};

const DELIVERY_EXECUTION_CLIENT_CACHE_TTL_MS = 10_000;
const DELIVERY_EXECUTION_CACHE_KEY = "all";
const deliveryExecutionCache = new Map<string, DeliveryExecutionCacheEntry>();
const deliveryExecutionInflight = new Map<string, Promise<DeliveryExecutionState>>();

function getFallbackStatus(): DeliveryExecutionStatus {
  return "aguardando_expedicao";
}

function getDeliveryExecutionCacheEntry() {
  return deliveryExecutionCache.get(DELIVERY_EXECUTION_CACHE_KEY) ?? null;
}

function isDeliveryExecutionCacheFresh(entry: DeliveryExecutionCacheEntry) {
  return Date.now() - entry.fetchedAt < DELIVERY_EXECUTION_CLIENT_CACHE_TTL_MS;
}

function setDeliveryExecutionCache(data: DeliveryExecutionState) {
  deliveryExecutionCache.set(DELIVERY_EXECUTION_CACHE_KEY, {
    data,
    fetchedAt: Date.now(),
  });
}

async function fetchDeliveryExecutionState(forceRefresh: boolean) {
  const cachedEntry = getDeliveryExecutionCacheEntry();

  if (!forceRefresh && cachedEntry && isDeliveryExecutionCacheFresh(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = deliveryExecutionInflight.get(DELIVERY_EXECUTION_CACHE_KEY);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = fetch("/api/delivery-executions")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Falha ao carregar entregas");
      }

      const payload = (await response.json()) as DeliveryExecutionState;
      setDeliveryExecutionCache(payload);
      return payload;
    })
    .finally(() => {
      deliveryExecutionInflight.delete(DELIVERY_EXECUTION_CACHE_KEY);
    });

  deliveryExecutionInflight.set(DELIVERY_EXECUTION_CACHE_KEY, request);
  return request;
}

export function useDeliveryExecution(_referenceDate?: string) {
  void _referenceDate;
  const cachedEntry = getDeliveryExecutionCacheEntry();
  const [executionState, setExecutionState] = useState<DeliveryExecutionState>(cachedEntry?.data ?? {});
  const [isHydrated, setIsHydrated] = useState(Boolean(cachedEntry));

  useEffect(() => {
    let cancelled = false;

    async function loadExecutionState() {
      const previousCacheEntry = getDeliveryExecutionCacheEntry();

      try {
        const payload = await fetchDeliveryExecutionState(false);
        if (!cancelled) {
          setExecutionState(payload);
        }
      } catch {
        if (!cancelled) {
          setExecutionState(previousCacheEntry?.data ?? {});
        }
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    }

    void loadExecutionState();

    return () => {
      cancelled = true;
    };
  }, []);

  const resolveExecution = useCallback(
    (orderId: string, expeditionReady: boolean): DeliveryExecutionEntry => {
      const persistedExecution = executionState[orderId];

      if (persistedExecution) {
        return persistedExecution;
      }

      if (!expeditionReady) {
        return {
          status: "aguardando_expedicao",
          checklistState: {},
          checklistCompletedAt: null,
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        status: getFallbackStatus(),
        checklistState: {},
        checklistCompletedAt: null,
        updatedAt: new Date().toISOString(),
      };
    },
    [executionState],
  );

  const updateExecution = useCallback(
    async (
      orderId: string,
      status: DeliveryExecutionStatus,
      options?: {
        checklistState?: DeliveryChecklistState;
        checklistCompletedAt?: string | null;
      },
    ) => {
      const updatedAt = new Date().toISOString();
      const previousEntry = executionState[orderId];
      const currentStatus = previousEntry?.status ?? "aguardando_expedicao";

      if (!canTransitionDeliveryStatus(currentStatus, status)) {
        throw new Error("Transição de entrega inválida");
      }

      const nextEntry: DeliveryExecutionEntry = {
        status,
        checklistState: options?.checklistState ?? previousEntry?.checklistState ?? {},
        checklistCompletedAt:
          options?.checklistCompletedAt ?? previousEntry?.checklistCompletedAt ?? null,
        updatedAt,
      };

      setExecutionState((current) => {
        const nextState = {
          ...current,
          [orderId]: nextEntry,
        };
        setDeliveryExecutionCache(nextState);
        return nextState;
      });

      const response = await fetch("/api/delivery-executions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          status,
          checklistState: options?.checklistState,
          checklistCompletedAt: options?.checklistCompletedAt,
        }),
      });

      if (!response.ok) {
        setExecutionState((current) => {
          if (!previousEntry) {
            const nextState = { ...current };
            delete nextState[orderId];
            setDeliveryExecutionCache(nextState);
            return nextState;
          }

          const nextState = {
            ...current,
            [orderId]: previousEntry,
          };
          setDeliveryExecutionCache(nextState);
          return nextState;
        });
        throw new Error("Falha ao atualizar entrega");
      }
    },
    [executionState],
  );

  return useMemo(
    () => ({ resolveExecution, updateExecution, isHydrated }),
    [isHydrated, resolveExecution, updateExecution],
  );
}
