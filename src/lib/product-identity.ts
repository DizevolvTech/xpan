export function normalizeGtin(value: string | undefined | null): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Dígito verificador GS1 do corpo (sem o verificador): pesos 3,1,3,1... da direita para a esquerda. */
export function computeGtinCheckDigit(body: string): number {
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[body.length - 1 - index]);
    sum += digit * (index % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

function hasValidCheckDigit(digits: string): boolean {
  return computeGtinCheckDigit(digits.slice(0, -1)) === Number(digits[digits.length - 1]);
}

export type GtinCheck =
  | { status: "empty"; gtin: "" }
  | { status: "valid"; gtin: string }
  | { status: "invalid"; gtin: string; suggestion: string | null };

/**
 * Cartão #230: só EAN-8 e EAN-13 com verificador GS1 correto. Entrada curta (menos de 13 dígitos e
 * diferente de 8) é completada com zeros à esquerda até 13 e conferida como código completo (com
 * verificador). Se não bater e a entrada tinha até 12 dígitos, sugere o código que resultaria de
 * tratar os dígitos como corpo sem verificador (ex.: 4256 → 0000000042567).
 */
export function checkGtin(value: string | undefined | null): GtinCheck {
  const digits = normalizeGtin(value);
  if (digits.length === 0) {
    return { status: "empty", gtin: "" };
  }
  if (digits.length === 8) {
    return hasValidCheckDigit(digits)
      ? { status: "valid", gtin: digits }
      : { status: "invalid", gtin: digits, suggestion: null };
  }
  if (digits.length > 13) {
    return { status: "invalid", gtin: digits, suggestion: null };
  }
  const padded = digits.padStart(13, "0");
  if (hasValidCheckDigit(padded)) {
    return { status: "valid", gtin: padded };
  }
  const body = digits.length <= 12 ? digits.padStart(12, "0") : null;
  return {
    status: "invalid",
    gtin: padded,
    suggestion: body ? `${body}${computeGtinCheckDigit(body)}` : null,
  };
}

/**
 * Vazio vale. Código já gravado (12 ou 14 dígitos, de antes da regra) continua aceito enquanto o
 * campo não for alterado: passe o valor gravado em `storedGtin`.
 */
export function isValidGtin(value: string | undefined | null, storedGtin?: string | null): boolean {
  const check = checkGtin(value);
  if (check.status !== "invalid") {
    return true;
  }
  const stored = normalizeGtin(storedGtin);
  return stored.length > 0 && stored === normalizeGtin(value);
}

/** Valor a gravar: código completo de 8/13 dígitos quando válido; legado inalterado fica como estava. */
export function canonicalGtin(value: string | undefined | null): string {
  const check = checkGtin(value);
  return check.status === "valid" ? check.gtin : normalizeGtin(value);
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
