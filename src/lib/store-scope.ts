type StoreLike = {
  id: string;
};

export function resolveAvailableStores<TStore extends StoreLike>(
  stores: TStore[],
  allowedStoreIds?: string[],
) {
  if (!allowedStoreIds || allowedStoreIds.length === 0) {
    return stores;
  }

  return stores.filter((store) => allowedStoreIds.includes(store.id));
}

export function buildStoreScopeStorageKey<TStore extends StoreLike>(stores: TStore[]) {
  return `xpan.store-scope.${[...stores.map((store) => store.id)].sort().join(".") || "default"}`;
}

export function resolveActiveStoreId<TStore extends StoreLike>(
  stores: TStore[],
  preferredStoreId: string,
  persistedStoreId?: string | null,
) {
  if (stores.length === 0) {
    return "";
  }

  if (stores.some((store) => store.id === preferredStoreId)) {
    return preferredStoreId;
  }

  if (persistedStoreId && stores.some((store) => store.id === persistedStoreId)) {
    return persistedStoreId;
  }

  return stores[0]?.id ?? "";
}
