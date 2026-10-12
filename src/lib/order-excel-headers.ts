/**
 * Cabeçalhos aceitos na planilha de pedidos. Cada ERP exporta um Excel diferente (vídeo de
 * 28/09): em vez de exigir o modelo XPAN, reconhecemos os nomes mais comuns. Comparação sem
 * acento, caixa e pontuação. Nomes ambíguos NÃO entram (ex.: "cliente" pode ser loja ou pessoa).
 */
export type OrderColumn = "loja" | "produto" | "quantidade";

const synonyms: Record<OrderColumn, string[]> = {
  loja: ["loja", "lojas", "filial", "unidade", "ponto de venda", "pdv", "codigo da loja", "cod loja", "codigo loja", "nome da loja", "loja destino", "destino"],
  produto: ["produto", "produtos", "item", "codigo do produto", "cod produto", "codigo produto", "codigo", "cod", "sku", "descricao", "descricao do produto", "nome do produto", "codigo erp", "cod erp"],
  quantidade: ["quantidade", "qtd", "qtde", "quant", "qde", "qt", "pedido", "quantidade pedida", "qtd pedida", "qtde pedida", "quantidade solicitada", "qtd solicitada"],
};

export function normalizeHeader(value: string) {
  return value
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const lookup = new Map<string, OrderColumn>();
for (const [column, names] of Object.entries(synonyms) as Array<[OrderColumn, string[]]>) {
  for (const name of names) lookup.set(normalizeHeader(name), column);
}

export type HeaderMapping = {
  /** Coluna da planilha (1-based) para cada campo reconhecido. */
  columns: Partial<Record<OrderColumn, number>>;
  /** Cabeçalhos que apontam o mesmo campo — o arquivo é ambíguo e precisa de ajuste. */
  duplicates: Array<{ column: OrderColumn; headers: string[] }>;
  /** Campos sem coluna correspondente. */
  missing: OrderColumn[];
};

export function mapOrderHeaders(headers: Array<{ index: number; text: string }>): HeaderMapping {
  const found = new Map<OrderColumn, Array<{ index: number; text: string }>>();
  for (const header of headers) {
    const column = lookup.get(normalizeHeader(header.text));
    if (!column) continue;
    found.set(column, [...(found.get(column) ?? []), header]);
  }
  const columns: HeaderMapping["columns"] = {};
  const duplicates: HeaderMapping["duplicates"] = [];
  for (const [column, list] of found) {
    if (list.length > 1) duplicates.push({ column, headers: list.map(h => h.text) });
    else columns[column] = list[0].index;
  }
  const missing = (["loja", "produto", "quantidade"] as OrderColumn[]).filter(c => !columns[c] && !duplicates.some(d => d.column === c));
  return { columns, duplicates, missing };
}

export const orderColumnLabels: Record<OrderColumn, string> = { loja: "loja", produto: "produto", quantidade: "quantidade" };
