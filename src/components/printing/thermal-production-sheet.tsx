"use client";

import { Button } from "@/components/ui/button";
import { WeightUnitToggle } from "@/components/shared/weight-unit-toggle";
import { groupPrintRowsByStage, type ProductionSheetDocument } from "@/lib/printing-documents";
import { buildThermalTickets, splitRecipeLabel, sumTicketWeightKg } from "@/lib/thermal-production";
import { toSVG } from "bwip-js/browser";
import { useMemo } from "react";
import { formatLocaleNumber } from "@/lib/utils";
import { formatDisplayQuantity, type WeightDisplayUnit } from "@/lib/weight-display";

/** Ficha de MPI mostra peso de insumo (converte); ficha de produto mostra o pedido (não converte). */
function formatTicketQuantity(value: number, unit: string, kind: "ingredient" | "product", weight: WeightDisplayUnit) {
  return kind === "ingredient"
    ? formatDisplayQuantity(value, unit, weight, { maximumFractionDigits: 3 })
    : `${formatLocaleNumber(value)} ${unit}`;
}

/** QR e código de barras da ficha: o MESMO texto nos dois (código da OP + batida), como na planilha. */
function TicketCodes({ value }: { value: string }) {
  const svgs = useMemo(() => ({
    qr: toSVG({ bcid: "qrcode", text: value, scale: 2, includetext: false }),
    bar: toSVG({ bcid: "code128", text: value, scale: 2, height: 9, includetext: false }),
  }), [value]);
  return <div className="ticket-codes">
    <div className="ticket-qr" aria-label={`QR ${value}`} dangerouslySetInnerHTML={{ __html: svgs.qr }} />
    <div className="ticket-bar"><div aria-label={`Código de barras ${value}`} dangerouslySetInnerHTML={{ __html: svgs.bar }} /><small>{value}</small></div>
  </div>;
}

