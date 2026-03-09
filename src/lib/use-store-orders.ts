"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  StoreOrderCatalogProduct,
  StoreOrderDetail,
  StoreOrderSummary,
} from "@/lib/store-order-types";

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function useStoreOrderSummaries(referenceDate: string) {
  const [orders, setOrders] = useState<StoreOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<StoreOrderSummary[]>(`/api/store-orders?referenceDate=${referenceDate}`);
      setOrders(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar pedidos");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [referenceDate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({ orders, isLoading, error, refresh }),
    [error, isLoading, orders, refresh],
  );
}

export function useStoreOrderDetail(orderId: string, referenceDate: string) {
  const [order, setOrder] = useState<StoreOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<StoreOrderDetail>(`/api/store-orders/${orderId}?referenceDate=${referenceDate}`);
      setOrder(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar pedido");
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, referenceDate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({ order, isLoading, error, refresh }),
    [error, isLoading, order, refresh],
  );
}

export function useStoreOrderCatalog() {
  const [catalog, setCatalog] = useState<StoreOrderCatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await readJson<StoreOrderCatalogProduct[]>("/api/store-order-catalog");
        if (!cancelled) {
          setCatalog(data);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar catalogo");
          setCatalog([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({ catalog, isLoading, error }),
    [catalog, error, isLoading],
  );
}

export function useCreateStoreOrder(onCreated?: () => void) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createOrder = useCallback(
    async (payload: {
      storeId: string;
      note?: string;
      orderedAt?: string;
      items: Array<{ productId: string; quantity: number; unit: string }>;
    }) => {
      setIsSubmitting(true);
      try {
        await readJson("/api/store-orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        onCreated?.();
      } finally {
        setIsSubmitting(false);
      }
    },
    [onCreated],
  );

  return useMemo(
    () => ({ createOrder, isSubmitting }),
    [createOrder, isSubmitting],
  );
}
