"use client";

import { useEffect, useMemo, useState } from "react";

type CurrentProfile = {
  id: string;
  name: string;
  email: string;
  role: "administrador" | "gestor-dados" | "gestor-fabrica" | "chao-fabrica" | "loja";
  avatarUrl: string;
  phone: string;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  passwordUpdatedAt: string;
  allowedStoreIds: string[];
};

export function useCurrentProfile() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/me/profile");
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? "Falha ao carregar perfil atual");
        }

        const data = (await response.json()) as CurrentProfile;
        if (!cancelled) {
          setProfile(data);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar perfil atual");
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      profile,
      isLoading,
      error,
    }),
    [error, isLoading, profile],
  );
}
