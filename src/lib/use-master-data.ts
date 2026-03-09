"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { MasterDataSnapshot } from "@/lib/supabase-data/master-data";

const emptySnapshot: MasterDataSnapshot = {
  operationalSettings: {
    orderCutoffTime: "18:00",
    expeditionLeadDays: 0,
  },
  sectors: [],
  lines: [],
  ingredients: [],
  stores: [],
  products: [],
  schedules: [],
};

export function useMasterDataSnapshot() {
  const [snapshot, setSnapshot] = useState<MasterDataSnapshot>(emptySnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/master-data");
      if (!response.ok) {
        throw new Error("Falha ao carregar dados mestres");
      }

      const data = (await response.json()) as MasterDataSnapshot;
      setSnapshot(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar dados mestres");
      setSnapshot(emptySnapshot);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      snapshot,
      isLoading,
      error,
      refresh,
    }),
    [error, isLoading, refresh, snapshot],
  );
}
