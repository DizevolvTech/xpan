import type { ProductionSheetDocument } from "@/lib/printing-documents";
import { buildBatchTicketCode, buildBatchTickets, buildProductionBatchSections } from "@/lib/printing/batch-tickets";

/**
 * Código lido pelo QR/código de barras da ficha: `OP` + código da OP sem hífens + `-Bnn` (batida).
 * É o formato da planilha do cliente (OP260902011-B01). Quando a OP tem mais de um produto ou MPI,
 * entra `-Pn-` (n = posição da seção) para duas fichas nunca terem o mesmo código.
 */
export function buildThermalTicketCode(opCode: string, sectionIndex: number, sectionCount: number, batchNumber: number) {
  return buildBatchTicketCode(opCode, sectionIndex, sectionCount, batchNumber);
}

/** Separa "COD · Nome" (como a receita guarda o rótulo) em código e nome. Sem código: só o nome. */
export function splitRecipeLabel(label: string): { code: string; name: string } {
  const at = label.indexOf(" · ");
  return at > 0 ? { code: label.slice(0, at).trim(), name: label.slice(at + 3).trim() } : { code: "", name: label.trim() };
}

/** Soma o peso (kg) das linhas em unidade de massa; Un e outras não entram (não são peso). */
export function sumTicketWeightKg(items: Array<{ estimatedQuantity: number; unit: string }>) {
  return Math.round(items.reduce((sum, row) => sum + (row.unit === "Kg" ? row.estimatedQuantity : row.unit === "g" ? row.estimatedQuantity / 1000 : 0), 0) * 1000) / 1000;
}

/**
 * Peso da ficha: a soma das linhas, mas quando ela só difere da carga da batida por arredondamento
 * (80,001 x 80,000 kg) vale a CARGA — o número que a OP e os blocos mostram.
 */
export function resolveTicketWeightKg(ticket: { items: Array<{ estimatedQuantity: number; unit: string }>; batchKg: number }) {
  const sum = sumTicketWeightKg(ticket.items);
  return ticket.batchKg > 0 && Math.abs(sum - ticket.batchKg) <= 0.005 ? ticket.batchKg : sum;
}

export function buildThermalTickets(document: ProductionSheetDocument, opCode = "") {
  // Mesmas fichas da A4 de produção (uma por batida) — ver `printing/batch-tickets.ts`.
  return buildBatchTickets(buildProductionBatchSections(document), opCode);
}

const COMPACT_NAME_MAX = 22;

/**
 * Cartão #239: nome do insumo na 80 mm — o nome REDUZIDO do cadastro; sem ele, o nome completo
 * cortado na última palavra inteira que cabe (com "…"), para a linha não passar de uma.
 */
export function compactIngredientName(name: string, shortName?: string | null, max = COMPACT_NAME_MAX) {
  const short = shortName?.trim();
  if (short) {
    return short;
  }
  const full = name.trim();
  if (full.length <= max) {
    return full;
  }
  const cut = full.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace >= Math.floor(max / 2) ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}
