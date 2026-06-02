"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canTransitionDeliveryStatus,
  type DeliveryChecklistState,
  type DeliveryExecutionStatus,
} from "@/lib/delivery-workflow";
import { buildClientTenantCacheKey } from "@/lib/client-access-context";

export type { DeliveryChecklistState, DeliveryExecutionStatus } from "@/lib/delivery-workflow";

export type DeliveryFailureReason =
  | "cliente_ausente"
  | "endereco_errado"
  | "recusa_cliente"
  | "estabelecimento_fechado"
  | "veiculo_avaria"
  | "acesso_bloqueado"
  | "documentacao_pendente"
  | "outro";

export type DeliveryAttemptInfo = {
  attemptNumber: number;
  failedAt: string;
  failureReason: DeliveryFailureReason;
  reasonNotes: string | null;
  rescheduleTo: string | null;
};

export type DeliveryExecutionEntry = {
  status: DeliveryExecutionStatus;
  checklistState: DeliveryChecklistState;
  checklistCompletedAt: string | null;
  updatedAt: string;
  attemptsCount: number;
  lastAttempt: DeliveryAttemptInfo | null;
  pendingReleaseReason: string | null;
  pendingReleasedAt: string | null;
};

type DeliveryExecutionState = Record<string, DeliveryExecutionEntry>;
type DeliveryExecutionCacheEntry = {
  data: DeliveryExecutionState;
  fetchedAt: number;
};

const DELIVERY_EXECUTION_CLIENT_CACHE_TTL_MS = 10_000;
const deliveryExecutionCache = new Map<string, DeliveryExecutionCacheEntry>();
const deliveryExecutionInflight = new Map<string, Promise<DeliveryExecutionState>>();

function getFallbackStatus(): DeliveryExecutionStatus {
  return "aguardando_expedicao";
}

function getDeliveryExecutionCacheKey() {
  return buildClientTenantCacheKey("delivery-executions", "all");
}

function getDeliveryExecutionCacheEntry(cacheKey = getDeliveryExecutionCacheKey()) {
  return deliveryExecutionCache.get(cacheKey) ?? null;
}

function isDeliveryExecutionCacheFresh(entry: DeliveryExecutionCacheEntry) {
  return Date.now() - entry.fetchedAt < DELIVERY_EXECUTION_CLIENT_CACHE_TTL_MS;
}

function setDeliveryExecutionCache(data: DeliveryExecutionState, cacheKey = getDeliveryExecutionCacheKey()) {
  deliveryExecutionCache.set(cacheKey, {
    data,
    fetchedAt: Date.now(),
  });
}

async function fetchDeliveryExecutionState(forceRefresh: boolean) {
  const cacheKey = getDeliveryExecutionCacheKey();
  const cachedEntry = getDeliveryExecutionCacheEntry(cacheKey);

  if (!forceRefresh && cachedEntry && isDeliveryExecutionCacheFresh(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = deliveryExecutionInflight.get(cacheKey);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = fetch("/api/delivery-executions")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Falha ao carregar entregas");
      }

      const payload = (await response.json()) as DeliveryExecutionState;
      setDeliveryExecutionCache(payload, cacheKey);
      return payload;
    })
    .finally(() => {
      deliveryExecutionInflight.delete(cacheKey);
    });

  deliveryExecutionInflight.set(cacheKey, request);
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

      if (persistedExecution && expeditionReady) {
        return persistedExecution;
      }

      if (!expeditionReady) {
        return {
          status: "aguardando_expedicao",
          checklistState: {},
          checklistCompletedAt: null,
          updatedAt: new Date().toISOString(),
          attemptsCount: 0,
          lastAttempt: null,
          pendingReleaseReason: null,
          pendingReleasedAt: null,
        };
      }

      return {
        status: getFallbackStatus(),
        checklistState: {},
        checklistCompletedAt: null,
        updatedAt: new Date().toISOString(),
        attemptsCount: 0,
        lastAttempt: null,
        pendingReleaseReason: null,
        pendingReleasedAt: null,
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
        force?: boolean;
        releaseReason?: string | null;
      },
    ) => {
      const updatedAt = new Date().toISOString();
      const previousEntry = executionState[orderId];
      const currentStatus = previousEntry?.status ?? "aguardando_expedicao";

      if (!canTransitionDeliveryStatus(currentStatus, status)) {
        throw new Error("Transição de entrega inválida");
      }

      const forcedReleaseReason = options?.force
        ? options.releaseReason?.trim() ?? null
        : null;
      const nextEntry: DeliveryExecutionEntry = {
        status,
        checklistState: options?.checklistState ?? previousEntry?.checklistState ?? {},
        checklistCompletedAt:
          options?.checklistCompletedAt ?? previousEntry?.checklistCompletedAt ?? null,
        updatedAt,
        attemptsCount: previousEntry?.attemptsCount ?? 0,
        lastAttempt: previousEntry?.lastAttempt ?? null,
        pendingReleaseReason: forcedReleaseReason ?? previousEntry?.pendingReleaseReason ?? null,
        pendingReleasedAt: forcedReleaseReason ? updatedAt : previousEntry?.pendingReleasedAt ?? null,
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
          force: options?.force,
          releaseReason: options?.force ? options.releaseReason : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
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
        throw new Error(payload?.message ?? "Falha ao atualizar entrega");
      }
    },
    [executionState],
  );

  const registerAttempt = useCallback(
    async (
      orderId: string,
      input: {
        reason: DeliveryFailureReason;
        notes?: string | null;
        rescheduleTo?: string | null;
      },
    ) => {
      const response = await fetch("/api/delivery-executions/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason: input.reason,
          notes: input.notes ?? null,
          rescheduleTo: input.rescheduleTo ?? null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Falha ao registrar tentativa de entrega");
      }

      // Recarrega o estado a partir do servidor (cache invalidado server-side
      // pelo endpoint) para refletir attemptsCount + lastAttempt atualizados.
      const refreshed = await fetchDeliveryExecutionState(true);
      setExecutionState(refreshed);
    },
    [],
  );

  return useMemo(
    () => ({ resolveExecution, updateExecution, registerAttempt, isHydrated }),
    [isHydrated, registerAttempt, resolveExecution, updateExecution],
  );
}
