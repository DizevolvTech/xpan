"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildClientTenantCacheKey } from "@/lib/client-access-context";
import type { FactoryPlanningData, OrderStatus, ProductionItemStatus } from "@/lib/order-planning";

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
  | "order_not_releasable"
  | "batch_stores_pending"
  // Trava de data futura: o servidor responde 400 + reason ao tentar concluir
  // produção (ou bater a última batida) em data futura. forceable=true só p/ gestor.
  | "production_in_future"
  // Trava de data futura na ENTREGA: marcar `entregue` antes da data de entrega.
  | "delivery_in_future";

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
  const result = (await response.json()) as T;
  // Reunião 22/10 (bloco 6): produção antecipada não trava; o servidor manda o aviso e a
  // tela mostra (ouvinte no provedor de avisos).
  const anticipatedMessage = (result as { anticipatedMessage?: unknown } | null)?.anticipatedMessage;
  if (typeof anticipatedMessage === "string" && anticipatedMessage && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WORKFLOW_NOTICE_EVENT, { detail: anticipatedMessage }));
  }
  return result;
}

export const WORKFLOW_NOTICE_EVENT = "xpan:workflow-notice";

function buildFactoryPlanningCacheKey(referenceDate: string) {
  return buildClientTenantCacheKey("factory-planning", referenceDate);
}

function getFactoryPlanningCacheEntry(cacheKey: string) {
  return factoryPlanningCache.get(cacheKey) ?? null;
}

function isFactoryPlanningCacheFresh(entry: FactoryPlanningCacheEntry) {
  return Date.now() - entry.fetchedAt < FACTORY_PLANNING_CLIENT_CACHE_TTL_MS;
}

async function fetchFactoryPlanningSnapshot(referenceDate: string, forceRefresh: boolean, bypassServerCache = false) {
  const cacheKey = buildFactoryPlanningCacheKey(referenceDate);
  const cachedEntry = getFactoryPlanningCacheEntry(cacheKey);

  if (!forceRefresh && cachedEntry && isFactoryPlanningCacheFresh(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = factoryPlanningInflight.get(cacheKey);
  if (inflightRequest) {
    return inflightRequest;
  }

  // Depois de uma mudança, `fresh=1` pula o cache curto do servidor: outra instância do
  // Worker pode ainda ter o retrato anterior e devolver o status antigo (cartão #20).
  const request = readJson<FactoryPlanningData>(
    `/api/factory-planning?referenceDate=${referenceDate}${bypassServerCache ? "&fresh=1" : ""}`,
  )
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

/** Cartão #18: dados que vieram junto com o HTML da página; a tela não busca de novo. */
export function seedFactoryPlanningSnapshot(referenceDate: string, data: FactoryPlanningData) {
  factoryPlanningCache.set(buildFactoryPlanningCacheKey(referenceDate), { data, fetchedAt: Date.now() });
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

  const refresh = useCallback(async (forceRefresh = true, bypassServerCache = false) => {
    const previousCacheEntry = getFactoryPlanningCacheEntry(cacheKey);
    setIsLoading(forceRefresh || !previousCacheEntry);
    setError(null);

    try {
      const data = await fetchFactoryPlanningSnapshot(referenceDate, forceRefresh, bypassServerCache);
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

  // Cartão #20: cancelar/reabrir muda a linha na hora (status otimista) e só depois
  // confirma no servidor; se o servidor recusar, a linha volta ao que era e o erro sobe
  // para a tela avisar. A releitura em seguida traz o estado oficial.
  const changeOrderManagement = useCallback(
    async (orderId: string, action: "cancel-order" | "reopen-order") => {
      const before = planningData;
      const optimisticStatus: OrderStatus = action === "cancel-order" ? "cancelado" : "em_espera";
      setPlanningData((current) => ({
        ...current,
        orderItems: current.orderItems.map((item) =>
          item.orderId === orderId ? { ...item, status: optimisticStatus } : item,
        ),
      }));
      try {
        await readJson("/api/factory-planning/workflow", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, orderId }),
        });
      } catch (mutationError) {
        setPlanningData(before);
        throw mutationError;
      }
      void refresh(true, true).catch(() => undefined);
    },
    [planningData, refresh],
  );

  const cancelOrder = useCallback(
    (orderId: string) => changeOrderManagement(orderId, "cancel-order"),
    [changeOrderManagement],
  );

  const reopenOrder = useCallback(
    (orderId: string) => changeOrderManagement(orderId, "reopen-order"),
    [changeOrderManagement],
  );

  const updateProductionItemStatus = useCallback(
    async (
      productionItemKey: string,
      status: ProductionItemStatus,
      options: { force?: boolean } = {},
    ) => {
      await readJson("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-production-item-status",
          productionItemKey,
          status,
          // Override da trava de data futura: o servidor pula a trava (ou devolve
          // 403 se o papel não puder). Mesmo estilo do releaseOrder acima.
          force: options.force === true,
        }),
      });
      await refresh();
    },
    [refresh],
  );

  const completeProductionBatch = useCallback(
    async (productionItemKey: string, batchCount: number, options: { force?: boolean } = {}) => {
      await readJson("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete-production-batch",
          productionItemKey,
          batchCount,
          // Override da trava de data futura (gestor/admin); servidor devolve 403 se não puder.
          force: options.force === true,
        }),
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

  // Avanço EM MASSA (chão): OP inteira ou coluna inteira em UMA requisição. Devolve o
  // resumo (avançados / bloqueados por data futura / falhas) para a UI dar feedback.
  const advanceProductionItems = useCallback(
    async (
      items: Array<{ productionItemKey: string; status: ProductionItemStatus }>,
      options: { force?: boolean } = {},
    ) => {
      const result = await readJson<{
        ok: boolean;
        advanced: number;
        blockedCount: number;
        forceable: boolean;
        failed: Array<{ productionItemKey: string; message: string }>;
      }>("/api/factory-planning/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "advance-production-items",
          items,
          force: options.force === true,
        }),
      });
      await refresh();
      return result;
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
      advanceProductionItems,
    }),
    [
      advanceProductionItems,
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
