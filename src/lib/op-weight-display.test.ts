import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProductionSheetSections } from "@/components/printing/production-sheet";
import { formatBatchSizesPhrase, formatBatchSplitPhrase, type PreWeighBatchSplit } from "@/lib/production-batches";
import { buildThermalTickets } from "@/lib/thermal-production";
import type { ProductionSheetDocument, ProductionSheetRow } from "@/lib/printing-documents";
import { formatDisplayQuantity } from "@/lib/weight-display";

const row = (over: Partial<ProductionSheetRow> & Pick<ProductionSheetRow, "key" | "label" | "unit" | "estimatedQuantity">): ProductionSheetRow => ({
  sourceType: "ingrediente",
  kind: "ingrediente",
  stage: "massa",
  quantityPerUnit: null,
  ...over,
});

const split: PreWeighBatchSplit = {
  batched: true,
  fullBatchCount: 2,
  fullBatchUnits: 6,
  fullBatchKg: 6,
  partialUnits: 1.5,
  partialKg: 1.5,
  totalUnits: 13.5,
  unitLabel: "Kg",
};

/** "PROD - ABACATE GR": cadastro em Kg, folha deve poder sair em g. */
const document: ProductionSheetDocument = {
  deliveryGap: { days: [1], label: "Dia+1" },
  ingredientSections: [
    {
      productId: "mpi-1",
      productCode: "PR-00090",
      productName: "Massa base",
      stage: "massa",
      stageLabel: null,
      requiredQuantity: 3,
      requiredUnit: "Kg",
      requiredKg: 3.25,
      usedBy: ["Bolo"],
      batchSplit: null,
      items: [row({ key: "m1", label: "PROD - ABACATE GR", unit: "Kg", estimatedQuantity: 0.234 })],
    },
  ],
  productSections: [
    {
      productId: "p1",
      productCode: "PR-00001",
      productName: "Bolo",
      plannedKg: 12.5,
      requestedQuantity: 12.5,
      requestedUnit: "Kg",
      unitWeightKg: 0.5,
      unitsCount: 25,
      batchSplit: split,
      items: [
        row({ key: "a", label: "Farinha", unit: "Kg", estimatedQuantity: 5.5, batchQuantity: 2.5, partialQuantity: 0.5, quantityPerUnit: 0.22 }),
        row({ key: "b", label: "Fermento", unit: "g", estimatedQuantity: 30, quantityPerUnit: 1.2 }),
        row({ key: "c", label: "Ovo", unit: "Un", estimatedQuantity: 12, quantityPerUnit: 0.48 }),
        row({ key: "d", label: "Leite", unit: "L", estimatedQuantity: 1.5, quantityPerUnit: 0.06 }),
      ],
    },
  ],
};

const html = (weight?: "kg" | "g") => renderToStaticMarkup(createElement(ProductionSheetSections, { document, weight }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");

test("folha de produção em kg: sem informar unidade sai idêntica à de sempre (kg é o padrão)", () => {
  assert.equal(html(), html("kg"));
  const t = text(html("kg"));
  assert.match(t, /0,234 Kg/);
  assert.match(t, /5,500 Kg/);
  assert.match(t, /Peso finalizado: 3,250 Kg/);
  assert.match(t, /Carga: 12,500 Kg/);
  assert.match(t, /Peso un\.: 0,500 Kg/);
  assert.doesNotMatch(t, /234 g/, "em kg nenhum valor pode aparecer em gramas");
});

test("folha de produção em g: Kg do cadastro vira gramas em TODAS as colunas (pré-pesagem, batida, parcial, unidade, subtotais)", () => {
  const t = text(html("g"));
  assert.match(t, /\b234 g\b/); // 0,234 Kg do ingrediente
  assert.match(t, /5\.500 g/); // pré pesagem da farinha
  assert.match(t, /2\.500 g/); // coluna batida cheia
  assert.match(t, /\b500 g\b/); // coluna parcial
  assert.match(t, /\b220 g\b/); // coluna unidades (0,22 Kg por unidade)
  assert.match(t, /Peso finalizado: 3\.250 g/);
  assert.match(t, /Carga: 12\.500 g/);
  assert.match(t, /Peso un\.: 500 g/);
  assert.doesNotMatch(t, /\d Kg/, "nenhum 'Kg' de ingrediente/carga deve sobrar em modo g (a unidade pedida da faixa não é peso de ingrediente)");
});

test("modo g NÃO converte o que não é Kg: g, Un e L passam intactos", () => {
  const t = text(html("g"));
  assert.match(t, /30,000 g/); // fermento já em g: não vira 30.000 g nem 0,03
  assert.match(t, /12,000 Un/);
  assert.match(t, /1,500 L/);
  assert.match(t, /1,200 g/); // por unidade do fermento (g)
});

test("frase de batidas converte só o que é peso: Kg vira g, Un não", () => {
  assert.equal(formatBatchSplitPhrase(split), "2 cheias de 6 Kg + 1 parcial de 1,5 Kg");
  assert.equal(formatBatchSplitPhrase(split, "units", "g"), "2 cheias de 6.000 g + 1 parcial de 1.500 g");
  assert.equal(formatBatchSplitPhrase(split, "kg"), "2 cheias de 6 kg + 1 parcial de 1,5 kg");
  assert.equal(formatBatchSplitPhrase(split, "kg", "g"), "2 cheias de 6.000 g + 1 parcial de 1.500 g");

  const counted: PreWeighBatchSplit = { ...split, unitLabel: "Un", fullBatchUnits: 100, partialUnits: 50, totalUnits: 250 };
  assert.equal(formatBatchSplitPhrase(counted, "units", "g"), "2 cheias de 100 Un + 1 parcial de 50 Un");
  assert.equal(formatBatchSplitPhrase(counted, "kg", "g"), "2 cheias de 6.000 g + 1 parcial de 1.500 g");
});

test("frase a partir dos tamanhos planejados: padrão kg inalterado, g só converte unidade Kg", () => {
  assert.equal(formatBatchSizesPhrase([12.5], "Kg"), "1 corrida de 12,5 Kg");
  assert.equal(formatBatchSizesPhrase([12.5], "Kg", "g"), "1 corrida de 12.500 g");
  assert.equal(formatBatchSizesPhrase([100, 100, 50], "Un", "g"), "2 cheias de 100 Un + 1 parcial de 50 Un");
  assert.equal(formatBatchSizesPhrase([100, 100, 50], "Un"), "2 cheias de 100 Un + 1 parcial de 50 Un");
  assert.equal(formatBatchSizesPhrase([], "Kg", "g"), "");
});

test("a conversão é só de exibição: o documento (dados) não muda ao renderizar em g", () => {
  const before = JSON.stringify(document);
  html("g");
  html("kg");
  assert.equal(JSON.stringify(document), before);
});

test("ficha 80 mm: ficha de MPI (peso de insumo) converte; ficha de produto (pedido) não converte", () => {
  const tickets = buildThermalTickets(document);
  const mpi = tickets.find((ticket) => ticket.kind === "ingredient");
  const product = tickets.find((ticket) => ticket.kind === "product");
  assert.ok(mpi && product);
  assert.equal(formatDisplayQuantity(mpi.items[0].estimatedQuantity, mpi.items[0].unit, "g", { maximumFractionDigits: 3 }), "234 g");
  assert.equal(formatDisplayQuantity(mpi.items[0].estimatedQuantity, mpi.items[0].unit, "kg", { maximumFractionDigits: 3 }), "0,234 Kg");
});
