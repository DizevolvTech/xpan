"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CreateTenantSupportOccurrenceInput,
  TenantSupportOccurrence,
  TenantSupportOccurrenceDetail,
  TenantSupportOccurrenceStatus,
} from "@/lib/tenant-support-occurrences";

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function useTenantSupportOccurrences(basePath: string) {
  const [occurrences, setOccurrences] = useState<TenantSupportOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<TenantSupportOccurrence[]>(basePath);
      setOccurrences(data);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Falha ao carregar ocorrências do canal de atendimento.",
      );
      setOccurrences([]);
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createOccurrence = useCallback(
    async (payload: CreateTenantSupportOccurrenceInput) => {
      setIsSubmitting(true);
      try {
        const created = await readJson<TenantSupportOccurrenceDetail>(basePath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        await refresh();
        return created;
      } finally {
        setIsSubmitting(false);
      }
    },
    [basePath, refresh],
  );

  const fetchOccurrenceDetail = useCallback(
    async (occurrenceId: string) => {
      return readJson<TenantSupportOccurrenceDetail>(`${basePath}/${occurrenceId}`);
    },
    [basePath],
  );

  const updateOccurrenceStatus = useCallback(
    async (occurrenceId: string, status: TenantSupportOccurrenceStatus) => {
      setIsSubmitting(true);
      try {
        const updated = await readJson<TenantSupportOccurrenceDetail>(
          `${basePath}/${occurrenceId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status }),
          },
        );
        await refresh();
        return updated;
      } finally {
        setIsSubmitting(false);
      }
    },
    [basePath, refresh],
  );

  const addOccurrenceComment = useCallback(
    async (occurrenceId: string, content: string) => {
      setIsSubmitting(true);
      try {
        const updated = await readJson<TenantSupportOccurrenceDetail>(
          `${basePath}/${occurrenceId}/events`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content }),
          },
        );
        await refresh();
        return updated;
      } finally {
        setIsSubmitting(false);
      }
    },
    [basePath, refresh],
  );

  return useMemo(
    () => ({
      occurrences,
      isLoading,
      isSubmitting,
      error,
      refresh,
      createOccurrence,
      fetchOccurrenceDetail,
      updateOccurrenceStatus,
      addOccurrenceComment,
    }),
    [
      addOccurrenceComment,
      createOccurrence,
      error,
      fetchOccurrenceDetail,
      isLoading,
      isSubmitting,
      occurrences,
      refresh,
      updateOccurrenceStatus,
    ],
  );
}
