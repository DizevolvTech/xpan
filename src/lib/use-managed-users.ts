"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ManagedUser,
  ManagedUserProfileInput,
  UserFormState,
} from "@/lib/admin-users";
import type { PermissionMap } from "@/lib/permission-modules";
import type { CreateManagedUserResult } from "@/lib/supabase-data/admin-users";

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function useManagedUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson<ManagedUser[]>("/api/admin/users");
      setUsers(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar usuários");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createUser = useCallback(async (payload: UserFormState) => {
    setIsSubmitting(true);
    try {
      const created = await readJson<CreateManagedUserResult>("/api/admin/users", {
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
  }, [refresh]);

  const updateUser = useCallback(
    async (
      userId: string,
      payload: UserFormState,
      resetPermissionsToRoleDefault = false,
    ) => {
      setIsSubmitting(true);
      try {
        await readJson<ManagedUser>(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "user",
            user: payload,
            resetPermissionsToRoleDefault,
          }),
        });
        await refresh();
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh],
  );

  const savePermissions = useCallback(
    async (userId: string, permissions: PermissionMap) => {
      setIsSubmitting(true);
      try {
        await readJson<ManagedUser>(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "permissions",
            permissions,
          }),
        });
        await refresh();
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh],
  );

  const saveProfile = useCallback(
    async (userId: string, profile: ManagedUserProfileInput) => {
      setIsSubmitting(true);
      try {
        await readJson<ManagedUser>(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "profile",
            profile,
          }),
        });
        await refresh();
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh],
  );

  return useMemo(
    () => ({
      users,
      isLoading,
      isSubmitting,
      error,
      refresh,
      createUser,
      updateUser,
      savePermissions,
      saveProfile,
    }),
    [createUser, error, isLoading, isSubmitting, refresh, savePermissions, saveProfile, updateUser, users],
  );
}
