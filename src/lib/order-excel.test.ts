import assert from "node:assert/strict";
import test from "node:test";
import { Workbook } from "exceljs";
import { readOrderExcel } from "./order-excel";

test("xlsx preserva códigos com zeros e números de linha para revisão", async () => {
  const book = new Workbook(); const sheet = book.addWorksheet("Pedidos");
  sheet.addRow(["loja", "produto", "quantidade"]);
  sheet.addRow(["001", "0009", 250]); sheet.addRow([]); sheet.addRow(["002", "0009", "1,5"]);
  assert.deepEqual(await readOrderExcel(await book.xlsx.writeBuffer()), [
    { row: 2, store: "001", product: "0009", quantity: "250" },
    { row: 4, store: "002", product: "0009", quantity: "1,5" },
  ]);
});
test("xlsx não ignora colunas ausentes, abas extras ou fórmulas", async () => {
  const book = new Workbook(); const sheet = book.addWorksheet("Pedidos");
  sheet.addRow(["loja", "produto"]);
  await assert.rejects(() => book.xlsx.writeBuffer().then(readOrderExcel), /quantidade/);
  sheet.getCell("C1").value = "quantidade"; sheet.addRow(["001", "0009", { formula: "1+1", result: 2 }]);
  await assert.rejects(() => book.xlsx.writeBuffer().then(readOrderExcel), /Linha 2/);
  book.addWorksheet("Esquecida").addRow(["dados"]);
  await assert.rejects(() => book.xlsx.writeBuffer().then(readOrderExcel), /única aba/);
});
