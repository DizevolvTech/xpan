"use client";

import { buildTenantScopedKey } from "@/lib/tenant";

type ClientAccessContext = {
  tenantId: string | null;
  accessMode: string | null;
};

function readAppRoot() {
  if (typeof document === "undefined") {
    return null;
  }

  return document.querySelector<HTMLElement>("[data-app-tenant-id]");
}

export function readClientAccessContext(): ClientAccessContext {
  const root = readAppRoot();

  return {
    tenantId: root?.dataset.appTenantId || null,
    accessMode: root?.dataset.appAccessMode || null,
  };
}

export function buildClientTenantCacheKey(...parts: string[]) {
  const context = readClientAccessContext();
  return buildTenantScopedKey(["client", context.tenantId ?? "global", ...parts]);
}
