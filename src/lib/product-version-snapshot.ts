/* -------------------------------------------------------------------------------------------------
 * Versões do produto — o que entra na "foto" de cada versão e como restaurar uma.
 *
 * A foto é o cadastro de processo do produto (receita, teste de laboratório, etapas, unidades, dias
 * de produção, parâmetros de batida...). Ficam FORA dela a identidade e o liga/desliga: id, código
 * da fábrica, código do ERP, GTIN, datas, "ativo" e "disponível para pedido". Assim restaurar uma
 * versão antiga nunca troca o código que o cliente já usa nem reativa/pausa o produto.
 *
 * Lógica pura (sem server-only), para ser testada e usada tanto no servidor (gravar) quanto na
 * tela (restaurar).
 * -----------------------------------------------------------------------------------------------*/

const EXCLUDED_KEYS = new Set([
  "id",
  "code",
  "externalCode",
  "gtin",
  "displayCode",
  "createdAt",
  "updatedAt",
  "active",
  "availableForOrdering",
  // Campos de transporte da própria requisição, nunca parte do cadastro.
  "changeDescription",
  "versionBaseline",
]);

export type ProductVersionSnapshot = Record<string, unknown>;

/** Foto serializável do cadastro: cópia profunda, sem identidade/liga-desliga e sem `undefined`. */
export function buildProductVersionSnapshot(product: Record<string, unknown>): ProductVersionSnapshot {
  const snapshot: ProductVersionSnapshot = {};
  for (const [key, value] of Object.entries(product)) {
    if (EXCLUDED_KEYS.has(key) || value === undefined) {
      continue;
    }
    snapshot[key] = value;
  }
  return JSON.parse(JSON.stringify(snapshot)) as ProductVersionSnapshot;
}

export function isProductVersionSnapshot(value: unknown): value is ProductVersionSnapshot {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
}

/**
 * Aplica uma foto sobre o formulário atual. A identidade e o liga/desliga ficam como estão agora;
 * campos que a foto não conhece (criados depois dela) também ficam como estão.
 */
export function applyProductVersionSnapshot<T extends object>(current: T, snapshot: ProductVersionSnapshot): T {
  const restored = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
  for (const key of EXCLUDED_KEYS) {
    delete restored[key];
  }
  return { ...current, ...restored } as T;
}

type RecipeLine = { sourceType?: unknown; sourceId?: unknown; label?: unknown };

/**
 * Linhas da receita da foto cujo ingrediente/produto não existe mais no cadastro. Restaurar com
 * uma referência quebrada falharia só ao salvar, então a tela confere antes e avisa quais são.
 */
export function findMissingRecipeSources(
  snapshot: ProductVersionSnapshot,
  existing: { ingredientIds: ReadonlySet<string>; productIds: ReadonlySet<string> },
): string[] {
  const recipe = Array.isArray(snapshot.recipe) ? (snapshot.recipe as RecipeLine[]) : [];
  const missing: string[] = [];
  for (const line of recipe) {
    const id = typeof line.sourceId === "string" ? line.sourceId : "";
    const exists = line.sourceType === "produto" ? existing.productIds.has(id) : existing.ingredientIds.has(id);
    if (!exists) {
      missing.push(typeof line.label === "string" && line.label.trim() ? line.label : id || "item sem nome");
    }
  }
  return missing;
}

/** Texto que já vem preenchido no motivo ao salvar uma versão restaurada (a pessoa pode complementar). */
export function buildRestoreChangeDescription(versionNumber: number): string {
  return `Restaurada a versão ${versionNumber}. `;
}

export const BASELINE_VERSION_DESCRIPTION = "Estado anterior ao primeiro registro de versões";
