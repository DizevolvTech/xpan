"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, ListTree, Loader2, PackageCheck } from "lucide-react";

import { batchReleaseBlockedReason, useBatchRelease } from "@/components/production/use-batch-release";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PlannedOrderItem } from "@/lib/factory-planning/types";
import { sumOrderItemsByProduct } from "@/lib/order-product-sum";
import type { BatchGroupView, OrderBatchOverview } from "@/lib/supabase-data/order-batch-overview";
import { formatKgValue } from "@/lib/utils";
import { takeSeededOrderBatchesOverview } from "@/components/production/order-batches-overview-seed";

function br(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return year && month && day ? `${day}/${month}` : dateKey;
}

const STATE_LABEL: Record<BatchGroupView["state"], string> = {
  aguardando_lojas: "Aguardando lojas",
  pronto_para_liberar: "Pronto para liberar",
  liberado: "Liberado",
};

/**
 * Painel de lotes da tela de Pedidos (reunião 22/10, bloco 7): lotes abertos por data de
 * entrega, % de lojas que pediram, prazo, liberados; botão Liberar lote; soma por produto
 * (bloco 8); aviso de lote que o cronograma pede e não foi aberto.
 */
export function OrderBatchesPanel({
  orderItems,
  reloadKey,
  onChanged,
  onOpenBatchForDate,
  onGroupsChange,
}: {
  orderItems: PlannedOrderItem[];
  reloadKey: number;
  onChanged: () => Promise<void> | void;
  onOpenBatchForDate: (deliveryDate: string, storeIds: string[]) => void;
  /** Quadro #4 (27/10): grupos por data, para a lista de Pedidos agrupar e liberar por lote. */
  onGroupsChange?: (groups: BatchGroupView[]) => void;
}) {
  const [overview, setOverview] = useState<OrderBatchOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sumGroup, setSumGroup] = useState<BatchGroupView | null>(null);

  const load = useCallback(async () => {
    try {
      const seeded = takeSeededOrderBatchesOverview();
      const response = seeded ? null : await fetch("/api/order-batches/overview", { cache: "no-store" });
      const data =
        seeded ??
        ((await response?.json().catch(() => null)) as (OrderBatchOverview & { message?: string }) | null);
      if ((response && !response.ok) || !data) throw new Error(data?.message ?? "Falha ao carregar os lotes.");
      setOverview(data);
      setLoadError(null);
      onGroupsChange?.(data.groups);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Falha ao carregar os lotes.");
    }
  }, [onGroupsChange]);

  useEffect(() => {
    // Busca assíncrona: o setState acontece depois da resposta, não no efeito.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, reloadKey]);

  const visibleGroups = useMemo(
    () => (overview?.groups ?? []).filter((group) => group.state !== "liberado"),
    [overview],
  );

  const { releaseGroup, busyDate } = useBatchRelease(async () => {
    await onChanged();
    await load();
  });


  const sumRows = useMemo(() => {
    if (!sumGroup) return [];
    const codes = new Set(sumGroup.orders.map((order) => order.orderCode));
    return sumOrderItemsByProduct(orderItems.filter((item) => codes.has(item.orderCode)));
  }, [orderItems, sumGroup]);

  if (!overview && !loadError) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-panel/40 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Carregando lotes…
      </div>
    );
  }

  return (
    <section aria-label="Lotes de pedidos" className="space-y-1.5">
      {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}

      {(overview?.missing ?? []).length > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-warning/50 bg-warning/10 px-2 py-1 text-xs"
        >
          <AlertTriangle className="size-3.5 shrink-0 text-warning-foreground" aria-hidden />
          <strong>Lote não aberto:</strong>
          {(overview?.missing ?? []).map((item) => (
            <span
              key={item.deliveryDate}
              className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-card px-1.5 py-0.5"
              title={`Prazo das lojas ${br(item.deadline.dateKey)} às ${item.deadline.time} · ${item.storeNames.length} loja(s) no cronograma`}
            >
              entrega {br(item.deliveryDate)}
              <span className="text-muted-foreground">
                (prazo {br(item.deadline.dateKey)} {item.deadline.time}, faltam {Math.max(1, Math.round(item.hoursLeft))} h)
              </span>
              <Button type="button" size="xs" className="h-6" onClick={() => onOpenBatchForDate(item.deliveryDate, item.storeIds)}>
                <CalendarPlus className="size-3.5" aria-hidden />
                Abrir lote
              </Button>
            </span>
          ))}
        </div>
      ) : null}

      {visibleGroups.length === 0 ? (
        <p className="rounded-lg border border-border/70 bg-panel/40 px-2 py-1 text-xs text-muted-foreground">
          Nenhum lote aberto esperando liberação.
        </p>
      ) : (
        // Quadro #2 (27/10): lotes numa tabela compacta (uma linha por entrega), como planilha.
        // Até ~4 entregas à vista; o resto rola dentro da caixa (não empurra a lista de pedidos).
        <div className="max-h-[10.5rem] overflow-auto rounded-lg border border-border/80">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead className="sticky top-0 z-[1] bg-panel text-left text-[11px] text-muted-foreground">
              <tr className="[&>th]:whitespace-nowrap [&>th]:px-2 [&>th]:py-1 [&>th]:font-semibold">
                <th>Lote · entrega</th>
                <th>Lojas que pediram</th>
                <th>Prazo das lojas</th>
                <th className="w-full">Faltam</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((group) => {
                const key = group.deliveryDate;
                const ready = group.state === "pronto_para_liberar";
                return (
                  <tr
                    key={key}
                    className={`border-t border-border/70 [&>td]:px-2 [&>td]:py-1 [&>td]:align-middle ${ready ? "bg-success/5" : "bg-card"}`}
                  >
                    <td className="whitespace-nowrap">
                      <span className="font-semibold">Entrega {br(group.deliveryDate)}</span>{" "}
                      <span
                        className={`ml-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold ${ready ? "bg-success/15 text-success-foreground" : "bg-info/10 text-info"}`}
                      >
                        {STATE_LABEL[group.state]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-panel" aria-hidden>
                          <span className="block h-full rounded-full bg-info" style={{ width: `${group.percent}%` }} />
                        </span>
                        <span className="font-semibold tabular-nums">
                          {group.orderedStores}/{group.totalStores} ({group.percent}%)
                        </span>
                      </span>
                      {group.releasedOrders > 0 ? (
                        <span className="ml-1 text-muted-foreground">· {group.releasedOrders} liberado(s)</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap">
                      {br(group.deadline.dateKey)} às {group.deadline.time}
                      {group.deadlinePassed ? <span className="text-muted-foreground"> · encerrado</span> : null}
                    </td>
                    <td className="max-w-0 truncate text-muted-foreground" title={group.missingStoreNames.join(", ")}>
                      {group.missingStoreNames.length > 0
                        ? `${group.deadlinePassed ? "Não pediram" : "Faltam"} ${group.missingStoreNames.length}: ${group.missingStoreNames.join(", ")}`
                        : "Todas pediram"}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <span className="inline-flex gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={group.orders.length === 0}
                          onClick={() => setSumGroup(group)}
                        >
                          <ListTree className="size-3.5" aria-hidden />
                          Soma por produto
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant={ready ? "default" : "outline"}
                          disabled={busyDate !== null || batchReleaseBlockedReason(group) !== null}
                          onClick={() => void releaseGroup(group)}
                          title={batchReleaseBlockedReason(group) ?? undefined}
                        >
                          {busyDate === key ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <PackageCheck className="size-3.5" aria-hidden />
                          )}
                          Liberar lote ({group.pendingOrderIds.length})
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={sumGroup !== null} onOpenChange={(open) => (!open ? setSumGroup(null) : undefined)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Soma por produto — entrega em {sumGroup ? br(sumGroup.deliveryDate) : ""}</DialogTitle>
            <DialogDescription>
              Total pedido pelas lojas deste lote ({sumGroup?.orders.length ?? 0} pedido(s)), antes de liberar.
            </DialogDescription>
          </DialogHeader>
          {sumRows.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhum item pedido ainda.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-border/70">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-panel text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Quantidade</th>
                    <th className="px-3 py-2 text-right">Kg</th>
                    <th className="px-3 py-2 text-right">Lojas</th>
                  </tr>
                </thead>
                <tbody>
                  {sumRows.map((row) => (
                    <tr key={`${row.productId}|${row.unit}`} className="border-t border-border/60">
                      <td className="px-3 py-1.5">
                        <span className="font-mono text-xs text-muted-foreground">{row.productCode}</span> {row.productName}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {row.quantity.toLocaleString("pt-BR")} {row.unit}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatKgValue(row.kg)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{row.stores}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
