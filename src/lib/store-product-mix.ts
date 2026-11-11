/**
 * Mix de produtos por loja (cliente, 07/10/2026; cartão #602, 11/11/2026).
 *
 * Nem todo produto é vendido em toda loja. O mix de cada loja é CONFIGURAÇÃO (nunca vem do
 * histórico de pedidos) e pode ser trocado a qualquer momento:
 *  - modelo de mix (`stores.product_mix_template_id`): várias lojas com a mesma lista;
 *  - seleção manual (`stores.product_mix`): lista própria da loja;
 *  - nenhum dos dois: a loja vende TODOS os produtos (padrão; loja nova e cliente sem mix).
 *
 * Num lote aberto, a loja vê só os produtos do seu mix (`inStoreMix`). Item que já tem
 * quantidade num pedido continua aparecendo (o mix pode ter mudado depois do pedido).
 * Pedido centralizado da fábrica e importação por planilha não olham o mix: são o caminho
 * da fábrica para exceções. Por isso nenhuma validação de pedido, cronograma ou produção usa
 * o mix — ele não entra em `available`.
 *
 * Ids de produto guardados no mesmo formato do snapshot (`legacy_id ?? id`). Lista vazia
 * nunca é gravada (esconderia todo o catálogo da loja). Na leitura, vazio ou lixo vira
 * `null`: na dúvida, mostra tudo.
 */

export type StoreProductMix = string[] | null;

export type StoreProductMixTemplate = { id: string; name: string; productIds: string[] };

export type StoreProductMixMode = "todos" | "modelo" | "manual";

export type StoreProductMixSaveResult =
  | { ok: true; mix: StoreProductMix }
  | { ok: false; message: string };

/** Leitura tolerante do banco: qualquer valor inesperado vira "todos os produtos". */
export function normalizeStoreProductMix(value: unknown): StoreProductMix {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids = Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

  return ids.length > 0 ? ids : null;
}

/**
 * Validação de escrita: `null` = todos; lista precisa ter pelo menos um produto.
 * Devolve resultado (sem lançar) para esta regra ficar livre de código de servidor.
 */
export function resolveStoreProductMixForSave(value: unknown): StoreProductMixSaveResult {
  if (value === null || value === undefined) {
    return { ok: true, mix: null };
  }

  if (!Array.isArray(value)) {
    return { ok: false, message: "Mix de produtos inválido: envie uma lista de produtos ou deixe em branco." };
  }

  const normalized = normalizeStoreProductMix(value);
  if (!normalized) {
    return {
      ok: false,
      message: "Selecione ao menos um produto para o mix da loja ou volte para \"Todos os produtos\".",
    };
  }

  return { ok: true, mix: normalized };
}

/** Nome do modelo: espaços normalizados, 1 a 60 letras. `null` = inválido. */
export function cleanStoreProductMixTemplateName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= 60 ? name : null;
}

/** Linhas de `store_product_mix_templates` -> modelos (descarta linha sem lista válida). */
export function mapStoreProductMixTemplateRows(rows: unknown[]): StoreProductMixTemplate[] {
  return rows
    .map((row) => {
      const record = (row ?? {}) as { id?: unknown; name?: unknown; product_ids?: unknown };
      const productIds = normalizeStoreProductMix(record.product_ids);
      if (typeof record.id !== "string" || typeof record.name !== "string" || !productIds) {
        return null;
      }
      return { id: record.id, name: record.name, productIds };
    })
    .filter((template): template is StoreProductMixTemplate => template !== null)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

/**
 * Mix que vale para a loja: modelo (se existir) > lista manual > todos.
 * Modelo apontado mas não encontrado (apagado/sem permissão) cai na lista manual e, sem ela,
 * em "todos": na dúvida a loja vê tudo, nunca um catálogo vazio.
 */
export function resolveEffectiveStoreProductMix(
  store: { productMixTemplateId?: string | null; manualProductMix?: StoreProductMix },
  templates: readonly StoreProductMixTemplate[],
): StoreProductMix {
  if (store.productMixTemplateId) {
    const template = templates.find((entry) => entry.id === store.productMixTemplateId);
    if (template && template.productIds.length > 0) {
      return template.productIds;
    }
  }

  return normalizeStoreProductMix(store.manualProductMix ?? null);
}

/** Como a loja está configurada (para a tela). */
export function getStoreProductMixMode(store: {
  productMixTemplateId?: string | null;
  manualProductMix?: StoreProductMix;
}): StoreProductMixMode {
  if (store.productMixTemplateId) return "modelo";
  return normalizeStoreProductMix(store.manualProductMix ?? null) ? "manual" : "todos";
}

/** O produto está no mix da loja? Sem mix definido, todo produto está. */
export function isProductInStoreMix(mix: StoreProductMix | undefined, productId: string): boolean {
  if (!mix || mix.length === 0) {
    return true;
  }

  return mix.includes(productId);
}

/**
 * Lista que a loja vê no lote: só o mix, mais o que já tem quantidade digitada (pedido feito
 * antes de o mix mudar não perde item). Sem mix definido, todos os itens.
 */
export function selectStoreMixItems<T extends { inStoreMix: boolean }>(
  items: readonly T[],
  hasQuantity: (item: T) => boolean,
): T[] {
  return items.filter((item) => item.inStoreMix || hasQuantity(item));
}

/**
 * Inclui ou tira um produto de uma lista de mix (usado no cadastro do produto).
 * Devolve `null` quando tirar o produto deixaria a lista vazia (proibido).
 */
export function toggleProductInMixList(list: readonly string[], productId: string, include: boolean): string[] | null {
  const without = list.filter((id) => id !== productId);
  if (include) {
    return [...without, productId];
  }
  return without.length > 0 ? without : null;
}

/**
 * Lojas que aparecem por padrão ao lançar um produto na tela centralizada.
 * `showAll` mostra todas (pedido fora do padrão); o filtro nunca remove loja que já tem
 * quantidade digitada.
 */
export function selectStoresForProduct<T extends { id: string; productMix?: StoreProductMix }>(
  stores: T[],
  productId: string,
  options: { showAll: boolean; hasQuantity?: (storeId: string) => boolean },
): T[] {
  if (options.showAll) {
    return stores;
  }

  return stores.filter(
    (store) => isProductInStoreMix(store.productMix, productId) || options.hasQuantity?.(store.id) === true,
  );
}
