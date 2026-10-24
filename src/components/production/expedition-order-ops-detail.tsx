"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import type { OrderOpProgress } from "@/lib/expedition-pending";
import { getProductionOrderNavKey } from "@/lib/factory-kanban";

/**
 * Detalhe do pedido na Expedição: OPs que alimentam o pedido, o que falta e os produtos
 * deste pedido em cada uma. Abre na própria lista (sem trocar de página).
 */
export function ExpeditionOrderOpsDetail({
  rows,
  opBasePath,
  anchorDate,
}: {
  rows: OrderOpProgress[];
  opBasePath: "/gestor-fabrica/ordens-producao" | "/chao-fabrica/ordens-producao";
  anchorDate: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-3 text-sm text-muted-foreground">
        Nenhuma OP gerada ainda para este pedido. Ele precisa ser liberado para produção.
      </p>
    );
  }
  const missing = rows.filter((row) => !row.ready).length;
  return (
    <div className="space-y-2 py-3" data-stop-row-click="true">
      <p className="text-xs font-semibold text-foreground">
        {missing === 0 ? "Todas as OPs deste pedido estão prontas." : `Faltam ${missing} de ${rows.length} OPs para este pedido:`}
      </p>
      <ul className="grid gap-2 lg:grid-cols-2">
        {rows.map((row) => (
          <li
            key={row.opId}
            className={`rounded-lg border px-3 py-2 text-sm ${row.ready ? "border-border/60 bg-card/60 opacity-75" : "border-warning/50 bg-warning/10"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`${opBasePath}/${encodeURIComponent(getProductionOrderNavKey(row.navOp))}?ref=${anchorDate}`}
                className="font-mono text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                {row.opCode}
              </Link>
              <span className="text-xs text-muted-foreground">
                {row.lineName} · produção {row.productionDateLabel}
              </span>
              <span className="flex-1" />
              <StatusBadge status={row.status} />
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {row.products.map((product, index) => (
                <li key={index} className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="text-foreground">{product.productName}</span>
                  <span>
                    {product.quantity} {product.unit}
                  </span>
                  <span>· {Math.round(product.progress)}%</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
