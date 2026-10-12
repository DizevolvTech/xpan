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

async function sheetOf(rows: unknown[][]) {
  const book = new Workbook(); const sheet = book.addWorksheet("Pedidos");
  for (const row of rows) sheet.addRow(row);
  return book.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

test("cabeçalhos de ERP: qtd, filial e código do produto são reconhecidos", async () => {
  const rows = await readOrderExcel(await sheetOf([["Filial", "Código do Produto", "Qtd"], ["001", "0009", 10]]));
  assert.deepEqual(rows, [{ row: 2, store: "001", product: "0009", quantity: "10" }]);
});

test("cabeçalho com acento, maiúsculas e pontuação: 'QTDE.' e 'Descrição'", async () => {
  const rows = await readOrderExcel(await sheetOf([["Loja", "Descrição", "QTDE."], ["Centro", "Bolo", 3]]));
  assert.equal(rows[0].quantity, "3");
  assert.equal(rows[0].product, "Bolo");
});

test("cabeçalho não está na primeira linha: título e data do ERP antes da tabela", async () => {
  const rows = await readOrderExcel(await sheetOf([["Relatório de pedidos"], ["Emitido em 12/10"], [], ["Loja", "Produto", "Quantidade"], ["001", "0009", 4]]));
  assert.deepEqual(rows, [{ row: 5, store: "001", product: "0009", quantity: "4" }]);
});

test("colunas extras e fora de ordem são ignoradas sem confundir", async () => {
  const rows = await readOrderExcel(await sheetOf([["Obs", "Qtd", "Produto", "Loja"], ["urgente", 7, "0009", "001"]]));
  assert.deepEqual(rows, [{ row: 2, store: "001", product: "0009", quantity: "7" }]);
});

test("duas colunas para o mesmo campo: recusa e diz quais", async () => {
  await assert.rejects(
    async () => readOrderExcel(await sheetOf([["Loja", "Produto", "Qtd", "Quantidade"], ["001", "0009", 1, 2]])),
    /Mais de uma coluna.*quantidade.*"Qtd".*"Quantidade"/,
  );
});

test("coluna ausente: mensagem lista nomes aceitos", async () => {
  await assert.rejects(
    async () => readOrderExcel(await sheetOf([["Loja", "Produto"], ["001", "0009"]])),
    /ausente: quantidade.*qtd/,
  );
});

test("arquivo sem nenhuma coluna reconhecível: não finge que leu", async () => {
  await assert.rejects(async () => readOrderExcel(await sheetOf([["a", "b", "c"], [1, 2, 3]])), /ausente|não encontrado/);
});

test("valor de quantidade em texto 1.000 chega como texto para a revisão decidir (nunca vira 1 aqui)", async () => {
  const rows = await readOrderExcel(await sheetOf([["loja", "produto", "quantidade"], ["001", "0009", "1.000"]]));
  assert.equal(rows[0].quantity, "1.000");
});
