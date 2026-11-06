"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Factory, Printer, ShoppingCart, Truck } from "lucide-react";

import { useInRouteModal } from "@/components/shared/route-modal";
import { pushWithProgress } from "@/lib/navigation-progress";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentProfile } from "@/lib/use-current-profile";
import {
  aggregateExpeditionItems,
  getAggregatedExpeditionItemKey,
} from "@/lib/expedition-aggregation";
import { getProductionOrderNavKey } from "@/lib/factory-kanban";
import { useDeliveryExecution } from "@/lib/delivery-execution";
import { getExpeditionVisibleStatus } from "@/lib/delivery-workflow";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

function getChecklistItemKey(item: ReturnType<typeof aggregateExpeditionItems>[number]) {
  // Stable key (productId|requestedUnit) — must match the shared function exactly so
  // check marks survive changes to the product's volatile expeditionUnit.
  return getAggregatedExpeditionItemKey(item);
}

export type FactoryArea = "gestor-fabrica" | "chao-fabrica";

const AREA_LABEL: Record<FactoryArea, string> = {
  "gestor-fabrica": "Gestor de Fábrica",
  "chao-fabrica": "Chão de Fábrica",
};

/**
 * Checklist de expedição de um pedido (gestor e chão usam o mesmo). Antes eram duas páginas
 * quase iguais; desde o quadro #317 (04/11) o checklist também é a aba "Expedição" da janela
 * do pedido. `expeditionId` aceita o id da expedição ("exp-<pedido>") ou o id do pedido.
 */
