export type BusinessCodePrefix = "PD" | "OC";

export function getBusinessCodeScopeKey(dateIso: string) {
  return dateIso.slice(2, 10).replaceAll("-", "");
}

export function formatMonotonicBusinessCode(
  prefix: BusinessCodePrefix,
  sequenceValue: number,
  dateIso: string,
) {
  const normalizedSequence = Math.max(1, Math.trunc(sequenceValue));
  return `${prefix}-${getBusinessCodeScopeKey(dateIso)}-${String(normalizedSequence).padStart(4, "0")}`;
}

export function formatFallbackBusinessCode(
  prefix: BusinessCodePrefix,
  dateIso = new Date().toISOString(),
) {
  const compactDate = getBusinessCodeScopeKey(dateIso);
  const compactTime = dateIso.slice(11, 19).replaceAll(":", "");
  const randomSuffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `${prefix}-${compactDate}-${compactTime}-${randomSuffix}`;
}
