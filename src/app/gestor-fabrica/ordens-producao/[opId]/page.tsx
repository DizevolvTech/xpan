"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Factory, Printer, ShoppingCart, Truck } from "lucide-react";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { PageLayout } from "@/components/shared/page-layout";
import { ProductionOrderTimeline } from "@/components/production/production-order-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
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

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

export default function OrdemProducaoDetailsPage() {
  const params = useParams<{ opId: string }>();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null);
  const { planningData, isLoading, updateProductionItemStatus } = useFactoryPlanningSnapshot(anchorDate);
  const tryFutureDateOverride = useFutureDateOverride();
  const { snapshot } = useMasterDataSnapshot();

  const op = useMemo(
    () =>
      planningData.productionOrders.find(
        (item) => getProductionOrderNavKey(item) === decodeURIComponent(opId),
      ) ??
      planningData.productionOrders.find((item) => item.id === opId) ??
      null,
    [opId, planningData.productionOrders],
  );

  const lineCapacity = useMemo(() => {
    if (!op) {
      return 0;
    }
    return snapshot.lines.find((item) => item.id === op.lineId)?.capacityPerDayKg ?? 0;
  }, [op, snapshot.lines]);

  const flowSteps = [
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
  ];

  if (!op) {
    return (
      <PageLayout
        title={isLoading ? "Carregando OP…" : "OP não encontrada"}
        description={isLoading ? "" : "A OP solicitada não existe para a referência atual."}
        badge="Fábrica"
        breadcrumbs={[
          { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
          { label: "Ordens de Produção", href: "/gestor-fabrica/ordens-producao" },
          { label: "Detalhe" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/ordens-producao">
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
      // Trava de data futura: gestor/admin podem forçar a conclusão (forceable).
      const handled = await tryFutureDateOverride(
        error,
        () => updateProductionItemStatus(productionItemKey, status, { force: true }),
        (message) => setWorkflowError(message),
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

  return (
    <PageLayout
      title={`${op.code} · ${op.scheduleName}`}
      description="Acompanhe o avanço real dos produtos dentro da OP e emita as folhas dedicadas de pré-pesagem e produção."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Ordens de Produção", href: "/gestor-fabrica/ordens-producao" },
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
            <Link href="/gestor-fabrica/ordens-producao">
              <ArrowLeft className="size-4" />
              Voltar para OPs
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/expedicao">
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
        description="A OP permanece aberta pelo código, mas o contexto temporal segue o mesmo recorte global da produção."
      />

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
        subtitle="O progresso da OP é calculado pela média simples dos produtos da própria OP."
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
                        {item.capacityPerBatch != null && item.capacityPerBatch > 0 ? (
                          // Item BATIDO: status vem das batidas (geridas no Chão);
                          // os botões de avançar/voltar seriam no-op aqui.
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {item.batchesDone}/{item.batchCount} batidas · geridas no Chão
                          </p>
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

      <ProductionOrderTimeline
        // key força remount ao trocar OP ou janela operacional — state sempre
        // fresco sem precisar de setState dentro do effect.
        key={`${op.code}|${anchorDate}`}
        opCode={op.code}
        referenceDate={anchorDate}
      />
    </PageLayout>
  );
}
