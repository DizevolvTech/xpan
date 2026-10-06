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

export type ProductCodeSource = "erp" | "gtin";

export const defaultProductCodeSource: ProductCodeSource = "erp";

export const productCodeSourceLabels: Record<ProductCodeSource, string> = {
  erp: "Código do ERP do cliente",
  gtin: "GTIN (código de barras)",
};

export function isProductCodeSource(value: unknown): value is ProductCodeSource {
  return value === "erp" || value === "gtin";
}

/** Valor desconhecido/ausente cai no padrão (ERP): nunca quebra tela nem muda cliente antigo. */
export function normalizeProductCodeSource(value: unknown): ProductCodeSource {
  return isProductCodeSource(value) ? value : defaultProductCodeSource;
}

type CodeCarrier = {
  code: string;
  externalCode?: string | null;
  gtin?: string | null;
  /** Já resolvido para o cliente no carregamento do cadastro (ver `resolveClientCode`). */
  displayCode?: string | null;
};

/**
 * Código que o CLIENTE reconhece, na ordem: o escolhido pelo cliente (ERP ou GTIN) → o do ERP →
 * o da fábrica. O da fábrica só aparece quando o cliente ainda não tem o dele.
 */
export function resolveClientCode(
  item: Pick<CodeCarrier, "code" | "externalCode" | "gtin">,
  source: ProductCodeSource = defaultProductCodeSource,
): string {
  const erp = item.externalCode?.trim();
  const gtin = item.gtin?.trim();
  const chosen = source === "gtin" ? gtin || erp : erp || gtin;
  return chosen || item.code;
}

/**
 * Código a mostrar em telas e impressões. Usa o `displayCode` que o carregamento do cadastro já
 * calculou com a escolha do cliente; sem ele (testes, dados antigos) aplica o padrão (ERP).
 */
export function getProductDisplayCode(product: CodeCarrier): string {
  const resolved = product.displayCode?.trim();
  return resolved || resolveClientCode(product);
}

/** Mesma regra para ingrediente/MPI. */
export function getIngredientDisplayCode(ingredient: CodeCarrier): string {
  return getProductDisplayCode(ingredient);
}

/**
 * O rótulo de cada linha da receita é gravado como "<código> · <nome>" no momento do cadastro,
 * com o código da fábrica. Na hora de mostrar/imprimir trocamos só o prefixo pelo código do
 * cliente (mantendo o resto do texto); rótulo sem esse prefixo fica como está.
 */
export function relabelRecipeLineWithClientCode(
  label: string,
  source: CodeCarrier | null | undefined,
): string {
  if (!source) {
    return label;
  }
  const displayCode = getProductDisplayCode(source);
  if (displayCode === source.code) {
    return label;
  }
  const prefix = `${source.code} · `;
  return label.startsWith(prefix) ? `${displayCode} · ${label.slice(prefix.length)}` : label;
}
