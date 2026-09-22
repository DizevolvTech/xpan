import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { ThermalProductionSheet } from "../src/components/printing/thermal-production-sheet";
import { computePreWeighBatchSplit } from "../src/lib/production-batches";
import type { ProductionSheetDocument } from "../src/lib/printing-documents";

// tsx executes the Next JSX source outside the Next compiler for this isolated proof.
Object.assign(globalThis, { React });
async function main() {
  const document: ProductionSheetDocument = { deliveryGap: { days: [1], label: "Dia+1" }, ingredientSections: [], productSections: [{
    productId: "bolo", productCode: "0009", productName: "Bolo de Laranja com cobertura e nome comprido para conferir a quebra de linha",
    plannedKg: 125, requestedQuantity: 250, requestedUnit: "Un", unitWeightKg: .5, unitsCount: 250,
    batchSplit: computePreWeighBatchSplit({ totalKg: 125, capacityPerBatch: 100, salesToKgFactor: .5, salesUnit: "Un" }),
    items: [{ key: "farinha", sourceType: "ingrediente", kind: "ingrediente", label: "Farinha de trigo especial com descrição longa e código 12345678901234567890123456789012345678901234567890", stage: "massa", unit: "Kg", estimatedQuantity: 25, quantityPerUnit: .1 },
      { key: "agua", sourceType: "ingrediente", kind: "ingrediente", label: "Água", stage: "massa", unit: "Kg", estimatedQuantity: 12.5, quantityPerUnit: .05 }],
  }] };
  const html = renderToStaticMarkup(React.createElement(ThermalProductionSheet, { document, code: "OP-260922-001", line: "Bolos", productionDate: "22/09/2026", deliveryDate: "23/09/2026" }));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
    await page.setContent(`<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><body>${html}</body></html>`);
    assert.equal(await page.locator(".thermal-ticket").count(), 3);
    assert.match(await page.locator(".thermal-ticket").last().innerText(), /Complementar/);
    const verify = async () => {
      const errors = await page.locator(".thermal-ticket").evaluateAll(tickets => tickets.flatMap(ticket => {
        const box = ticket.getBoundingClientRect();
        return [...ticket.querySelectorAll("h1, p, td, th, footer")].filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.right > box.right + 1 || rect.left < box.left - 1 || el.scrollWidth > el.clientWidth + 1;
        }).map(el => el.textContent);
      }));
      assert.deepEqual(errors, []);
    };
    await verify();
    await mkdir("artifacts/xpan", { recursive: true });
    await page.screenshot({ path: "artifacts/xpan/thermal-preview.png", fullPage: true });
    await page.emulateMedia({ media: "print" });
    await verify();
    await page.pdf({ path: "artifacts/xpan/thermal-80mm.pdf", width: "80mm", height: "200mm", printBackground: true, displayHeaderFooter: false });
    console.log("3 tickets; complementary 50 units; no horizontal overflow in screen or print.");
  } finally { await browser.close(); }
}
void main();
