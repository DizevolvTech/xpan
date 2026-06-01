"use client";

import Link from "next/link";

import { PaginatedSection } from "@/components/shared/paginated-section";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getProductionOrderNavKey } from "@/lib/factory-kanban";
import { type ProductionItemStatus, type ProductionOrderRow } from "@/lib/order-planning";
import {
  getNextProductionActionLabel,
  getNextProductionItemStatus,
  getPreviousProductionActionLabel,
  getPreviousProductionItemStatus,
  getProductionStatusLabel,
} from "@/lib/production-workflow";
import { formatKgLabel, formatKgValue } from "@/lib/utils";

type ProductionOrderStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  op: ProductionOrderRow | null;
  referenceDate: string;
  detailHrefBase: string;
  pendingItemKey: string | null;
  error: string | null;
  onUpdateStatus: (productionItemKey: string, status: ProductionItemStatus) => void | Promise<void>;
};

export function ProductionOrderStatusDialog({
  open,
  onOpenChange,
  op,
  referenceDate,
  detailHrefBase,
  pendingItemKey,
  error,
  onUpdateStatus,
}: ProductionOrderStatusDialogProps) {
  return (
    <Dialog open={open && Boolean(op)} onOpenChange={onOpenChange}>
      <DialogContent size="3xl" className="max-h-[92vh] overflow-y-auto">
        {op ? (
          <>
            <DialogHeader>
              <DialogTitle>{op.code} · atualização rápida</DialogTitle>
              <DialogDescription>
                Avance ou volte o estágio de cada produto sem sair da fila. O status da OP e da expedição recalcula automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border/80 bg-panel/30 p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produção</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{op.productionDateLabel}</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-panel/30 p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status da OP</p>
                <div className="mt-1">
                  <StatusBadge status={op.status} />
                </div>
              </div>
              <div className="rounded-lg border border-border/80 bg-panel/30 p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Carga total</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatKgLabel(op.totalKg)}</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-panel/30 p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">% conclusão</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{op.progress.toFixed(1)}%</p>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                {error}
              </div>
            ) : null}

            <PaginatedSection items={op.items} label="produtos da OP" initialPageSize={6}>
              {(paginatedItems) => (
                <div className="overflow-x-auto rounded-xl border border-border/80">
                  <table className="w-full min-w-[920px] border-collapse">
                    <thead className="bg-panel">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Carga (Kg)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Pedidos origem</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Recebimento</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Venda</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status operacional</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item) => {
                    const previousStatus = getPreviousProductionItemStatus(item.status, item.preparationStages);
                    const nextStatus = getNextProductionItemStatus(item.status, item.preparationStages);
                    const previousActionLabel = getPreviousProductionActionLabel(item.status, item.preparationStages);
                    const nextActionLabel = getNextProductionActionLabel(item.status, item.preparationStages);
                    const sourceDates = op.sourceItems.filter(
                      (sourceItem) => sourceItem.productionItemKey === item.productionItemKey,
                    );
                    const deliveryLabel =
                      sourceDates.length === 0
                        ? "-"
                        : Array.from(new Set(sourceDates.map((sourceItem) => sourceItem.deliveryDateLabel))).join(" · ");
                    const saleLabel =
                      sourceDates.length === 0
                        ? "-"
                        : Array.from(new Set(sourceDates.map((sourceItem) => sourceItem.saleDateLabel))).join(" · ");

                        return (
                          <tr key={item.productId}>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <div className="font-medium text-foreground">
                            {item.productCode} · {item.productName}
                          </div>
                          <div className="text-xs text-muted-foreground">{item.sourceItemsCount} itens de origem</div>
                        </td>
                        <td className="whitespace-nowrap border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {formatKgValue(item.totalKg)}
                        </td>
                        <td className="whitespace-nowrap border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {item.sourceItemsCount}
                        </td>
                        <td className="whitespace-nowrap border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {deliveryLabel}
                        </td>
                        <td className="whitespace-nowrap border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {saleLabel}
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <div className="space-y-2">
                            <StatusBadge status={item.status} />
                            <div className="text-xs text-muted-foreground">{item.progress.toFixed(1)}% concluído</div>
                          </div>
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {previousStatus ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={pendingItemKey === item.productionItemKey}
                                onClick={() => void onUpdateStatus(item.productionItemKey, previousStatus)}
                              >
                                {previousActionLabel ?? `Voltar para ${getProductionStatusLabel(previousStatus)}`}
                              </Button>
                            ) : null}
                            {nextStatus ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={pendingItemKey === item.productionItemKey}
                                onClick={() => void onUpdateStatus(item.productionItemKey, nextStatus)}
                              >
                                {nextActionLabel ?? `Avançar para ${getProductionStatusLabel(nextStatus)}`}
                              </Button>
                            ) : (
                              <span className="text-xs font-semibold text-success-foreground">Fluxo concluído</span>
                            )}
                          </div>
                        </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </PaginatedSection>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button asChild type="button">
                <Link href={`${detailHrefBase}/${encodeURIComponent(getProductionOrderNavKey(op))}?ref=${referenceDate}`}>Abrir detalhe completo</Link>
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
