const GTIN_PATTERN = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;

export function normalizeGtin(value: string | undefined | null): string {
  return (value ?? "").replace(/\D/g, "");
}

export function isValidGtin(value: string | undefined | null): boolean {
  const raw = (value ?? "").trim();
  if (raw.length === 0) {
    return true;
  }

  const digits = normalizeGtin(value);
  return GTIN_PATTERN.test(digits);
}

export function getProductDisplayCode(product: {
  code: string;
  externalCode?: string | null;
}): string {
  const storeCode = product.externalCode?.trim();
  return storeCode || product.code;
}