export function ThermalProductionSheet({ document, code, line, productionDate, deliveryDate, weight = "kg", onWeightChange }: {
  document: ProductionSheetDocument; code: string; line: string; productionDate: string; deliveryDate: string;
  /** Unidade de exibição do peso (kg/g). Padrão kg = ficha idêntica à de sempre. */
  weight?: WeightDisplayUnit;
  /** Quando informado, mostra o seletor de unidade na barra (que não sai na impressão). */
  onWeightChange?: (next: WeightDisplayUnit) => void;
}) {
  const tickets = useMemo(() => buildThermalTickets(document, code), [document, code]);
  return <main className="thermal-preview">
    <style>{`
      .thermal-preview { padding: 16px; background: #eee; color: #000; min-height: 100vh; }
      .thermal-toolbar { margin: 0 auto 16px; max-width: 600px; display: flex; flex-wrap: wrap; gap: 12px; }
      .thermal-ticket { box-sizing: border-box; width: 80mm; max-width: 100%; padding: 4mm; margin: 0 auto 16px; background: white; font: 12px/1.35 Arial, sans-serif; overflow-wrap: anywhere; }
      .thermal-ticket h1 { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
      .thermal-ticket h2 { font-size: 14px; font-weight: bold; margin: 8px 0 4px; }
      .thermal-ticket p { margin: 4px 0; }
      .thermal-ticket table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 8px 0; }
      .thermal-ticket th, .thermal-ticket td { border-bottom: 1px dashed #777; padding: 4px 2px; text-align: left; vertical-align: top; }
      .thermal-ticket th:last-child, .thermal-ticket td:last-child { width: 27mm; text-align: right; }
      .thermal-ticket footer { margin-top: 8px; padding-top: 4px; }
      .thermal-ticket .t-head { display: grid; grid-template-columns: 1fr 1fr; gap: 0 6px; font-size: 11px; line-height: 1.3; margin: 2px 0 4px; }
      .thermal-ticket .t-head p { margin: 0; }
      .thermal-ticket .t-head .line { display: inline-block; width: 16mm; border-bottom: 1px solid #000; height: 11px; vertical-align: bottom; }
      .thermal-ticket col.c-code { width: 15mm; } .thermal-ticket col.c-qty { width: 20mm; }
      .thermal-ticket td.code { font-size: 10px; word-break: break-all; }
      .thermal-ticket .ticket-codes { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 6px; }
      .thermal-ticket .ticket-qr svg { width: 17mm; height: 17mm; display: block; }
      .thermal-ticket .ticket-bar { flex: 1; text-align: center; min-width: 0; }
      .thermal-ticket .ticket-bar svg { width: 100%; height: 11mm; display: block; }
      .thermal-ticket .ticket-bar small { font-size: 9px; letter-spacing: .04em; }
      .thermal-ticket .sign { margin-top: 6px; border-bottom: 1px solid #000; padding-bottom: 14px; font-size: 11px; }
      @media print {
        @page { size: auto; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
        .thermal-preview { padding: 0; background: white; }
        .thermal-toolbar { display: none !important; }
        .thermal-ticket { margin: 0; max-width: 80mm; break-after: page; }
        .thermal-ticket:last-child { break-after: auto; }
        .thermal-ticket tr, .thermal-ticket footer { break-inside: avoid; }
      }
    `}</style>
    <div className="thermal-toolbar">
      <p>Prévia 80 mm · {tickets.length} fichas. Selecione papel de 80 mm, escala 100% e desative cabeçalhos e rodapés na impressão.</p>
      {onWeightChange ? <WeightUnitToggle value={weight} onChange={onWeightChange} /> : null}
      <Button onClick={() => window.print()}>Imprimir 80 mm</Button>
      <Button variant="outline" onClick={() => { const url = new URL(window.location.href); url.searchParams.delete("format"); window.location.assign(url); }}>Abrir A4</Button>
    </div>
    {tickets.map(ticket => <article className="thermal-ticket" key={ticket.key}>
      <h1>{ticket.productName}</h1>
      <div className="t-head">
        <p><strong>OP: {code.replace(/^OP-?/i, "")}</strong></p><p>Linha: {line}</p>
        <p>DT Kit: {productionDate}</p><p><strong>Batida: {ticket.number} de {ticket.count}{ticket.complementary ? " (Parcial)" : ""}</strong></p>
        <p>DT Prod: {productionDate}</p><p>Peso: {formatDisplayQuantity(sumTicketWeightKg(ticket.items), "Kg", weight, { maximumFractionDigits: 3 })}</p>
        <p>DT Entrega: {deliveryDate}</p><p>Qtd OP: {formatTicketQuantity(ticket.totalQuantity, ticket.unit, ticket.kind, weight)}</p>
        <p>Usuário: <span className="line" /></p><p>REND: <span className="line" /></p>
      </div>
      <p><strong>Esta batida: {formatTicketQuantity(ticket.quantity, ticket.unit, ticket.kind, weight)}</strong></p>
      {groupPrintRowsByStage(ticket.items, ticket.recipeStageConfig).map(group => <section key={group.stage}>
        <h2>{group.label}</h2>
        <table><colgroup><col className="c-code" /><col /><col className="c-qty" /></colgroup>
        <thead><tr><th>Código</th><th>Insumo / Massa</th><th>Peso</th></tr></thead><tbody>
          {group.rows.map(row => { const { code: rowCode, name } = splitRecipeLabel(row.label); return <tr key={row.key}><td className="code">{rowCode}</td><td>□ {name}{row.notes && <div>{row.notes}</div>}{row.alsoPrintedOn && <div>Também em: {row.alsoPrintedOn}</div>}</td><td>{formatDisplayQuantity(row.estimatedQuantity, row.unit, weight, { maximumFractionDigits: 3 })}</td></tr>; })}
        </tbody></table>
        {group.instructions && <p style={{ whiteSpace: "pre-line" }}>{group.instructions}</p>}
      </section>)}
      <TicketCodes value={ticket.barcode} />
      <footer><p className="sign">Produzido por:</p></footer>
    </article>)}
  </main>;
}
