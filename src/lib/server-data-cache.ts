import "server-only";

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
): Promise<T> {
  const now = Date.now();
  const cachedEntry = serverDataCache.get(key);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.value as T;
  }

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

export function invalidateMasterDataCaches() {
  invalidateServerDataCache(["master-data:", "planning:"]);
}

export function invalidatePlanningCaches() {
  invalidateServerDataCache("planning:");
}

export function invalidateDeliveryExecutionCaches() {
  invalidateServerDataCache("delivery-executions:");
}
