"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CreateMasterClientPayload,
  CreateMasterClientResult,
  MasterClient,
} from "@/lib/master-clients";

type EnterTenantContextResult = {
  tenant: MasterClient;
  redirectTo: string;
};

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function useMasterClients() {
  const [clients, setClients] = useState<MasterClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<MasterClient[]>("/api/master/clients");
      setClients(data);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Não foi possível carregar os clientes do SaaS.",
      );
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createClient = useCallback(
    async (payload: CreateMasterClientPayload) => {
      setIsSubmitting(true);

      try {
        const created = await readJson<CreateMasterClientResult>("/api/master/clients", {
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
    [refresh],
  );

  const enterTenantReadOnly = useCallback(async (tenantId: string) => {
    setIsSubmitting(true);

    try {
      return await readJson<EnterTenantContextResult>("/api/master/context/tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tenantId }),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const updateClientStatus = useCallback(
    async (tenantId: string, status: "ativo" | "inativo") => {
      setIsSubmitting(true);

      try {
        const updated = await readJson<MasterClient>(`/api/master/clients/${tenantId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        });
        await refresh();
        return updated;
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh],
  );

  return useMemo(
    () => ({
      clients,
      isLoading,
      isSubmitting,
      error,
      refresh,
      createClient,
      enterTenantReadOnly,
      updateClientStatus,
    }),
    [
      clients,
      createClient,
      enterTenantReadOnly,
      error,
      isLoading,
      isSubmitting,
      refresh,
      updateClientStatus,
    ],
  );
}
