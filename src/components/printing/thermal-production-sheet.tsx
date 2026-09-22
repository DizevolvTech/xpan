"use client";

import { Button } from "@/components/ui/button";
import { groupPrintRowsByStage, type ProductionSheetDocument } from "@/lib/printing-documents";
import { buildThermalTickets } from "@/lib/thermal-production";
import { formatLocaleNumber } from "@/lib/utils";

export function ThermalProductionSheet({ document, code, line, productionDate, deliveryDate }: {
  document: ProductionSheetDocument; code: string; line: string; productionDate: string; deliveryDate: string;
}) {
  const tickets = buildThermalTickets(document);
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
      .thermal-ticket footer { margin-top: 12px; border-top: 1px solid; padding-top: 6px; }
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
      <Button onClick={() => window.print()}>Imprimir 80 mm</Button>
      <Button variant="outline" onClick={() => { const url = new URL(window.location.href); url.searchParams.delete("format"); window.location.assign(url); }}>Abrir A4</Button>
    </div>
    {tickets.map(ticket => <article className="thermal-ticket" key={ticket.key}>
      <h1>{ticket.productCode} · {ticket.productName}</h1>
      <p><strong>OP: {code}</strong></p><p>Linha: {line}</p>
      <p>Produção: {productionDate}</p><p>Entrega: {deliveryDate}</p>
      <h2>Batida {ticket.number} de {ticket.count}{ticket.complementary ? " — Complementar" : ""}</h2>
      <p><strong>Quantidade: {formatLocaleNumber(ticket.quantity)} {ticket.unit}</strong></p>
      <p>Total do produto na OP: {formatLocaleNumber(ticket.totalQuantity)} {ticket.unit}</p>
      {groupPrintRowsByStage(ticket.items, ticket.recipeStageConfig).map(group => <section key={group.stage}>
        <h2>{group.label}</h2>
        <table><thead><tr><th>Insumo / massa</th><th>Quantidade</th></tr></thead><tbody>
          {group.rows.map(row => <tr key={row.key}><td>□ {row.label}{row.notes && <div>{row.notes}</div>}</td><td>{formatLocaleNumber(row.estimatedQuantity, { maximumFractionDigits: 3 })} {row.unit}</td></tr>)}
        </tbody></table>
        {group.instructions && <p style={{ whiteSpace: "pre-line" }}>{group.instructions}</p>}
      </section>)}
      <footer>{code}-{ticket.productCode}-{ticket.key}<p>Produzido por: __________________</p></footer>
    </article>)}
  </main>;
}
