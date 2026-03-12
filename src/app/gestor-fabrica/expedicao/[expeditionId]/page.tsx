"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Factory, Printer, ShoppingCart, Truck } from "lucide-react";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { aggregateExpeditionItems } from "@/lib/expedition-aggregation";
import { useDeliveryExecution } from "@/lib/delivery-execution";
import { getTodayDateKey } from "@/lib/order-planning";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

function getChecklistItemKey(item: ReturnType<typeof aggregateExpeditionItems>[number]) {
  return `${item.productId}|${item.requestedUnit}|${item.expeditionUnit}`;
}

export default function ExpedicaoDetailsPage() {
  const params = useParams<{ expeditionId: string }>();
  const searchParams = useSearchParams();
  const expeditionId = typeof params.expeditionId === "string" ? params.expeditionId : "";
  const [referenceDate, setReferenceDate] = useState(() => sanitizeDateKey(searchParams.get("ref")));
  const { planningData } = useFactoryPlanningSnapshot(referenceDate);
  const deliveryExecutionState = useDeliveryExecution(referenceDate);
  const [checkedItemsByExpedition, setCheckedItemsByExpedition] = useState<Record<string, Record<string, boolean>>>({});

  const expedition = useMemo(
    () => planningData.expedition.find((item) => item.id === expeditionId) ?? null,
    [expeditionId, planningData.expedition],
  );
  const aggregatedItems = useMemo(() => aggregateExpeditionItems(expedition?.items ?? []), [expedition?.items]);
  const execution = useMemo(
    () =>
      expedition
        ? deliveryExecutionState.resolveExecution(expedition.orderId, expedition.status === "aguardando_expedicao")
        : null,
    [deliveryExecutionState, expedition],
  );
  const expeditionCheckedItems = useMemo(
    () => (expedition ? checkedItemsByExpedition[expedition.id] ?? {} : {}),
    [checkedItemsByExpedition, expedition],
  );
  const canSeparate = expedition?.status === "aguardando_expedicao";
  const checklistEditable = Boolean(canSeparate && execution?.status === "aguardando_expedicao");
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

  async function handleCompleteChecklist() {
    if (!expedition || !checklistEditable || !allItemsChecked) {
      return;
    }

    await deliveryExecutionState.updateExecution(expedition.orderId, "pronto_coleta");
  }

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

  if (!expedition) {
    return (
      <PageLayout
        title="Checklist não encontrado"
        description="O pedido solicitado não existe para a referência atual."
        badge="Fábrica"
        breadcrumbs={[
          { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
          { label: "Expedição", href: "/gestor-fabrica/expedicao" },
          { label: "Detalhe" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/expedicao">
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
      description="Conferência final por pedido e loja, já convertida para a unidade logística de expedição."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Expedição", href: "/gestor-fabrica/expedicao" },
        { label: expedition.orderCode },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => openPrintPage(`/impressao/expedicao/${expedition.id}?ref=${referenceDate}`)}>
            <Printer className="size-4" />
            Imprimir checklist
          </Button>
          <Button type="button" disabled={!checklistEditable || !allItemsChecked} onClick={() => void handleCompleteChecklist()}>
            <CheckCircle2 className="size-4" />
            {execution?.status === "pronto_coleta" ? "Checklist concluído" : "Concluir checklist"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/expedicao">
              <ArrowLeft className="size-4" />
              Voltar para expedição
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/ordens-producao">
              <Factory className="size-4" />
              Ver OPs
            </Link>
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Resumo do checklist</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Referência da fábrica</span>
            <input
              type="date"
              value={referenceDate}
              onChange={(event) => setReferenceDate(event.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
            />
          </div>
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
            <p className="mt-1 text-sm font-semibold">{expedition.totalKg} Kg</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={expedition.status} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Checklist</p>
            <p className="mt-1 text-sm font-semibold">
              {execution?.status === "pronto_coleta" ? "Concluído" : `${checkedCount}/${aggregatedItems.length} itens`}
            </p>
          </div>
          <div className="md:col-span-6">
            <p className="rounded-md border border-border/70 bg-panel/45 px-3 py-2 text-xs text-muted-foreground">
              {!canSeparate
                ? "Checklist ainda bloqueado. Finalize a produção de todos os itens da OP para liberar esta etapa."
                : execution?.status === "pronto_coleta"
                  ? "Checklist concluído. O pedido já está pronto para coleta/entrega."
                  : "Marque os itens conferidos e conclua o checklist para liberar a coleta."}
            </p>
          </div>
        </CardContent>
      </Card>

      <FactoryFlow
        currentKey="expedicao"
        steps={flowSteps}
        subtitle="A expedição é consequência da conclusão operacional. Não há edição manual de status nesta etapa."
      />

      <Card>
        <CardHeader>
          <CardTitle>Itens consolidados para conferência</CardTitle>
        </CardHeader>
        <CardContent>
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
                {aggregatedItems.map((item) => (
                  <tr key={getChecklistItemKey(item)}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productCode} · {item.productName}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.requestedQuantity} {item.requestedUnit}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.internalKg}</td>
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
                          disabled={!checklistEditable}
                          onCheckedChange={(checked) =>
                            setCheckedItemsByExpedition((current) => {
                              if (!expedition) {
                                return current;
                              }

                              return {
                                ...current,
                                [expedition.id]: {
                                  ...(current[expedition.id] ?? {}),
                                  [getChecklistItemKey(item)]: checked === true,
                                },
                              };
                            })
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
        </CardContent>
      </Card>
    </PageLayout>
  );
}
