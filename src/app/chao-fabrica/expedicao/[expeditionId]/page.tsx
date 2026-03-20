"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Factory, Printer, Truck } from "lucide-react";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { aggregateExpeditionItems } from "@/lib/expedition-aggregation";
import { useDeliveryExecution } from "@/lib/delivery-execution";
import { getExpeditionVisibleStatus } from "@/lib/delivery-workflow";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

function getChecklistItemKey(item: ReturnType<typeof aggregateExpeditionItems>[number]) {
  return `${item.productId}|${item.requestedUnit}|${item.expeditionUnit}`;
}

export default function ExpedicaoDetailsPage() {
  const params = useParams<{ expeditionId: string }>();
  const expeditionId = typeof params.expeditionId === "string" ? params.expeditionId : "";
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isChecklistSaving, setIsChecklistSaving] = useState(false);
  const { planningData } = useFactoryPlanningSnapshot(anchorDate);
  const deliveryExecutionState = useDeliveryExecution();

  const expedition = useMemo(
    () => planningData.expedition.find((item) => item.id === expeditionId) ?? null,
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
  ) {
    if (!expedition) {
      return;
    }

    setActionError(null);
    setIsChecklistSaving(true);

    try {
      await deliveryExecutionState.updateExecution(expedition.orderId, nextStatus, {
        checklistState: nextChecklistState,
        checklistCompletedAt: nextChecklistCompletedAt,
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Falha ao atualizar o checklist de expedição.",
      );
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

    await persistChecklist(allCheckedState, "pronto_coleta", new Date().toISOString());
  }

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

  if (!expedition) {
    return (
      <PageLayout
        title="Checklist não encontrado"
        description="O pedido solicitado não existe para a referência atual."
        badge="Fábrica"
        breadcrumbs={[
          { label: "Chão de Fábrica", href: "/chao-fabrica" },
          { label: "Expedição", href: "/chao-fabrica/expedicao" },
          { label: "Detalhe" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/chao-fabrica/expedicao">
              <ArrowLeft className="size-4" />
              Voltar para expedição
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Ajuste a data de referência na fila de expedição e tente novamente.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Checklist · ${expedition.orderCode}`}
      description="Conferência final do chão de fábrica, agrupada por produto e unidade logística."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Chão de Fábrica", href: "/chao-fabrica" },
        { label: "Expedição", href: "/chao-fabrica/expedicao" },
        { label: expedition.orderCode },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => openPrintPage(`/impressao/expedicao/${expedition.id}?ref=${anchorDate}`)}>
            <Printer className="size-4" />
            Imprimir checklist
          </Button>
          <Button type="button" variant="outline" disabled={!checklistEditable || allItemsChecked || isChecklistSaving} onClick={() => void handleMarkAll()}>
            Marcar todos
          </Button>
          <Button type="button" disabled={!checklistEditable || !allItemsChecked || isChecklistSaving} onClick={() => void handleCompleteChecklist()}>
            <CheckCircle2 className="size-4" />
            {execution?.status === "aguardando_expedicao" ? "Continuar para entregas" : "Checklist concluído"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/chao-fabrica/expedicao">
              <ArrowLeft className="size-4" />
              Voltar para expedição
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
        title="Janela do checklist"
        description="O checklist continua aberto pelo pedido, enquanto o contexto temporal acompanha o mesmo recorte global da expedição."
      />

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
                ? "Checklist ainda bloqueado. Aguarde a conclusão total da OP para iniciar esta etapa."
                : execution?.status === "pronto_coleta"
                  ? "Checklist concluído. O pedido já está pronto para seguir para entregas."
                  : execution?.status === "em_rota" || execution?.status === "no_destino"
                    ? "Checklist concluído. A entrega já está em andamento."
                    : execution?.status === "entregue"
                      ? "Checklist concluído. O pedido já foi entregue."
                      : execution?.status === "tentativa_falha"
                        ? "Checklist concluído. Houve uma tentativa de entrega que não foi finalizada."
                        : "Marque os itens conferidos e conclua o checklist para liberar a coleta."}
            </p>
          </div>
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
        subtitle="A fila do chão de fábrica só libera expedição quando o pedido já está concluído na produção."
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
                          <Link href={`/chao-fabrica/ordens-producao/${op.id}?ref=${anchorDate}`}>
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
        <CardHeader>
          <CardTitle>Itens consolidados para conferência</CardTitle>
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
    </PageLayout>
  );
}
