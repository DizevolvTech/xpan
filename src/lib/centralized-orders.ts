import type { UnitCode } from "@/lib/factory-planning/units";
import { isDiscreteUnit } from "@/lib/factory-planning/units";
import { parseOrderQuantity } from "@/lib/order-quantity";

export type OrderEntryRow = { row: number; store: string; product: string; quantity: number | string };
export type OrderEntryCatalog = {
  stores: Array<{ id: string; code: string; name: string; productMix?: string[] | null }>;
  products: Array<{ id: string; code: string; externalCode?: string; name: string; unit: UnitCode }>;
};
export type ReviewedOrderRow = { row: number; storeId: string; storeName: string; productId: string; productName: string; quantity: number; unit: UnitCode; warning?: string };
export type OrderEntryError = { row: number; message: string };
/** Aviso que NÃO bloqueia, mas exige que o gestor confira antes de confirmar. */
export type OrderEntryWarning = { row: number; message: string };
/** Pedido ativo que já existe para a loja na data (impede um segundo pedido igual). */
export type ExistingOrderConflict = { storeId: string; storeName: string; orderCode: string };
const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
/** "0042" e "42" são o mesmo código quando o Excel guardou o código como número (zeros somem). */
const stripLeadingZeros = (value: string) => (/^0+\d+$/.test(value.trim()) ? value.trim().replace(/^0+/, "") : value.trim());
const isNumericCode = (value: string) => /^\d+$/.test(value.trim());
function codeMatches(candidate: string, typed: string) {
  if (!candidate) return false;
  if (normalize(candidate) === normalize(typed)) return true;
  return isNumericCode(candidate) && isNumericCode(typed) && stripLeadingZeros(candidate) === stripLeadingZeros(typed);
}

/** Distância de edição simples (Levenshtein) — só para sugerir "quis dizer…" em nomes parecidos. */
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function suggest(raw: string, candidates: Array<{ label: string; keys: string[] }>) {
  const target = normalize(raw);
  if (!target) return null;
  let best: { label: string; score: number } | null = null;
  for (const candidate of candidates) {
    for (const key of candidate.keys) {
      const k = normalize(key);
      if (!k) continue;
      // "Contém" só vale para textos de 4+ letras; códigos curtos ("1") estariam dentro de qualquer coisa.
      const contains = Math.min(k.length, target.length) >= 4 && (k.includes(target) || target.includes(k));
      const score = contains ? 1 : distance(target, k);
      if (!best || score < best.score) best = { label: candidate.label, score };
    }
  }
  // Tolerância proporcional ao tamanho: texto curto quase não tolera diferença (evita sugestões absurdas).
  const limit = Math.min(3, Math.floor(target.length / 3));
  return best && best.score <= limit ? best.label : null;
}

export function reviewOrderEntries(rows: OrderEntryRow[], catalog: OrderEntryCatalog) {
  const errors: OrderEntryError[] = [];
  const warnings: OrderEntryWarning[] = [];
  const reviewed: ReviewedOrderRow[] = [];
  const seen = new Map<string, number>();
  const storeOptions = catalog.stores.map(s => ({ label: `${s.code} · ${s.name}`, keys: [s.code, s.name] }));
  const productOptions = catalog.products.map(p => ({ label: `${p.externalCode || p.code} · ${p.name}`, keys: [p.code, p.externalCode ?? "", p.name] }));
  for (const row of rows) {
    const storeText = String(row.store);
    const productText = String(row.product);
    const stores = catalog.stores.filter(s => [s.id, s.code, s.name].some(v => codeMatches(v, storeText)));
    const products = catalog.products.filter(p => [p.id, p.code, p.externalCode ?? "", p.name].some(v => codeMatches(v, productText)));
    let rowFailed = false;
    if (stores.length !== 1) {
      rowFailed = true;
      if (stores.length) errors.push({ row: row.row, message: `Loja "${storeText}" é ambígua (mais de uma com esse nome); use o código da loja.` });
      else if (!normalize(storeText)) errors.push({ row: row.row, message: "Loja em branco. Informe o código ou o nome da loja." });
      else {
        const hint = suggest(storeText, storeOptions);
        errors.push({ row: row.row, message: `Loja "${storeText}" não reconhecida ou sem acesso.${hint ? ` Quis dizer ${hint}?` : " Confira o código na lista de lojas."}` });
      }
    }
    if (products.length !== 1) {
      rowFailed = true;
      if (products.length) errors.push({ row: row.row, message: `Produto "${productText}" é ambíguo (mais de um com esse nome); use o código do produto.` });
      else if (!normalize(productText)) errors.push({ row: row.row, message: "Produto em branco. Informe o código ou o nome do produto." });
      else {
        const hint = suggest(productText, productOptions);
        errors.push({ row: row.row, message: `Produto "${productText}" não reconhecido, inativo ou fora de pedidos.${hint ? ` Quis dizer ${hint}?` : " Confira o código no cadastro."}` });
      }
    }
    const store = stores.length === 1 ? stores[0] : null;
    const product = products.length === 1 ? products[0] : null;
    const parsed = parseOrderQuantity(row.quantity, product?.unit);
    if (!parsed.ok) { errors.push({ row: row.row, message: parsed.message }); continue; }
    if (rowFailed || !store || !product) continue;
    const quantity = parsed.value;
    if (isDiscreteUnit(product.unit) && !Number.isInteger(quantity)) {
      errors.push({ row: row.row, message: `${product.name} é pedido em ${product.unit} (unidades inteiras); ${String(row.quantity)} não é inteiro.` });
      continue;
    }
    const key = JSON.stringify([store.id, product.id]);
    const firstRow = seen.get(key);
    if (firstRow !== undefined) {
      errors.push({ row: row.row, message: `${store.name} × ${product.name} já aparece na linha ${firstRow}. Consolide em uma linha só.` });
      continue;
    }
    seen.set(key, row.row);
    if (parsed.warning) warnings.push({ row: row.row, message: parsed.warning });
    reviewed.push({ row: row.row, storeId: store.id, storeName: store.name, productId: product.id, productName: product.name, quantity, unit: product.unit, ...(parsed.warning ? { warning: parsed.warning } : {}) });
  }
  if (!rows.length) errors.push({ row: 0, message: "Informe ao menos uma quantidade." });
  return { rows: reviewed, errors, warnings };
}

