/* -------------------------------------------------------------------------------------------------
 * Unidade de peso com que a OP é VISTA e IMPRESSA (quilos ou gramas).
 *
 * É só apresentação: o cadastro (ingrediente, receita, produto) e o banco continuam em Kg. A conta
 * é feita na hora de mostrar — `0,234 Kg` vira `234 g` — e NUNCA é gravada de volta. Tudo que sai
 * numa folha passa por aqui, para a tela de visualização e a impressão mostrarem exatamente o mesmo.
 *
 * Só Kg vira g. Qualquer outra unidade (g, L, ml, Un, Forma…) passa intacta: o ajuste é "kg ↔ g",
 * não uma conversão geral de unidades.
 * -----------------------------------------------------------------------------------------------*/

export type WeightDisplayUnit = "kg" | "g";

export const defaultWeightDisplayUnit: WeightDisplayUnit = "kg";

export const weightDisplayUnitLabels: Record<WeightDisplayUnit, string> = {
  kg: "Quilos (Kg)",
  g: "Gramas (g)",
};

/** Rótulo curto da unidade, como a coluna/etiqueta mostra. */
export const weightDisplayUnitShortLabels: Record<WeightDisplayUnit, string> = {
  kg: "Kg",
  g: "g",
};

type FractionOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

/** Aceita "g", "gr", "G", "GR", "grama(s)"; qualquer outra coisa (inclusive vazio) é o padrão: kg. */
export function normalizeWeightDisplayUnit(value: unknown): WeightDisplayUnit {
  if (typeof value !== "string") {
    return defaultWeightDisplayUnit;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "g" || normalized === "gr" || normalized === "grama" || normalized === "gramas") {
    return "g";
  }

  return defaultWeightDisplayUnit;
}

/** Valor reconhecido? Diferente de `normalize`, que devolve o padrão para lixo. */
export function isWeightDisplayUnit(value: unknown): value is WeightDisplayUnit {
  return value === "kg" || value === "g";
}

/**
 * Escolha na emissão (`?unit=` na URL) ganha da configuração geral do cliente. Valor inválido na
 * URL é ignorado — cai na configuração do cliente, não no kg.
 */
export function resolveWeightDisplayUnit(
  override: string | null | undefined,
  tenantDefault: unknown,
): WeightDisplayUnit {
  const candidate = typeof override === "string" ? override.trim().toLowerCase() : "";
  if (isWeightDisplayUnit(candidate)) {
    return candidate;
  }

  return normalizeWeightDisplayUnit(tenantDefault);
}

/** Kg → g sem o ruído de ponto flutuante (1,005 × 1000 = 1004,9999…). */
export function kgToGrams(kg: number): number {
  return Number((kg * 1000).toFixed(6));
}

function isKgUnit(unit: string) {
  return unit.trim().toLowerCase() === "kg";
}

export type DisplayQuantity = {
  value: number;
  unit: string;
  /** `true` quando houve conversão kg → g. */
  converted: boolean;
};

/**
 * Converte UMA quantidade para a unidade de exibição. Só Kg em modo "g" é convertido; o resto
 * volta como veio (inclusive o texto da unidade, para preservar "Kg" / "kg" de cada folha).
 */
export function toDisplayQuantity(value: number, unit: string, display: WeightDisplayUnit): DisplayQuantity {
  if (display === "g" && isKgUnit(unit) && Number.isFinite(value)) {
    return { value: kgToGrams(value), unit: "g", converted: true };
  }

  return { value, unit, converted: false };
}

const GRAM_FRACTION_OPTIONS: Required<FractionOptions> = {
  minimumFractionDigits: 0,
  // Uma casa preserva o que o kg com 3 casas já mostrava (1 g) e ainda deixa aparecer 0,4 g.
  maximumFractionDigits: 1,
};

function formatNumber(value: number, options: FractionOptions) {
  return new Intl.NumberFormat("pt-BR", options).format(value);
}

/**
 * Texto final "<número> <unidade>" de uma quantidade.
 *
 * - convertida (Kg → g): inteiro de gramas, até 1 casa ("234 g", "1.250 g", "0,4 g");
 * - não convertida: `fallbackOptions` — as MESMAS casas que a folha já usava (3 fixas na folha
 *   de produção, até 3 na térmica), para o modo kg sair idêntico ao de antes desta função.
 */
export function formatDisplayQuantity(
  value: number | null | undefined,
  unit: string,
  display: WeightDisplayUnit,
  fallbackOptions: FractionOptions = { maximumFractionDigits: 3 },
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  const shown = toDisplayQuantity(value, unit, display);
  const options = shown.converted ? GRAM_FRACTION_OPTIONS : fallbackOptions;
  return `${formatNumber(shown.value, options)} ${shown.unit}`;
}

/** Só o número (para colunas cujo título já traz a unidade). */
export function formatDisplayNumber(
  value: number | null | undefined,
  unit: string,
  display: WeightDisplayUnit,
  fallbackOptions: FractionOptions = { maximumFractionDigits: 3 },
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  const shown = toDisplayQuantity(value, unit, display);
  return formatNumber(shown.value, shown.converted ? GRAM_FRACTION_OPTIONS : fallbackOptions);
}
