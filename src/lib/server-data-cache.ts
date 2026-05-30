import { buildTenantScopedKey } from "@/lib/tenant";

type ServerCacheEntry = {
  expiresAt: number;
  value: unknown;
};

declare global {
  var __xpanServerDataCache: Map<string, ServerCacheEntry> | undefined;
  var __xpanServerDataInflight: Map<string, Promise<unknown>> | undefined;
}

const serverDataCache = globalThis.__xpanServerDataCache ?? new Map<string, ServerCacheEntry>();
const serverDataInflight = globalThis.__xpanServerDataInflight ?? new Map<string, Promise<unknown>>();

globalThis.__xpanServerDataCache = serverDataCache;
globalThis.__xpanServerDataInflight = serverDataInflight;

export async function getCachedServerData<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options: { forceRefresh?: boolean } = {},
): Promise<T> {
  const now = Date.now();
  const cachedEntry = serverDataCache.get(key);

  // AJ-0024: caminhos de escrita (ex.: validar/salvar pedido) passam forceRefresh
  // para não validar contra um snapshot defasado (TTL de 10-15s) logo após o
  // cronograma virar ativo — era a causa do "1º salvamento com 0 itens".
  if (!options.forceRefresh && cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.value as T;
  }

  // Mesmo com forceRefresh, reaproveita uma carga já em andamento (mesma chave)
  // para não disparar leituras duplicadas concorrentes.
  const inflightRequest = serverDataInflight.get(key);
  if (inflightRequest) {
    return inflightRequest as Promise<T>;
  }

  const request = loader()
    .then((value) => {
      serverDataCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    })
    .finally(() => {
      serverDataInflight.delete(key);
    });

  serverDataInflight.set(key, request as Promise<unknown>);
  return request;
}

export function invalidateServerDataCache(prefixes: string | string[]) {
  const normalizedPrefixes = Array.isArray(prefixes) ? prefixes : [prefixes];

  for (const key of serverDataCache.keys()) {
    if (normalizedPrefixes.some((prefix) => key.startsWith(prefix))) {
      serverDataCache.delete(key);
    }
  }

  for (const key of serverDataInflight.keys()) {
    if (normalizedPrefixes.some((prefix) => key.startsWith(prefix))) {
      serverDataInflight.delete(key);
    }
  }
}

function invalidateServerDataCacheWhere(predicate: (key: string) => boolean) {
  for (const key of serverDataCache.keys()) {
    if (predicate(key)) {
      serverDataCache.delete(key);
    }
  }

  for (const key of serverDataInflight.keys()) {
    if (predicate(key)) {
      serverDataInflight.delete(key);
    }
  }
}

function keyMatchesTenantCacheSegment(key: string, segment: string) {
  return key.startsWith("tenant:") && (key.endsWith(`:${segment}`) || key.includes(`:${segment}:`));
}

function invalidateTenantCacheSegments(
  tenantId: string | null | undefined,
  segments: string[],
) {
  if (tenantId) {
    invalidateServerDataCache(
      segments.map((segment) => buildTenantScopedKey(["tenant", tenantId, segment])),
    );
    return;
  }

  invalidateServerDataCacheWhere((key) =>
    segments.some((segment) => keyMatchesTenantCacheSegment(key, segment)),
  );
}

export function invalidateMasterDataCaches(tenantId?: string | null) {
  invalidateTenantCacheSegments(tenantId, ["master-data", "planning"]);
}

export function invalidatePlanningCaches(tenantId?: string | null) {
  invalidateTenantCacheSegments(tenantId, ["planning"]);
}

export function invalidateDeliveryExecutionCaches(tenantId?: string | null) {
  invalidateTenantCacheSegments(tenantId, ["delivery-executions"]);
}
