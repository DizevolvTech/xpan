"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { FactoryPlanningData, OrderStatus } from "@/lib/order-planning";

const ORDER_STATUS_STORAGE_PREFIX = "factory-order-status-overrides-v1";

const VALID_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "agendado",
  "em_producao",
  "em_espera",
  "rota_entrega",
]);

export const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "agendado", label: "Agendado" },
  { value: "em_producao", label: "Em Produção" },
  { value: "em_espera", label: "Em Espera" },
  { value: "rota_entrega", label: "Rota de Entrega" },
];

type OrderStatusOverrides = Record<string, OrderStatus>;
type OverridesByStorageKey = Record<string, OrderStatusOverrides>;

function isValidOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && VALID_ORDER_STATUSES.has(value as OrderStatus);
}

function parseOverrides(raw: string | null): OrderStatusOverrides {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).reduce<OrderStatusOverrides>((acc, [orderId, status]) => {
      if (isValidOrderStatus(status)) {
        acc[orderId] = status;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function readOverridesFromStorage(storageKey: string) {
  if (typeof window === "undefined") {
    return {};
  }
  return parseOverrides(window.localStorage.getItem(storageKey));
}

function hasKey(source: OverridesByStorageKey, storageKey: string) {
  return Object.prototype.hasOwnProperty.call(source, storageKey);
}

export function useFactoryOrderStatus(referenceDate: string) {
  const storageKey = `${ORDER_STATUS_STORAGE_PREFIX}:${referenceDate}`;
  const [overridesByKey, setOverridesByKey] = useState<OverridesByStorageKey>({});
  const hasInMemoryOverrides = hasKey(overridesByKey, storageKey);

  const overrides = useMemo(() => {
    if (hasInMemoryOverrides) {
      return overridesByKey[storageKey];
    }
    return readOverridesFromStorage(storageKey);
  }, [hasInMemoryOverrides, overridesByKey, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasInMemoryOverrides) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(overrides));
  }, [hasInMemoryOverrides, overrides, storageKey]);

  const resolveStatus = useCallback(
    (orderId: string, fallback: OrderStatus): OrderStatus => overrides[orderId] ?? fallback,
    [overrides],
  );

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOverridesByKey((current) => {
      const currentForKey = hasKey(current, storageKey)
        ? current[storageKey]
        : readOverridesFromStorage(storageKey);

      if (currentForKey[orderId] === status) {
        return current;
      }

      return {
        ...current,
        [storageKey]: {
          ...currentForKey,
          [orderId]: status,
        },
      };
    });
  }, [storageKey]);

  const clearOrderStatus = useCallback((orderId: string) => {
    setOverridesByKey((current) => {
      const currentForKey = hasKey(current, storageKey)
        ? current[storageKey]
        : readOverridesFromStorage(storageKey);

      if (!(orderId in currentForKey)) {
        return current;
      }

      const nextForKey = { ...currentForKey };
      delete nextForKey[orderId];

      return {
        ...current,
        [storageKey]: nextForKey,
      };
    });
  }, [storageKey]);

  return useMemo(
    () => ({
      resolveStatus,
      updateOrderStatus,
      clearOrderStatus,
      isHydrated: typeof window !== "undefined",
    }),
    [clearOrderStatus, resolveStatus, updateOrderStatus],
  );
}

export function applyFactoryOrderStatus(
  data: FactoryPlanningData,
  resolveStatus: (orderId: string, fallback: OrderStatus) => OrderStatus,
): FactoryPlanningData {
  const orders = data.orders.map((order) => ({
    ...order,
    status: resolveStatus(order.id, order.status),
  }));

  const orderByCode = new Map(orders.map((order) => [order.code, order]));

  const orderItems = data.orderItems.map((item) => ({
    ...item,
    status: resolveStatus(item.orderId, item.status),
  }));

  const expedition = data.expedition.map((row) => ({
    ...row,
    status: resolveStatus(row.orderId, row.status),
  }));

  const expeditionItems = data.expeditionItems.map((item) => ({
    ...item,
    status: resolveStatus(item.orderId, item.status),
  }));

  const productionOrders = data.productionOrders.map((op) => {
    const linkedStatuses = op.orderCodes
      .map((orderCode) => orderByCode.get(orderCode))
      .filter((order): order is NonNullable<typeof order> => Boolean(order))
      .map((order) => order.status);

    const hasSingleLinkedStatus =
      linkedStatuses.length > 0 && linkedStatuses.every((status) => status === linkedStatuses[0]);

    return {
      ...op,
      status: hasSingleLinkedStatus ? linkedStatuses[0] : op.status,
    };
  });

  return {
    ...data,
    orders,
    orderItems,
    expedition,
    expeditionItems,
    productionOrders,
  };
}
