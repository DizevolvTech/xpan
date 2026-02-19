"use client";

import {
  formatDateKeyBr,
  type ExpeditionRow,
  type OrderStatus,
  type PlannedOrderItem,
  type PlannedOrderRow,
  type ProductionOrderRow,
} from "@/lib/order-planning";
import { aggregateExpeditionItems } from "@/lib/expedition-aggregation";
import { aggregateOrderItems } from "@/lib/order-item-aggregation";

type PrintSection = {
  title: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
  note?: string;
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  agendado: "Agendado",
  em_producao: "Em Produção",
  em_espera: "Em Espera",
  rota_entrega: "Rota de Entrega",
};

function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildTableHtml(table: NonNullable<PrintSection["table"]>) {
  const headersHtml = table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const rowsHtml = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  return `
    <table>
      <thead>
        <tr>${headersHtml}</tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

function printSections(params: {
  title: string;
  subtitle: string;
  referenceDate: string;
  sections: PrintSection[];
}) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1100,height=780");
  if (!popup) {
    return;
  }

  const printedAt = new Date();
  const generatedAt = `${printedAt.toLocaleDateString("pt-BR")} ${printedAt.toLocaleTimeString("pt-BR")}`;

  const sectionsHtml = params.sections
    .map((section) => {
      const tableHtml = section.table ? buildTableHtml(section.table) : "";
      const noteHtml = section.note ? `<p class="note">${escapeHtml(section.note)}</p>` : "";

      return `
        <section>
          <h2>${escapeHtml(section.title)}</h2>
          ${noteHtml}
          ${tableHtml}
        </section>
      `;
    })
    .join("");

  popup.document.open();
  popup.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(params.title)}</title>
        <style>
          :root {
            color-scheme: light;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 24px;
            color: #111827;
            font-family: "Segoe UI", Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            background: #ffffff;
          }

          header {
            margin-bottom: 18px;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 10px;
          }

          h1 {
            margin: 0 0 4px;
            font-size: 18px;
          }

          .subtitle {
            margin: 0 0 2px;
            color: #374151;
            font-size: 13px;
            font-weight: 600;
          }

          .meta {
            margin: 0;
            color: #6b7280;
            font-size: 11px;
          }

          section {
            margin-bottom: 16px;
            page-break-inside: avoid;
          }

          h2 {
            margin: 0 0 8px;
            color: #1f2937;
            font-size: 14px;
          }

          .note {
            margin: 0 0 8px;
            color: #4b5563;
            font-size: 11px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            border: 1px solid #d1d5db;
            padding: 6px;
            vertical-align: top;
            text-align: left;
          }

          th {
            background: #f3f4f6;
            font-weight: 700;
          }

          @media print {
            body {
              padding: 10mm;
            }
          }
        </style>
      </head>
      <body>
        <header>
          <h1>${escapeHtml(params.title)}</h1>
          <p class="subtitle">${escapeHtml(params.subtitle)}</p>
          <p class="meta">Referência da fábrica: ${escapeHtml(params.referenceDate)} | Gerado em: ${escapeHtml(generatedAt)}</p>
        </header>
        ${sectionsHtml}
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.onafterprint = () => popup.close();
  popup.print();
}

export function printProductionOrder(op: ProductionOrderRow, referenceDate: string) {
  printSections({
    title: `Ordem de Produção ${op.code}`,
    subtitle: `${op.sectorName} | ${op.lineName} | ${op.scheduleName}`,
    referenceDate,
    sections: [
      {
        title: "Resumo",
        table: {
          headers: ["Campo", "Valor"],
          rows: [
            ["OP", op.code],
            ["Data de Produção", op.productionDateLabel],
            ["Setor", op.sectorName],
            ["Linha", op.lineName],
            ["Sublinha", op.scheduleName],
            ["Produtos na OP", String(op.items.length)],
            ["Itens consolidados", String(op.itemsCount)],
            ["Total (Kg)", String(op.totalKg)],
            ["Status", formatOrderStatus(op.status)],
          ],
        },
      },
      {
        title: "Itens Consolidados",
        table: {
          headers: ["Produto", "Total (Kg)"],
          rows: op.items.map((item) => [`${item.productCode} · ${item.productName}`, String(item.totalKg)]),
        },
      },
    ],
  });
}

export function printSectorProductionOrders(sectorName: string, ops: ProductionOrderRow[], referenceDate: string) {
  printSections({
    title: `Ordens de Produção por Setor`,
    subtitle: sectorName,
    referenceDate,
    sections: [
      {
        title: "OPs do Setor",
        note: `Total de OPs: ${ops.length}`,
        table: {
          headers: ["OP", "Data", "Linha", "Sublinha", "Produtos", "Total (Kg)", "Status"],
          rows: ops.map((op) => [
            op.code,
            op.productionDateLabel,
            op.lineName,
            op.scheduleName,
            String(op.items.length),
            String(op.totalKg),
            formatOrderStatus(op.status),
          ]),
        },
      },
    ],
  });
}

export function printExpeditionSeparation(expedition: ExpeditionRow, referenceDate: string) {
  const aggregatedItems = aggregateExpeditionItems(expedition.items);

  printSections({
    title: `Separação de Pedido ${expedition.orderCode}`,
    subtitle: `${expedition.storeName} | Entrega: ${expedition.deliveryDateLabel}`,
    referenceDate,
    sections: [
      {
        title: "Resumo",
        table: {
          headers: ["Campo", "Valor"],
          rows: [
            ["Pedido", expedition.orderCode],
            ["Loja", expedition.storeName],
            ["Data de Entrega", expedition.deliveryDateLabel],
            ["Produtos consolidados", String(aggregatedItems.length)],
            ["Itens de origem", String(expedition.itemsCount)],
            ["Total (Kg)", String(expedition.totalKg)],
            ["Status", formatOrderStatus(expedition.status)],
          ],
        },
      },
      {
        title: "Itens para Separação",
        table: {
          headers: ["Produto", "Qtd Pedida", "Kg Interno", "Qtd Expedição"],
          rows: aggregatedItems.map((item) => [
            `${item.productCode} · ${item.productName}`,
            `${item.requestedQuantity} ${item.requestedUnit}`,
            String(item.internalKg),
            `${item.expeditionQuantity} ${item.expeditionUnit}`,
          ]),
        },
      },
    ],
  });
}

export function printOrderSummary(
  order: PlannedOrderRow,
  items: PlannedOrderItem[],
  relatedOps: ProductionOrderRow[],
  referenceDate: string,
) {
  const aggregatedItems = aggregateOrderItems(items);

  printSections({
    title: `Pedido ${order.code}`,
    subtitle: `${order.storeName} | Recebimento: ${order.deliveryDateLabel}`,
    referenceDate,
    sections: [
      {
        title: "Resumo",
        table: {
          headers: ["Campo", "Valor"],
          rows: [
            ["Pedido", order.code],
            ["Loja", order.storeName],
            ["Data do Pedido", order.orderedAt],
            ["Recebimento", order.deliveryDateLabel],
            ["Status", formatOrderStatus(order.status)],
            ["Produtos consolidados", String(aggregatedItems.length)],
            ["Itens de origem", String(items.length)],
            ["Total (Kg)", String(order.totalKg)],
          ],
        },
      },
      {
        title: "Itens do Pedido",
        table: {
          headers: ["Produto", "Qtd Loja", "Kg Interno", "Setor", "Linha", "Fabricação", "Entrega", "Qtd Expedição"],
          rows: aggregatedItems.map((item) => [
            `${item.productCode} · ${item.productName}`,
            `${item.requestedQuantity} ${item.requestedUnit}`,
            String(item.internalKg),
            item.sectorName,
            item.lineName,
            item.productionDate ? formatDateKeyBr(item.productionDate) : "Sem agenda",
            formatDateKeyBr(item.deliveryDate),
            `${item.expeditionQuantity} ${item.expeditionUnit}`,
          ]),
        },
      },
      {
        title: "OPs Relacionadas",
        table: {
          headers: ["OP", "Produção", "Setor", "Linha", "Sublinha", "Total (Kg)", "Status"],
          rows: relatedOps.map((op) => [
            op.code,
            op.productionDateLabel,
            op.sectorName,
            op.lineName,
            op.scheduleName,
            String(op.totalKg),
            formatOrderStatus(op.status),
          ]),
        },
      },
    ],
  });
}
