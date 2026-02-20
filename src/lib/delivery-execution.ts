"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { OrderStatus } from "@/lib/order-planning";

export type DeliveryExecutionStatus =
  | "aguardando_expedicao"
  | "pronto_coleta"
  | "em_rota"
  | "no_destino"
  | "entregue"
  | "tentativa_falha";

type DeliveryExecutionEntry = {
  status: DeliveryExecutionStatus;
  updatedAt: string;
};

type DeliveryExecutionState = Record<string, DeliveryExecutionEntry>;
type StateByStorageKey = Record<string, DeliveryExecutionState>;

const DELIVERY_EXECUTION_STORAGE_PREFIX = "factory-delivery-execution-v1";

const VALID_EXECUTION_STATUSES: ReadonlySet<DeliveryExecutionStatus> = new Set([
  "aguardando_expedicao",
  "pronto_coleta",
  "em_rota",
  "no_destino",
  "entregue",
  "tentativa_falha",
]);

function hasKey(source: StateByStorageKey, storageKey: string) {
  return Object.prototype.hasOwnProperty.call(source, storageKey);
}

function isExecutionStatus(value: unknown): value is DeliveryExecutionStatus {
  return typeof value === "string" && VALID_EXECUTION_STATUSES.has(value as DeliveryExecutionStatus);
}

function parseState(raw: string | null): DeliveryExecutionState {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return Object.entries(parsed).reduce<DeliveryExecutionState>((acc, [orderId, entry]) => {
      if (!entry || typeof entry !== "object") {
        return acc;
      }

      const entryRecord = entry as Record<string, unknown>;
      if (!isExecutionStatus(entryRecord.status)) {
        return acc;
      }

      const updatedAt = typeof entryRecord.updatedAt === "string" ? entryRecord.updatedAt : new Date().toISOString();

      acc[orderId] = {
        status: entryRecord.status,
        updatedAt,
      };

      return acc;
    }, {});
  } catch {
    return {};
  }
}

function readStateFromStorage(storageKey: string) {
  if (typeof window === "undefined") {
    return {};
  }

  return parseState(window.localStorage.getItem(storageKey));
}

function getFallbackStatus(orderStatus: OrderStatus): DeliveryExecutionStatus {
  return orderStatus === "rota_entrega" ? "pronto_coleta" : "aguardando_expedicao";
}

export function useDeliveryExecution(referenceDate: string) {
  const storageKey = `${DELIVERY_EXECUTION_STORAGE_PREFIX}:${referenceDate}`;
  const [stateByKey, setStateByKey] = useState<StateByStorageKey>({});
  const hasInMemoryState = hasKey(stateByKey, storageKey);

  const executionState = useMemo(() => {
    if (hasInMemoryState) {
      return stateByKey[storageKey];
    }
    return readStateFromStorage(storageKey);
  }, [hasInMemoryState, stateByKey, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasInMemoryState) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(executionState));
  }, [executionState, hasInMemoryState, storageKey]);

  const resolveExecution = useCallback(
    (orderId: string, orderStatus: OrderStatus): DeliveryExecutionEntry => {
      return (
        executionState[orderId] ?? {
          status: getFallbackStatus(orderStatus),
          updatedAt: new Date().toISOString(),
        }
      );
    },
    [executionState],
  );

  const updateExecution = useCallback(
    (orderId: string, status: DeliveryExecutionStatus) => {
      setStateByKey((current) => {
        const currentForKey = hasKey(current, storageKey) ? current[storageKey] : readStateFromStorage(storageKey);
        const currentEntry = currentForKey[orderId];

        if (currentEntry?.status === status) {
          return current;
        }

        return {
          ...current,
          [storageKey]: {
            ...currentForKey,
            [orderId]: {
              status,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },
    [storageKey],
  );

  return useMemo(
    () => ({ resolveExecution, updateExecution }),
    [resolveExecution, updateExecution],
  );
}
