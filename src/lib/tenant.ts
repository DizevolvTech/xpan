import type { UserRole } from "@/lib/auth";

export type TenantStatus = "ativo" | "inativo";
export type AccessMode = "master" | "tenant" | "read-only-tenant";

export type TenantSummary = {
  id: string;
  legacyId: string | null;
  slug: string;
  name: string;
  /** CNPJ da rede, normalizado (14 posições, sem máscara, caixa alta).
   * Aceita numérico legado e alfanumérico — ver src/lib/cnpj.ts. */
  cnpj?: string | null;
  status: TenantStatus;
  logoUrl?: string | null;
};

export const MASTER_TENANT_COOKIE_NAME = "da_master_tenant";

export function isMasterRole(role: UserRole) {
  return role === "administrador-master";
}

export function canWriteInAccessMode(accessMode: AccessMode) {
  return accessMode !== "read-only-tenant";
}

export function getTenantIdentifier(tenant: Pick<TenantSummary, "id" | "legacyId" | "slug">) {
  return tenant.legacyId ?? tenant.slug ?? tenant.id;
}

export function buildTenantScopedKey(parts: Array<string | null | undefined>) {
  return parts.filter((part) => typeof part === "string" && part.length > 0).join(":");
}

export function slugifyTenantName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
