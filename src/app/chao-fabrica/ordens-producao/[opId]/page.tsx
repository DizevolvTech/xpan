"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Factory, Printer, Truck } from "lucide-react";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProductionOrderNavKey } from "@/lib/factory-kanban";
import { hierarchyLabels } from "@/lib/production-planning";
import {
  getNextProductionActionLabel,
  getNextProductionItemStatus,
  getPreviousProductionActionLabel,
  getPreviousProductionItemStatus,
  getProductionStatusLabel,
} from "@/lib/production-workflow";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useFutureDateOverride } from "@/lib/use-future-date-override";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { getOperationalTodayKey } from "@/lib/workflow-date-guard";

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

export default function OrdemProducaoDetailsPage() {
  const params = useParams<{ opId: string }>();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null);
  const { planningData, isLoading, updateProductionItemStatus, completeProductionBatch, undoProductionBatch } =
    useFactoryPlanningSnapshot(anchorDate);
  const { snapshot } = useMasterDataSnapshot();
  const toast = useToast();
  const tryFutureDateOverride = useFutureDateOverride();

  const op = useMemo(() => {
    const decoded = decodeURIComponent(opId);
    return (
      planningData.productionOrders.find((item) => getProductionOrderNavKey(item) === decoded) ??
      planningData.productionOrders.find((item) => item.id === opId) ??
      null
    );
  }, [opId, planningData.productionOrders]);

  const lineCapacity = useMemo(() => {
    if (!op) {
      return 0;
    }
    return snapshot.lines.find((item) => item.id === op.lineId)?.capacityPerDayKg ?? 0;
  }, [op, snapshot.lines]);

  const flowSteps = [
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
  ];

  if (!op) {
    return (
      <PageLayout
        title={isLoading ? "Carregando OP…" : "OP não encontrada"}
        description={isLoading ? "" : "A OP solicitada não existe para a referência atual."}
        badge="Fábrica"
        breadcrumbs={[
          { label: "Chão de Fábrica", href: "/chao-fabrica" },
          { label: "Ordens de Produção", href: "/chao-fabrica/ordens-producao" },
          { label: "Detalhe" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/chao-fabrica/ordens-producao">
              <ArrowLeft className="size-4" />
              Voltar para OPs
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {isLoading
              ? "Buscando dados da OP…"
              : "Ajuste a data de referência na lista de OPs e tente novamente."}
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  async function handleWorkflowAction(productionItemKey: string, status: Parameters<typeof updateProductionItemStatus>[1]) {
    setWorkflowError(null);
    setPendingItemKey(productionItemKey);

    try {
      await updateProductionItemStatus(productionItemKey, status);
    } catch (error) {
      const handled = await tryFutureDateOverride(
        error,
        () => updateProductionItemStatus(productionItemKey, status, { force: true }),
        (message) => {
          setWorkflowError(message);
          toast.error(message);
        },
      );
      if (!handled) {
        setWorkflowError(
          error instanceof Error ? error.message : "Falha ao atualizar o estágio operacional.",
        );
      }
    } finally {
      setPendingItemKey(null);
    }
  }

  async function handleCompleteBatch(productionItemKey: string, batchCount: number) {
    setWorkflowError(null);
    setPendingItemKey(productionItemKey);
    try {
      await completeProductionBatch(productionItemKey, batchCount);
    } catch (error) {
      const handled = await tryFutureDateOverride(
        error,
        () => completeProductionBatch(productionItemKey, batchCount, { force: true }),
        (message) => {
          setWorkflowError(message);
          toast.error(message);
        },
      );
      if (!handled) {
        setWorkflowError(error instanceof Error ? error.message : "Falha ao concluir a batida.");
      }
    } finally {
      setPendingItemKey(null);
    }
  }

  async function handleUndoBatch(productionItemKey: string) {
    setWorkflowError(null);
    setPendingItemKey(productionItemKey);
    try {
      await undoProductionBatch(productionItemKey);
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : "Falha ao desfazer a batida.");
    } finally {
      setPendingItemKey(null);
    }
  }

  return (
    <PageLayout
      title={`${op.code} · ${op.scheduleName}`}
      description="Controle operacional do chão de fábrica com avanço por produto e impressão dedicada."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Chão de Fábrica", href: "/chao-fabrica" },
        { label: "Ordens de Produção", href: "/chao-fabrica/ordens-producao" },
        { label: op.code },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => openPrintPage(`/impressao/pre-pesagem/${encodeURIComponent(getProductionOrderNavKey(op))}?ref=${anchorDate}`)}>
            <Printer className="size-4" />
            Pré-pesagem
          </Button>
          <Button type="button" variant="outline" onClick={() => openPrintPage(`/impressao/producao/${encodeURIComponent(getProductionOrderNavKey(op))}?ref=${anchorDate}`)}>
            <Printer className="size-4" />
            Produção
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/chao-fabrica/ordens-producao">
              <ArrowLeft className="size-4" />
              Voltar para OPs
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/chao-fabrica/expedicao">
              <Truck className="size-4" />
              Ver expedição
            </Link>
          </Button>
        </div>
      }
    >
      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela da OP"
        description="A OP permanece aberta pelo código, enquanto o contexto temporal acompanha o mesmo recorte global do chão de fábrica."
      />

      {op.productionDate > getOperationalTodayKey() ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Produção agendada para <strong>{op.productionDateLabel}</strong> (data futura). A conclusão
          de batidas/produção só é liberada quando a data chegar — antes disso depende de override do
          gestor.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Resumo da OP</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">OP</p>
            <p className="mt-1 text-sm font-semibold">{op.code}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produção</p>
            <p className="mt-1 text-sm font-semibold">{op.productionDateLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{hierarchyLabels.sector}</p>
            <p className="mt-1 text-sm font-semibold">{op.sectorName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{hierarchyLabels.line}</p>
            <p className="mt-1 text-sm font-semibold">{op.lineName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{hierarchyLabels.schedule}</p>
            <p className="mt-1 text-sm font-semibold">{op.scheduleName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={op.status} />
            </div>
          </div>
        </CardContent>
      </Card>

      <FactoryFlow
        currentKey="producao"
        steps={flowSteps}
        subtitle="O chão de fábrica move o andamento por produto; a OP calcula a média automaticamente."
      />

      <Card>
        <CardHeader>
          <CardTitle>Carga e conclusão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Carga da OP</p>
            <p className="mt-1 text-lg font-semibold">{formatKgLabel(op.totalKg)}</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">% conclusão</p>
            <p className="mt-1 text-lg font-semibold">{op.progress.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Capacidade da linha de produção</p>
            <p className="mt-1 text-lg font-semibold">{formatKgValue(lineCapacity)} Kg/dia</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-panel p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produtos na OP</p>
            <p className="mt-1 text-lg font-semibold">{op.items.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avanço por produto</CardTitle>
        </CardHeader>
        <CardContent>
          {workflowError ? (
            <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
              {workflowError}
            </div>
          ) : null}
          <PaginatedSection items={op.items} label="produtos da OP" initialPageSize={6}>
            {(paginatedItems) => (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead className="bg-panel">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Carga (Kg)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Progresso</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status operacional</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Itens origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr key={item.productId}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productCode} · {item.productName}
                      {item.isIntermediate ? (
                        <span
                          className="ms-2 inline-flex items-center rounded-full bg-accent/[var(--opacity-subtle)] px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.06em] text-accent-foreground"
                          title="Insumo intermediário (base) feito na receita — etapa anterior ao produto final, por isso costuma estar em outro ponto."
                        >
                          Base
                        </span>
                      ) : null}
                      {item.belowMinimum && item.minimumProductionKg > 0 ? (
                        <span
                          className="ms-2 inline-flex items-center rounded-full bg-warning/[var(--opacity-subtle)] px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.06em] text-warning-foreground"
                          title={`Demanda (${formatKgValue(item.totalKg)} kg) abaixo do lote mínimo do produto (${formatKgValue(item.minimumProductionKg)} kg). É só um AVISO — não trava a OP.`}
                        >
                          Abaixo do mínimo
                        </span>
                      ) : null}
                      {item.batchCount > 1 ? (
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {item.batchesDone}/{item.batchCount} batidas · {item.batchSizes.join(" + ")} {item.batchUnitLabel}
                        </p>
                      ) : null}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{formatKgValue(item.totalKg)}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.progress.toFixed(1)}%</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      <div className="space-y-2">
                        <StatusBadge status={item.status} />
                        {item.batchCount > 1 ? (
                          (() => {
                            const done = item.batchesDone;
                            const isDone = done >= item.batchCount;
                            const currentIdx = Math.min(done, item.batchCount - 1);
                            const currentSize = item.batchSizes[currentIdx] ?? 0;
                            const fullCap = Math.max(...item.batchSizes);
                            const isPartial = !isDone && currentSize < fullCap;
                            const busy = pendingItemKey === item.productionItemKey;
                            return (
                              <div className="space-y-2">
                                <div className="text-sm font-semibold text-foreground">
                                  {isDone ? (
                                    `Todas as ${item.batchCount} batidas concluídas`
                                  ) : (
                                    <>
                                      Batida {done + 1} de {item.batchCount}
                                      <span
                                        className={`ml-2 inline-block border px-1 text-[10px] font-semibold uppercase ${
                                          isPartial
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-border text-muted-foreground"
                                        }`}
                                      >
                                        {isPartial ? "Parcial" : "Cheia"}
                                      </span>
                                      <span className="ml-2 font-normal text-muted-foreground">
                                        · {currentSize} {item.batchUnitLabel}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {done > 0 ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => void handleUndoBatch(item.productionItemKey)}
                                    >
                                      Desfazer
                                    </Button>
                                  ) : null}
                                  {!isDone ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => void handleCompleteBatch(item.productionItemKey, item.batchCount)}
                                    >
                                      Concluir batida {done + 1}
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {getPreviousProductionItemStatus(item.status, item.preparationStages) ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={pendingItemKey === item.productionItemKey}
                                onClick={() =>
                                  void handleWorkflowAction(
                                    item.productionItemKey,
                                    getPreviousProductionItemStatus(item.status, item.preparationStages)!,
                                  )
                                }
                              >
                                {getPreviousProductionActionLabel(item.status, item.preparationStages) ??
                                  `Voltar para ${getProductionStatusLabel(getPreviousProductionItemStatus(item.status, item.preparationStages)!)}`}
                              </Button>
                            ) : null}
                            {getNextProductionItemStatus(item.status, item.preparationStages) ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={pendingItemKey === item.productionItemKey}
                                onClick={() =>
                                  void handleWorkflowAction(
                                    item.productionItemKey,
                                    getNextProductionItemStatus(item.status, item.preparationStages)!,
                                  )
                                }
                              >
                                {getNextProductionActionLabel(item.status, item.preparationStages) ??
                                  `Avançar para ${getProductionStatusLabel(getNextProductionItemStatus(item.status, item.preparationStages)!)}`}
                              </Button>
                            ) : (
                              <span className="text-xs font-semibold text-success-foreground">
                                Fluxo concluído
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.sourceItemsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedSection>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos atendidos por esta OP</CardTitle>
        </CardHeader>
        <CardContent>
          <PaginatedSection items={op.sourceItems} label="itens de origem" initialPageSize={8}>
            {(paginatedSourceItems) => (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead className="bg-panel">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Pedido</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Loja</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd loja</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Kg</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Entrega</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSourceItems.map((item) => (
                      <tr key={item.id}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.orderCode}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.storeName}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productCode} · {item.productName}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.requestedQuantity} {item.requestedUnit}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{formatKgValue(item.internalKg)}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.deliveryDateLabel}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.saleDateLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedSection>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