/**
 * Pedido ativo que já existe para a mesma loja e data: o banco recusa um segundo (trava de
 * duplicidade AJ-0007). Detectar ANTES da confirmação permite dizer qual loja e qual pedido,
 * em vez de falhar o lote inteiro com uma mensagem genérica.
 */
export function findOrderConflicts(
  reviewed: Array<Pick<ReviewedOrderRow, "row" | "storeId" | "storeName">>,
  existing: Array<{ storeId: string; code: string }>,
): { errors: OrderEntryError[]; conflicts: ExistingOrderConflict[] } {
  const byStore = new Map(existing.map(order => [order.storeId, order.code]));
  const errors: OrderEntryError[] = [];
  const conflicts: ExistingOrderConflict[] = [];
  const reported = new Set<string>();
  for (const row of reviewed) {
    const code = byStore.get(row.storeId);
    if (!code) continue;
    if (!reported.has(row.storeId)) {
      reported.add(row.storeId);
      conflicts.push({ storeId: row.storeId, storeName: row.storeName, orderCode: code });
    }
    errors.push({
      row: row.row,
      message: `${row.storeName} já tem o pedido ${code} ativo nesta data. Edite ou cancele esse pedido, ou escolha outra data de entrega.`,
    });
  }
  return { errors, conflicts };
}

/**
 * Estado do botão "Confirmar e registrar pedidos". Avisos (ex.: milhar em produto por peso)
 * não bloqueiam, mas exigem que o gestor marque "conferi". Erros bloqueiam sempre.
 */
export function canConfirmReview(
  review: { rows: unknown[]; errors: unknown[]; warnings?: unknown[] },
  acknowledgedWarnings: boolean,
): { allowed: boolean; reason: string | null } {
  if (review.errors.length) return { allowed: false, reason: "Corrija os erros indicados antes de confirmar." };
  if (!review.rows.length) return { allowed: false, reason: "Não há linhas válidas para registrar." };
  if ((review.warnings?.length ?? 0) > 0 && !acknowledgedWarnings) {
    return { allowed: false, reason: "Confira os avisos e marque que conferiu antes de confirmar." };
  }
  return { allowed: true, reason: null };
}

/** Grade lojas × produtos → linhas do lançamento (vazio e zero não geram linha). */
export function gridToEntryRows(
  quantities: Record<string, Record<string, string>>,
): OrderEntryRow[] {
  const rows: OrderEntryRow[] = [];
  for (const [product, stores] of Object.entries(quantities)) {
    for (const [store, quantity] of Object.entries(stores)) {
      const text = quantity.trim();
      if (!text || /^0+(?:[.,]0+)?$/.test(text)) continue;
      rows.push({ row: rows.length + 1, store, product, quantity: text });
    }
  }
  return rows;
}
