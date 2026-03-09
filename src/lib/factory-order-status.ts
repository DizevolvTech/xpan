"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildProductionOrdersFromPlannedItems, productionStageProgress } from "@/lib/order-planning";
import type {
  FactoryPlanningData,
  OrderStatus,
  PlannedOrderItem,
  PlannedOrderRow,
  ProductionItemStatus,
} from "@/lib/order-planning";

const WORKFLOW_STORAGE_PREFIX = "factory-workflow-state-v1";

const VALID_PRODUCTION_ITEM_STATUSES: ReadonlySet<ProductionItemStatus> = new Set([
  "nao_iniciado",
  "em_preparacao",
  "em_producao",
  "em_forno",
  "embalando",
  "concluido",
]);

export const PRODUCTION_ITEM_STATUS_OPTIONS: Array<{ value: ProductionItemStatus; label: string }> = [
  { value: "nao_iniciado", label: "Não iniciado" },
  { value: "em_preparacao", label: "Em preparação" },
  { value: "em_producao", label: "Em produção" },
  { value: "em_forno", label: "Em forno" },
  { value: "embalando", label: "Embalando" },
  { value: "concluido", label: "Concluído" },
];

type WorkflowState = {
  releasedOrders: string[];
  productionItemStatuses: Record<string, ProductionItemStatus>;
};

type WorkflowStateByStorageKey = Record<string, WorkflowState>;

const defaultWorkflowState: WorkflowState = {
  releasedOrders: [],
  productionItemStatuses: {},
};

function isValidProductionItemStatus(value: unknown): value is ProductionItemStatus {
  return typeof value === "string" && VALID_PRODUCTION_ITEM_STATUSES.has(value as ProductionItemStatus);
}

function parseWorkflowState(raw: string | null): WorkflowState {
  if (!raw) {
    return defaultWorkflowState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WorkflowState>;
    return {
      releasedOrders: Array.isArray(parsed.releasedOrders)
        ? parsed.releasedOrders.filter((value): value is string => typeof value === "string")
        : [],
      productionItemStatuses: Object.entries(parsed.productionItemStatuses ?? {}).reduce<Record<string, ProductionItemStatus>>(
        (acc, [key, status]) => {
          if (isValidProductionItemStatus(status)) {
            acc[key] = status;
          }
          return acc;
        },
        {},
      ),
    };
  } catch {
    return defaultWorkflowState;
  }
}

function hasKey<T extends object>(source: T, storageKey: string) {
  return Object.prototype.hasOwnProperty.call(source, storageKey);
}

function readWorkflowFromStorage(storageKey: string) {
  if (typeof window === "undefined") {
    return defaultWorkflowState;
  }
  return parseWorkflowState(window.localStorage.getItem(storageKey));
}

export function useFactoryWorkflowState(referenceDate: string) {
  const storageKey = `${WORKFLOW_STORAGE_PREFIX}:${referenceDate}`;
  const [workflowByKey, setWorkflowByKey] = useState<WorkflowStateByStorageKey>({});
  const hasInMemoryState = hasKey(workflowByKey, storageKey);

  const workflowState = useMemo(() => {
    if (hasInMemoryState) {
      return workflowByKey[storageKey];
    }
    return readWorkflowFromStorage(storageKey);
  }, [hasInMemoryState, storageKey, workflowByKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasInMemoryState) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(workflowState));
  }, [hasInMemoryState, storageKey, workflowState]);

  const isReleased = useCallback(
    (orderId: string) => workflowState.releasedOrders.includes(orderId),
    [workflowState.releasedOrders],
  );

  const releaseOrder = useCallback(
    (orderId: string) => {
      setWorkflowByKey((current) => {
        const currentForKey = hasKey(current, storageKey)
          ? current[storageKey]
          : readWorkflowFromStorage(storageKey);

        if (currentForKey.releasedOrders.includes(orderId)) {
          return current;
        }

        return {
          ...current,
          [storageKey]: {
            ...currentForKey,
            releasedOrders: [...currentForKey.releasedOrders, orderId],
          },
        };
      });
    },
    [storageKey],
  );

  const resolveProductionItemStatus = useCallback(
    (itemKey: string | null) => {
      if (!itemKey) {
        return null;
      }
      return workflowState.productionItemStatuses[itemKey] ?? "nao_iniciado";
    },
    [workflowState.productionItemStatuses],
  );

  const updateProductionItemStatus = useCallback(
    (itemKey: string, status: ProductionItemStatus) => {
      setWorkflowByKey((current) => {
        const currentForKey = hasKey(current, storageKey)
          ? current[storageKey]
          : readWorkflowFromStorage(storageKey);

        if (currentForKey.productionItemStatuses[itemKey] === status) {
          return current;
        }

        return {
          ...current,
          [storageKey]: {
            ...currentForKey,
            productionItemStatuses: {
              ...currentForKey.productionItemStatuses,
              [itemKey]: status,
            },
          },
        };
      });
    },
    [storageKey],
  );

  return useMemo(
    () => ({
      workflowState,
      isReleased,
      releaseOrder,
      resolveProductionItemStatus,
      updateProductionItemStatus,
      isHydrated: typeof window !== "undefined",
    }),
    [isReleased, releaseOrder, resolveProductionItemStatus, updateProductionItemStatus, workflowState],
  );
}

function getWorkflowOrderStatus(items: PlannedOrderItem[]): OrderStatus {
  if (items.length === 0) {
    return "em_espera";
  }
  if (items.every((item) => item.status === "aguardando_expedicao")) {
    return "aguardando_expedicao";
  }
  if (items.some((item) => item.status === "em_producao")) {
    return "em_producao";
  }
  if (items.some((item) => item.status === "agendado")) {
    return "agendado";
  }
  return "em_espera";
}

