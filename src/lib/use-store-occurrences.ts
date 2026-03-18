"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type StoreOccurrence = {
  id: string;
  code: string;
  storeId: string;
  orderId: string;
  orderCode: string;
  orderItemId: string | null;
  productId: string | null;
  productName: string;
  problemType: string;
  quantityType: "percentual" | "kg" | "operacional";
  quantity: number;
  quantityUnit: string;
  description: string;
  status: "aberta" | "em_analise" | "resolvida" | "fechada";
  createdAt: string;
  updatedAt: string;
};

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function useStoreOccurrences(storeId?: string) {
  const [occurrences, setOccurrences] = useState<StoreOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
      const data = await readJson<StoreOccurrence[]>(`/api/store-occurrences${query}`);
      setOccurrences(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar ocorrencias");
      setOccurrences([]);
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createOccurrence = useCallback(
    async (payload: {
      orderId: string;
      orderItemId?: string | null;
      productId?: string | null;
      productNameSnapshot: string;
      problemType: string;
      quantityType: "percentual" | "kg" | "operacional";
      quantity: number;
      quantityUnitSnapshot: string;
      description: string;
    }) => {
      const createdOccurrence = await readJson<StoreOccurrence>("/api/store-occurrences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      await refresh();
      return createdOccurrence;
    },
    [refresh],
  );

  return useMemo(
    () => ({
      occurrences,
      isLoading,
      error,
      refresh,
      createOccurrence,
    }),
    [createOccurrence, error, isLoading, occurrences, refresh],
  );
}
