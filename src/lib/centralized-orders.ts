import type { UnitCode } from "@/lib/factory-planning/units";
import { isDiscreteUnit } from "@/lib/factory-planning/units";

export type OrderEntryRow = { row: number; store: string; product: string; quantity: number | string };
export type OrderEntryCatalog = {
  stores: Array<{ id: string; code: string; name: string }>;
  products: Array<{ id: string; code: string; externalCode?: string; name: string; unit: UnitCode }>;
};
export type ReviewedOrderRow = { row: number; storeId: string; storeName: string; productId: string; productName: string; quantity: number; unit: UnitCode };
export type OrderEntryError = { row: number; message: string };
const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function reviewOrderEntries(rows: OrderEntryRow[], catalog: OrderEntryCatalog) {
  const errors: OrderEntryError[] = [];
  const reviewed: ReviewedOrderRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const stores = catalog.stores.filter(s => [s.id, s.code, s.name].some(v => normalize(v) === normalize(String(row.store))));
    const products = catalog.products.filter(p => [p.id, p.code, p.externalCode ?? "", p.name].some(v => v && normalize(v) === normalize(String(row.product))));
    if (stores.length !== 1) errors.push({ row: row.row, message: stores.length ? "Loja ambígua; use o código." : "Loja não reconhecida ou sem acesso." });
    if (products.length !== 1) errors.push({ row: row.row, message: products.length ? "Produto ambíguo; use o código." : "Produto não reconhecido ou inativo." });
    const raw = String(row.quantity).trim();
    const quantity = /^\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(",", ".")) : NaN;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999999999 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.00001) {
      errors.push({ row: row.row, message: "Quantidade deve ser positiva, com no máximo três casas decimais." });
      continue;
    }
    if (stores.length !== 1 || products.length !== 1) continue;
    const store = stores[0], product = products[0];
    if (isDiscreteUnit(product.unit) && !Number.isInteger(quantity)) {
      errors.push({ row: row.row, message: "Este produto exige unidades inteiras." });
      continue;
    }
    const key = JSON.stringify([store.id, product.id]);
    if (seen.has(key)) { errors.push({ row: row.row, message: "Produto e loja repetidos no lançamento; consolide em uma linha." }); continue; }
    seen.add(key);
    reviewed.push({ row: row.row, storeId: store.id, storeName: store.name, productId: product.id, productName: product.name, quantity, unit: product.unit });
  }
  if (!rows.length) errors.push({ row: 0, message: "Informe ao menos uma quantidade." });
  return { rows: reviewed, errors };
}
