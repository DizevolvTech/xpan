"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

function getFallbackStatus(): DeliveryExecutionStatus {
  return "aguardando_expedicao";
}

export function useDeliveryExecution(referenceDate: string) {
  const [executionState, setExecutionState] = useState<DeliveryExecutionState>({});
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadExecutionState() {
      try {
        const response = await fetch(`/api/delivery-executions?referenceDate=${referenceDate}`);
        if (!response.ok) {
          throw new Error("Falha ao carregar entregas");
        }

        const payload = (await response.json()) as DeliveryExecutionState;
        if (!cancelled) {
          setExecutionState(payload);
        }
      } catch {
        if (!cancelled) {
          setExecutionState({});
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
  }, [referenceDate]);

  const resolveExecution = useCallback(
    (orderId: string, expeditionReady: boolean): DeliveryExecutionEntry => {
      if (!expeditionReady) {
        return {
          status: "aguardando_expedicao",
          updatedAt: executionState[orderId]?.updatedAt ?? new Date().toISOString(),
        };
      }

      return (
        executionState[orderId] ?? {
          status: getFallbackStatus(),
          updatedAt: new Date().toISOString(),
        }
      );
    },
    [executionState],
  );

  const updateExecution = useCallback(
    async (orderId: string, status: DeliveryExecutionStatus) => {
      const updatedAt = new Date().toISOString();
      const previousEntry = executionState[orderId];

      setExecutionState((current) => ({
        ...current,
        [orderId]: {
          status,
          updatedAt,
        },
      }));

      const response = await fetch("/api/delivery-executions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          status,
        }),
      });

      if (!response.ok) {
        setExecutionState((current) => {
          if (!previousEntry) {
            const nextState = { ...current };
            delete nextState[orderId];
            return nextState;
          }

          return {
            ...current,
            [orderId]: previousEntry,
          };
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
