"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/shared/status-badge";
import type { OrderOpProgress, UnplannedOrderProduct } from "@/lib/expedition-pending";
import { getProductionOrderNavKey } from "@/lib/factory-kanban";

/**
 * Detalhe do pedido na Expedição: OPs que alimentam o pedido, o que falta e os produtos
 * deste pedido em cada uma. Abre na própria lista (sem trocar de página).
 */
export function ExpeditionOrderOpsDetail({
  rows,
  unplanned = [],
  opBasePath,
  anchorDate,
}: {
  rows: OrderOpProgress[];
  /** Produtos do pedido fora de qualquer OP (seguram o % abaixo de 100). */
  unplanned?: UnplannedOrderProduct[];
  opBasePath: "/gestor-fabrica/ordens-producao" | "/chao-fabrica/ordens-producao";
  anchorDate: string;
}) {
  const unplannedBlock =
    unplanned.length > 0 ? (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
        <p className="text-xs font-semibold text-destructive">
          {unplanned.length} produto(s) deste pedido sem OP — não têm dia de produção possível com o cadastro atual:
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {unplanned.map((product, index) => (
            <li key={index}>
              <span className="font-mono">{product.productCode}</span>{" "}
              <span className="text-foreground">{product.productName}</span> · {product.quantity} {product.unit}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Confira os dias de produção do produto e o cronograma da linha.
        </p>
      </div>
    ) : null;
  if (rows.length === 0) {
    if (unplannedBlock) return <div className="py-3" data-stop-row-click="true">{unplannedBlock}</div>;
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
      {unplannedBlock}
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
