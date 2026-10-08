/**
 * Mix de produtos por loja (cliente, 07/10/2026).
 *
 * É um FILTRO DE APRESENTAÇÃO: organiza os pedidos abertos do dia mostrando, por padrão,
 * só os produtos que a loja costuma vender. NÃO bloqueia nada — pedido manual, encomenda
 * fora do padrão e importação por planilha seguem aceitando qualquer produto. Por isso
 * nenhuma validação de pedido, cronograma ou produção olha para este mix.
 *
 * Valor guardado em `stores.product_mix`:
 *  - `null`  → a loja recebe TODOS os produtos (padrão; loja nova e cliente sem mix).
 *  - lista de ids de produto (mesmo id do snapshot: `legacy_id ?? id`) → só esses por padrão.
 *
 * Lista vazia nunca é gravada (esconderia todo o catálogo da loja). Na leitura, vazio ou
 * lixo vira `null`: na dúvida, mostra tudo.
 */

export type StoreProductMix = string[] | null;

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

/** O produto está no mix padrão da loja? Sem mix definido, todo produto está. */
export function isProductInStoreMix(mix: StoreProductMix | undefined, productId: string): boolean {
  if (!mix || mix.length === 0) {
    return true;
  }

  return mix.includes(productId);
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
