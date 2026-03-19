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

type StoreOrdersCacheEntry = {
  data: StoreOrderSummary[];
  fetchedAt: number;
};

const STORE_ORDERS_CACHE_TTL_MS = 10_000;
const storeOrdersCache = new Map<string, StoreOrdersCacheEntry>();
const storeOrdersInflight = new Map<string, Promise<StoreOrderSummary[]>>();

function getStoreOrdersCacheEntry(referenceDate: string) {
  return storeOrdersCache.get(referenceDate) ?? null;
}

function isStoreOrdersCacheFresh(entry: StoreOrdersCacheEntry) {
  return Date.now() - entry.fetchedAt < STORE_ORDERS_CACHE_TTL_MS;
}

async function fetchStoreOrderSummaries(referenceDate: string, forceRefresh: boolean) {
  const cachedEntry = getStoreOrdersCacheEntry(referenceDate);

  if (!forceRefresh && cachedEntry && isStoreOrdersCacheFresh(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = storeOrdersInflight.get(referenceDate);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = readJson<StoreOrderSummary[]>(`/api/store-orders?referenceDate=${referenceDate}`)
    .then((data) => {
      storeOrdersCache.set(referenceDate, {
        data,
        fetchedAt: Date.now(),
      });
      return data;
    })
    .finally(() => {
      storeOrdersInflight.delete(referenceDate);
    });

  storeOrdersInflight.set(referenceDate, request);
  return request;
}

export function useStoreOrderSummaries(referenceDate: string) {
  const cachedEntry = getStoreOrdersCacheEntry(referenceDate);
  const [orders, setOrders] = useState<StoreOrderSummary[]>(cachedEntry?.data ?? []);
  const [isLoading, setIsLoading] = useState(!cachedEntry);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (forceRefresh = true) => {
    const previousCacheEntry = getStoreOrdersCacheEntry(referenceDate);
    setIsLoading(forceRefresh || !previousCacheEntry);
    setError(null);

    try {
      const data = await fetchStoreOrderSummaries(referenceDate, forceRefresh);
      setOrders(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar pedidos");
      setOrders(previousCacheEntry?.data ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [referenceDate]);

  useEffect(() => {
    void refresh(false);
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

export function useStoreOrderCatalog(storeId: string, orderedAt: string) {
  const [catalog, setCatalog] = useState<StoreOrderCatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (!storeId || !orderedAt) {
        setCatalog([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          storeId,
          orderedAt,
        });
        const data = await readJson<StoreOrderCatalogProduct[]>(`/api/store-order-catalog?${params.toString()}`);
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
  }, [orderedAt, storeId]);

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

export function useUpdateStoreOrder(onUpdated?: () => void) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateOrder = useCallback(
    async (
      orderId: string,
      payload: {
        note?: string;
        items: Array<{ productId: string; quantity: number; unit: string }>;
      },
    ) => {
      setIsSubmitting(true);
      try {
        await readJson(`/api/store-orders/${orderId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        onUpdated?.();
      } finally {
        setIsSubmitting(false);
      }
    },
    [onUpdated],
  );

  return useMemo(
    () => ({ updateOrder, isSubmitting }),
    [isSubmitting, updateOrder],
  );
}

export function useCancelStoreOrder(onCancelled?: () => void) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cancelOrder = useCallback(
    async (orderId: string) => {
      setIsSubmitting(true);
      try {
        await readJson(`/api/store-orders/${orderId}`, {
          method: "DELETE",
        });
        onCancelled?.();
      } finally {
        setIsSubmitting(false);
      }
    },
    [onCancelled],
  );

  return useMemo(
    () => ({ cancelOrder, isSubmitting }),
    [cancelOrder, isSubmitting],
  );
}
