import type { OrderEntryRow } from "@/lib/centralized-orders";
import { mapOrderHeaders } from "@/lib/order-excel-headers";

/** Procura o cabeçalho nas primeiras linhas (ERPs costumam pôr título/data antes da tabela). */
const HEADER_SEARCH_ROWS = 10;

export async function readOrderExcel(buffer: ArrayBuffer): Promise<OrderEntryRow[]> {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheets = book.worksheets.filter(s => s.actualRowCount > 0);
  if (sheets.length !== 1) throw new Error("O arquivo deve conter uma única aba preenchida, com as colunas loja, produto e quantidade.");
  const sheet = sheets[0];
  if (sheet.rowCount > 5001 + HEADER_SEARCH_ROWS) throw new Error("Limite de 5.000 linhas por arquivo.");

  let headerRow = 0;
  let mapping: ReturnType<typeof mapOrderHeaders> | null = null;
  let bestMissing = 4;
  for (let index = 1; index <= Math.min(HEADER_SEARCH_ROWS, sheet.rowCount); index++) {
    const headers: Array<{ index: number; text: string }> = [];
    sheet.getRow(index).eachCell((cell, column) => { const text = cell.text.trim(); if (text) headers.push({ index: column, text }); });
    if (!headers.length) continue;
    const candidate = mapOrderHeaders(headers);
    const missingCount = candidate.missing.length + candidate.duplicates.length;
    if (missingCount < bestMissing) { bestMissing = missingCount; headerRow = index; mapping = candidate; }
    if (missingCount === 0) break;
  }
  if (!mapping || !headerRow) throw new Error("Cabeçalho não encontrado. A planilha precisa ter as colunas loja, produto e quantidade. Baixe o modelo.");
  if (mapping.duplicates.length) {
    const d = mapping.duplicates[0];
    throw new Error(`Mais de uma coluna parece ser "${d.column}": ${d.headers.map(h => `"${h}"`).join(" e ")}. Deixe só uma no arquivo.`);
  }
  if (mapping.missing.length) {
    throw new Error(`Coluna obrigatória ausente: ${mapping.missing.join(", ")}. Nomes aceitos incluem, por exemplo, loja/filial, produto/código/descrição e quantidade/qtd. Baixe o modelo.`);
  }
  const columns = mapping.columns as Record<"loja" | "produto" | "quantidade", number>;

  const rows: OrderEntryRow[] = [];
  sheet.eachRow((row, index) => {
    if (index <= headerRow) return;
    const values = (["loja", "produto", "quantidade"] as const).map(key => {
      const cell = row.getCell(columns[key]);
      if (cell.formula || (cell.value && typeof cell.value === "object" && "error" in cell.value)) throw new Error(`Linha ${index}: substitua fórmulas/erros por valores.`);
      // Número de verdade em loja/produto (ex.: 42) perde zeros à esquerda: devolve o número como está,
      // e a revisão tenta casar também com o código sem zeros. Quantidade segue como texto da célula.
      return cell.text.trim();
    });
    if (values.every(v => !v)) return;
    rows.push({ row: index, store: values[0], product: values[1], quantity: values[2] });
  });
  return rows;
}

export async function downloadOrderTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Pedidos");
  sheet.addRow(["loja", "produto", "quantidade"]);
  sheet.columns = [{ width: 28 }, { width: 36 }, { width: 18 }];
  sheet.getColumn(1).numFmt = "@";
  sheet.getColumn(2).numFmt = "@";
  sheet.getRow(1).font = { bold: true };
  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url; link.download = "XPAN-modelo-pedidos.xlsx"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
