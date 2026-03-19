"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type StoreUserCandidate = {
  id: string;
  name: string;
  email: string;
  status: "ativo" | "inativo";
};

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function useStoreUserCandidates() {
  const [users, setUsers] = useState<StoreUserCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<StoreUserCandidate[]>("/api/master-data/store-users");
      setUsers(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar usuários de loja");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({ users, isLoading, error, refresh }),
    [error, isLoading, refresh, users],
  );
}