export function ExpeditionChecklistView({ area, expeditionId }: { area: FactoryArea; expeditionId: string }) {
  const router = useRouter();
  const inModal = useInRouteModal();
  const areaLabel = AREA_LABEL[area];
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isChecklistSaving, setIsChecklistSaving] = useState(false);
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const { planningData, isLoading } = useFactoryPlanningSnapshot(anchorDate);
  const deliveryExecutionState = useDeliveryExecution();
  const { profile } = useCurrentProfile();
  // Liberar com itens pendentes: só na área do gestor e só para gestor/administrador (o servidor confere).
  const canForceRelease =
    area === "gestor-fabrica" && (profile?.role === "administrador" || profile?.role === "gestor-fabrica");

  const expedition = useMemo(
    () =>
      planningData.expedition.find(
        (item) => item.id === expeditionId || item.orderId === expeditionId,
      ) ?? null,
    [expeditionId, planningData.expedition],
  );
  const relatedProductionOrders = useMemo(
    () =>
      expedition
        ? planningData.productionOrders
            .filter((op) => op.sourceItems.some((sourceItem) => sourceItem.orderId === expedition.orderId))
            .sort((a, b) => {
              const byDate = a.productionDate.localeCompare(b.productionDate);
              if (byDate !== 0) {
                return byDate;
              }
              return a.code.localeCompare(b.code);
            })
        : [],
    [expedition, planningData.productionOrders],
  );
  const aggregatedItems = useMemo(() => aggregateExpeditionItems(expedition?.items ?? []), [expedition?.items]);
  const execution = useMemo(
    () =>
      expedition
        ? deliveryExecutionState.resolveExecution(expedition.orderId, expedition.status === "aguardando_expedicao")
        : null,
    [deliveryExecutionState, expedition],
  );
  const expeditionCheckedItems = useMemo(() => execution?.checklistState ?? {}, [execution?.checklistState]);
  const canSeparate = Boolean(expedition && expedition.status === "aguardando_expedicao");
  const checklistEditable = Boolean(canSeparate && execution?.status === "aguardando_expedicao");
  const visibleStatus = useMemo(
    () =>
      expedition && execution
        ? getExpeditionVisibleStatus(expedition.status, execution.status)
        : expedition?.status ?? null,
    [execution, expedition],
  );
  const allCheckedState = useMemo(
    () =>
      aggregatedItems.reduce<Record<string, boolean>>((acc, item) => {
        acc[getChecklistItemKey(item)] = true;
        return acc;
      }, {}),
    [aggregatedItems],
  );
  const checkedCount = useMemo(
    () =>
      aggregatedItems.filter((item) => {
        if (execution?.status !== "aguardando_expedicao") {
          return true;
        }

        return expeditionCheckedItems[getChecklistItemKey(item)] === true;
      }).length,
    [aggregatedItems, execution?.status, expeditionCheckedItems],
  );
  const allItemsChecked = aggregatedItems.length > 0 && checkedCount === aggregatedItems.length;

  async function persistChecklist(
    nextChecklistState: Record<string, boolean>,
    nextStatus = execution?.status ?? "aguardando_expedicao",
    nextChecklistCompletedAt = execution?.checklistCompletedAt ?? null,
  ): Promise<boolean> {
    if (!expedition) {
      return false;
    }

    setActionError(null);
    setIsChecklistSaving(true);

    try {
      await deliveryExecutionState.updateExecution(expedition.orderId, nextStatus, {
        checklistState: nextChecklistState,
        checklistCompletedAt: nextChecklistCompletedAt,
      });
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Falha ao atualizar o checklist de expedição.",
      );
      return false;
    } finally {
      setIsChecklistSaving(false);
    }
  }

  async function handleChecklistToggle(itemKey: string, checked: boolean) {
    if (!checklistEditable) {
      return;
    }

    await persistChecklist({
      ...expeditionCheckedItems,
      [itemKey]: checked,
    });
  }

  async function handleMarkAll() {
    if (!checklistEditable) {
      return;
    }

    await persistChecklist(allCheckedState);
  }

  async function handleCompleteChecklist() {
    if (!expedition || !checklistEditable || !allItemsChecked) {
      return;
    }

    const ok = await persistChecklist(allCheckedState, "pronto_coleta", new Date().toISOString());
    if (ok && area === "chao-fabrica") {
      // Handoff do chão: checklist concluído leva o operador direto para a fila de entregas.
      pushWithProgress(router, "/chao-fabrica/entregas?status=pronto_coleta");
    }
  }

  async function handleForceRelease() {
    if (!expedition || !checklistEditable) {
      return;
    }

    const trimmedReason = releaseReason.trim();
    if (!trimmedReason) {
      setReleaseError("Informe o motivo da liberação com itens pendentes.");
      return;
    }

    setReleaseError(null);
    setActionError(null);
    setIsChecklistSaving(true);

    try {
      await deliveryExecutionState.updateExecution(expedition.orderId, "pronto_coleta", {
        checklistState: expeditionCheckedItems,
        checklistCompletedAt: new Date().toISOString(),
        force: true,
        releaseReason: trimmedReason,
      });
      setIsReleaseDialogOpen(false);
      setReleaseReason("");
    } catch (error) {
      setReleaseError(
        error instanceof Error ? error.message : "Falha ao liberar a entrega com itens pendentes.",
      );
    } finally {
      setIsChecklistSaving(false);
    }
  }

  const pendingDeliveriesCount = useMemo(
    () =>
      planningData.expedition.filter((item) => {
        const exec = deliveryExecutionState.resolveExecution(item.orderId, item.status === "aguardando_expedicao");
        return exec.status === "pronto_coleta" || exec.status === "em_rota" || exec.status === "no_destino";
      }).length,
    [deliveryExecutionState, planningData.expedition],
  );

  const flowSteps =
    area === "gestor-fabrica"
      ? [
          {
            key: "pedidos",
            title: "Pedidos",
            helper: "Entradas auditadas",
            value: planningData.orders.length,
            href: "/gestor-fabrica/pedidos",
            icon: ShoppingCart,
          },
          {
            key: "producao",
            title: "Produção",
            helper: "OPs liberadas",
            value: planningData.productionOrders.length,
            href: "/gestor-fabrica/ordens-producao",
            icon: Factory,
          },
          {
            key: "expedicao",
            title: "Expedição",
            helper: "Checklists",
            value: planningData.expedition.length,
            href: "/gestor-fabrica/expedicao",
            icon: Truck,
          },
        ]
      : [
          {
            key: "producao",
            title: "Produção",
            helper: "OPs liberadas",
            value: planningData.productionOrders.length,
            href: "/chao-fabrica/ordens-producao",
            icon: Factory,
          },
          {
            key: "expedicao",
            title: "Expedição",
            helper: "Checklists",
            value: planningData.expedition.length,
            href: "/chao-fabrica/expedicao",
            icon: Truck,
          },
          {
            key: "entregas",
            title: "Entregas",
            helper: "Em rota / pendentes",
            value: pendingDeliveriesCount,
            href: "/chao-fabrica/entregas",
            icon: Truck,
          },
        ];

  const backToExpedition = inModal ? null : (
    <Button asChild type="button" variant="outline">
      <Link href={`/${area}/expedicao`}>
        <ArrowLeft className="size-4" />
        Voltar para expedição
      </Link>
    </Button>
  );

  if (!expedition) {
    return (
      <PageLayout
        title={isLoading ? "Carregando checklist…" : "Checklist não encontrado"}
        description={isLoading ? "" : "O pedido solicitado não existe para a referência atual."}
        badge="Fábrica"
        breadcrumbs={[
          { label: areaLabel, href: `/${area}` },
          { label: "Expedição", href: `/${area}/expedicao` },
          { label: "Detalhe" },
        ]}
        actions={backToExpedition}
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {isLoading
              ? "Buscando dados do checklist…"
              : "Ajuste a data de referência na fila de expedição e tente novamente."}
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Checklist · ${expedition.orderCode}`}
      description="Conferência final por pedido e loja, já convertida para a unidade logística de expedição."
      badge="Fábrica"
      breadcrumbs={[
        { label: areaLabel, href: `/${area}` },
        { label: "Expedição", href: `/${area}/expedicao` },
        { label: expedition.orderCode },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => openPrintPage(`/impressao/expedicao/${expedition.id}?ref=${anchorDate}`)}>
            <Printer className="size-4" />
            Imprimir checklist
          </Button>
          <Button type="button" variant="outline" disabled={!checklistEditable || allItemsChecked || isChecklistSaving} onClick={() => void handleMarkAll()}>
            Marcar tudo
          </Button>
          {area === "chao-fabrica" && execution?.status !== "aguardando_expedicao" ? (
            <Button asChild type="button">
              <Link href="/chao-fabrica/entregas?status=pronto_coleta">
                <Truck className="size-4" />
                Ir para entregas
              </Link>
            </Button>
          ) : (
            <Button type="button" disabled={!checklistEditable || !allItemsChecked || isChecklistSaving} onClick={() => void handleCompleteChecklist()}>
              <CheckCircle2 className="size-4" />
              {execution?.status === "aguardando_expedicao" ? "Continuar para entregas" : "Checklist concluído"}
            </Button>
          )}
          {checklistEditable && !allItemsChecked && canForceRelease ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-amber-600 hover:text-amber-700"
              disabled={isChecklistSaving}
              onClick={() => {
                setReleaseError(null);
                setReleaseReason("");
                setIsReleaseDialogOpen(true);
              }}
            >
              <AlertTriangle className="size-4" />
              Liberar com justificativa
            </Button>
          ) : null}
          {backToExpedition}
        </div>
      }
    >
      {/* Na janela do pedido o recorte de datas não filtra nada (igual ao resumo, quadro #42). */}
      {inModal ? null : (
      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela do checklist"
        description="O checklist continua aberto pelo pedido, enquanto o contexto temporal segue o mesmo recorte global da expedição."
      />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumo do checklist</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Pedido</p>
            <p className="mt-1 text-sm font-semibold">{expedition.orderCode}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Loja</p>
            <p className="mt-1 text-sm font-semibold">{expedition.storeName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Recebimento</p>
            <p className="mt-1 text-sm font-semibold">{expedition.deliveryDateLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produtos</p>
            <p className="mt-1 text-sm font-semibold">{aggregatedItems.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Carga</p>
            <p className="mt-1 text-sm font-semibold">{formatKgLabel(expedition.totalKg)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={visibleStatus ?? expedition.status} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Checklist</p>
            <p className="mt-1 text-sm font-semibold">
              {execution?.status !== "aguardando_expedicao" ? "Concluído" : `${checkedCount}/${aggregatedItems.length} itens`}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Conferência final</p>
            <p className="mt-1 text-sm font-semibold">
              {execution?.checklistCompletedAt
                ? new Date(execution.checklistCompletedAt).toLocaleString("pt-BR")
                : "Pendente"}
            </p>
          </div>
          <div className="md:col-span-6">
            <p className="rounded-md border border-border/70 bg-panel/45 px-3 py-2 text-xs text-muted-foreground">
              {!canSeparate
                ? "Checklist ainda bloqueado. Finalize a produção de todos os itens da OP para liberar esta etapa."
                : execution?.status === "pronto_coleta"
                  ? "Checklist concluído. O pedido já está pronto para coleta/entrega."
                  : execution?.status === "em_rota" || execution?.status === "no_destino"
                    ? "Checklist concluído. A entrega já está em andamento."
                    : execution?.status === "entregue"
                      ? "Checklist concluído. O pedido já foi entregue."
                      : execution?.status === "tentativa_falha"
                        ? "Checklist concluído. Houve uma tentativa de entrega que não foi finalizada."
                        : "Marque os itens conferidos e conclua o checklist para liberar a coleta."}
            </p>
          </div>
          {execution?.pendingReleaseReason ? (
            <div className="md:col-span-6 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Entrega liberada com itens pendentes</p>
                <p className="mt-0.5 text-amber-700/90">Motivo: {execution.pendingReleaseReason}</p>
                {execution.pendingReleasedAt ? (
                  <p className="mt-0.5 text-xs text-amber-700/80">
                    Liberada em {new Date(execution.pendingReleasedAt).toLocaleString("pt-BR")}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {actionError ? (
            <div className="md:col-span-6 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
              {actionError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <FactoryFlow
        currentKey="expedicao"
        steps={flowSteps}
        subtitle={
          area === "gestor-fabrica"
            ? "A expedição é consequência da conclusão operacional. Não há edição manual de status nesta etapa."
            : "A fila do chão de fábrica só libera expedição quando o pedido já está concluído na produção."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>OPs relacionadas a este checklist</CardTitle>
        </CardHeader>
        <CardContent>
          {relatedProductionOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma OP vinculada foi encontrada para este pedido na referência atual.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="bg-panel">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">OP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produção</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Linha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Carga (Kg)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedProductionOrders.map((op) => (
                    <tr key={op.id}>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm font-medium text-foreground">
                        {op.code}
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {op.productionDateLabel}
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {op.lineName}
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {formatKgValue(op.totalKg)}
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        <StatusBadge status={op.status} />
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-right">
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href={`/${area}/ordens-producao/${encodeURIComponent(getProductionOrderNavKey(op))}?ref=${anchorDate}`}>
                            <Factory className="size-4" />
                            Abrir OP
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Itens consolidados para conferência</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!checklistEditable || allItemsChecked || isChecklistSaving}
            onClick={() => void handleMarkAll()}
          >
            Marcar tudo
          </Button>
        </CardHeader>
        <CardContent>
          <PaginatedSection items={aggregatedItems} label="itens da expedição" initialPageSize={8}>
            {(paginatedItems) => (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead className="bg-panel">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd pedida</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Kg interno</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd expedição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Checklist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr key={getChecklistItemKey(item)}>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {item.productCode} · {item.productName}
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {item.requestedQuantity} {item.requestedUnit}
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{formatKgValue(item.internalKg)}</td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {item.expeditionQuantity} {item.expeditionUnit}
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <label className="inline-flex items-center gap-2">
                            <Checkbox
                              checked={
                                execution?.status !== "aguardando_expedicao"
                                  ? true
                                  : expeditionCheckedItems[getChecklistItemKey(item)] === true
                              }
                              disabled={!checklistEditable || isChecklistSaving}
                              onCheckedChange={(checked) =>
                                void handleChecklistToggle(getChecklistItemKey(item), checked === true)
                              }
                            />
                            <span className="text-sm text-foreground">
                              {execution?.status !== "aguardando_expedicao" || expeditionCheckedItems[getChecklistItemKey(item)] === true
                                ? "Conferido"
                                : "Pendente"}
                            </span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedSection>
        </CardContent>
      </Card>

      <Dialog open={isReleaseDialogOpen} onOpenChange={setIsReleaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar entrega com itens pendentes</DialogTitle>
            <DialogDescription>
              O checklist deste pedido não está 100% concluído. A liberação será registrada para
              auditoria com o seu nome. Informe a justificativa obrigatória.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="release-reason">Motivo da liberação</Label>
            <Textarea
              id="release-reason"
              value={releaseReason}
              onChange={(event) => setReleaseReason(event.target.value)}
              placeholder="Descreva por que a entrega está sendo liberada com itens pendentes."
              rows={4}
            />
            {releaseError ? (
              <p className="text-sm text-danger-foreground">{releaseError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isChecklistSaving}
              onClick={() => setIsReleaseDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={releaseReason.trim().length === 0 || isChecklistSaving}
              onClick={() => void handleForceRelease()}
            >
              Confirmar liberação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