function getAverageProgress(items: Array<{ workflowProgress: number }>) {
  if (items.length === 0) {
    return 0;
  }
  return Number((items.reduce((sum, item) => sum + item.workflowProgress, 0) / items.length).toFixed(1));
}

function buildOrderProductionDateLabel(items: PlannedOrderItem[]) {
  const dates = Array.from(
    new Set(items.map((item) => item.productionDate).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b));

  if (dates.length === 0) {
    return "Sem agenda";
  }
  if (dates.length === 1) {
    const [year, month, day] = dates[0].split("-");
    return `${day}/${month}/${year}`;
  }

  const [startYear, startMonth, startDay] = dates[0].split("-");
  const [endYear, endMonth, endDay] = dates[dates.length - 1].split("-");
  return `${startDay}/${startMonth}/${startYear} a ${endDay}/${endMonth}/${endYear}`;
}

function buildOpsLabel(opCodes: string[]) {
  if (opCodes.length === 0) {
    return "-";
  }
  if (opCodes.length === 1) {
    return opCodes[0];
  }
  return `${opCodes[0]} +${opCodes.length - 1}`;
}

export function applyFactoryWorkflowState(
  data: FactoryPlanningData,
  workflow: {
    isReleased: (orderId: string) => boolean;
    resolveProductionItemStatus: (itemKey: string | null) => ProductionItemStatus | null;
  },
): FactoryPlanningData {
  const orderItems = data.orderItems.map((item) => {
    if (!item.canPlan) {
      return {
        ...item,
        releasedToProduction: false,
        productionItemStatus: null,
        workflowProgress: 0,
        opCode: null,
        status: "em_espera" as OrderStatus,
      };
    }

    const releasedToProduction = workflow.isReleased(item.orderId);
    if (!releasedToProduction) {
      return {
        ...item,
        releasedToProduction,
        productionItemStatus: "nao_iniciado" as ProductionItemStatus,
        workflowProgress: 0,
        opCode: null,
        status: "em_espera" as OrderStatus,
      };
    }

    const productionItemStatus = workflow.resolveProductionItemStatus(item.productionItemKey) ?? "nao_iniciado";
    const workflowProgress = productionStageProgress[productionItemStatus];
    const status: OrderStatus =
      productionItemStatus === "concluido"
        ? "aguardando_expedicao"
        : workflowProgress > 0
          ? "em_producao"
          : "agendado";

    return {
      ...item,
      releasedToProduction,
      productionItemStatus,
      workflowProgress,
      status,
    };
  });

  const releasedItems = orderItems.filter((item) => item.releasedToProduction);
  const { productionOrders, opsByOrderId, opCodeByPlanningKey } = buildProductionOrdersFromPlannedItems(
    releasedItems,
    data.referenceDate,
  );

  const orderItemsWithOpCodes = orderItems.map((item) => {
    const planningKey = item.productionDate
      ? [item.productionDate, item.sectorId, item.lineId, item.scheduleId ?? "sem-linha"].join("|")
      : null;
    return {
      ...item,
      opCode: planningKey ? opCodeByPlanningKey.get(planningKey) ?? null : null,
    };
  });

  const itemsByOrderId = orderItemsWithOpCodes.reduce<Map<string, PlannedOrderItem[]>>((acc, item) => {
    if (!acc.has(item.orderId)) {
      acc.set(item.orderId, []);
    }
    acc.get(item.orderId)!.push(item);
    return acc;
  }, new Map());

  const orders = data.orders.map<PlannedOrderRow>((order) => {
    const items = itemsByOrderId.get(order.id) ?? [];
    const opCodes = Array.from(opsByOrderId.get(order.id) ?? []).sort((a, b) => a.localeCompare(b));

    return {
      ...order,
      releasedToProduction: items.some((item) => item.releasedToProduction),
      availableForRelease: items.every((item) => item.availableForRelease) && items.length > 0,
      workflowProgress: getAverageProgress(items),
      productionDateLabel: buildOrderProductionDateLabel(items),
      opsLabel: buildOpsLabel(opCodes),
      status: getWorkflowOrderStatus(items),
    };
  });

  const orderById = new Map(orders.map((order) => [order.id, order]));
  const expedition = data.expedition.map((row) => {
    const order = orderById.get(row.orderId);
    const items = orderItemsWithOpCodes.filter((item) => item.orderId === row.orderId);
    return {
      ...row,
      releasedToProduction: order?.releasedToProduction ?? false,
      workflowProgress: order?.workflowProgress ?? 0,
      status: order?.status ?? "em_espera",
      items: row.items.map((item) => {
        const matching = items.find((candidate) => candidate.id === item.itemId);
        return {
          ...item,
          workflowProgress: matching?.workflowProgress ?? 0,
        };
      }),
    };
  });

  const expeditionItems = expedition.flatMap((row) =>
    row.items.map((item) => ({
      id: `${row.id}-${item.itemId}`,
      expeditionId: row.id,
      orderId: row.orderId,
      orderCode: row.orderCode,
      storeId: row.storeId,
      storeName: row.storeName,
      deliveryDate: row.deliveryDate,
      deliveryDateLabel: row.deliveryDateLabel,
      status: row.status,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      requestedQuantity: item.requestedQuantity,
      requestedUnit: item.requestedUnit,
      internalKg: item.internalKg,
      expeditionQuantityRaw: item.expeditionQuantityRaw,
      expeditionQuantity: item.expeditionQuantity,
      expeditionUnit: item.expeditionUnit,
    })),
  );

  return {
    ...data,
    orders,
    orderItems: orderItemsWithOpCodes,
    productionOrders,
    expedition,
    expeditionItems,
  };
}
