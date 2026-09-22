import type { OrderEntryRow } from "@/lib/centralized-orders";

export async function readOrderExcel(buffer: ArrayBuffer): Promise<OrderEntryRow[]> {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheets = book.worksheets.filter(s => s.actualRowCount > 0);
  if (sheets.length !== 1) throw new Error("O arquivo deve conter uma única aba preenchida, com as colunas loja, produto e quantidade.");
  const sheet = sheets[0];
  if (sheet.rowCount > 5001) throw new Error("Limite de 5.000 linhas por arquivo.");
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, index) => {
    const name = cell.text.trim().toLocaleLowerCase("pt-BR");
    if (headers.has(name)) throw new Error(`Coluna repetida: ${name}.`);
    headers.set(name, index);
  });
  for (const key of ["loja", "produto", "quantidade"]) if (!headers.has(key)) throw new Error(`Coluna obrigatória ausente: ${key}. Baixe o modelo.`);
  const rows: OrderEntryRow[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const values = ["loja", "produto", "quantidade"].map(key => {
      const cell = row.getCell(headers.get(key)!);
      if (cell.formula || (cell.value && typeof cell.value === "object" && "error" in cell.value)) throw new Error(`Linha ${index}: substitua fórmulas/erros por valores.`);
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
