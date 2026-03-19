export function resolveAllowedStoreIds(storeIds?: string[]): string[] | null {
  const allowedStoreIds = storeIds?.filter(Boolean) ?? [];
  return allowedStoreIds.length > 0 ? allowedStoreIds : null;
}

export function hasStoreAccess(storeId: string, allowedStoreIds: string[] | null) {
  return allowedStoreIds === null ? true : allowedStoreIds.includes(storeId);
}
