"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Factory, Printer, ShoppingCart, Truck } from "lucide-react";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aggregateOrderItems } from "@/lib/order-item-aggregation";
import { applyFactoryWorkflowState, useFactoryWorkflowState } from "@/lib/factory-order-status";
import { buildFactoryPlanningData, formatDateKeyBr, getTodayDateKey } from "@/lib/order-planning";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

export default function PedidoDetailsPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const [referenceDate, setReferenceDate] = useState(() => sanitizeDateKey(searchParams.get("ref")));
  const workflow = useFactoryWorkflowState(referenceDate);

  const basePlanningData = useMemo(() => buildFactoryPlanningData(referenceDate), [referenceDate]);
  const planningData = useMemo(
    () =>
      applyFactoryWorkflowState(basePlanningData, {
        isReleased: workflow.isReleased,
        resolveProductionItemStatus: workflow.resolveProductionItemStatus,
      }),
    [basePlanningData, workflow.isReleased, workflow.resolveProductionItemStatus],
  );

  const order = useMemo(
    () => planningData.orders.find((item) => item.id === orderId) ?? null,
    [orderId, planningData.orders],
  );

  const orderItems = useMemo(
    () => planningData.orderItems.filter((item) => item.orderId === orderId),
    [orderId, planningData.orderItems],
  );

  const relatedOps = useMemo(
    () => planningData.productionOrders.filter((op) => op.orderCodes.includes(order?.code ?? "")),
    [order, planningData.productionOrders],
  );

  const aggregatedOrderItems = useMemo(() => aggregateOrderItems(orderItems), [orderItems]);

  const flowSteps = [
    {
      key: "pedidos",
      title: "Pedidos",
      helper: "Itens vendidos",
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

  if (!order) {
    return (
      <PageLayout
        title="Pedido não encontrado"
        description="O pedido solicitado não existe para a referência atual."
        badge="Fábrica"
        breadcrumbs={[
          { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
          { label: "Pedidos", href: "/gestor-fabrica/pedidos" },
          { label: "Detalhe" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/pedidos">
              <ArrowLeft className="size-4" />
              Voltar para pedidos
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Ajuste a data de referência na lista de pedidos e tente novamente.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`${order.code} · ${order.storeName}`}
      description="Audite o pedido, libere para produção e acompanhe o progresso derivado dos produtos."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Pedidos", href: "/gestor-fabrica/pedidos" },
        { label: order.code },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => openPrintPage(`/impressao/pedido-loja/${order.id}?ref=${referenceDate}`)}
          >
            <Printer className="size-4" />
            Folha da Loja
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/pedidos">
              <ArrowLeft className="size-4" />
              Voltar para pedidos
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
          <CardTitle>Resumo do Pedido</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Referência da fábrica
            </span>
            <input
              type="date"
              value={referenceDate}
              onChange={(event) => setReferenceDate(event.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-7">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Pedido</p>
            <p className="mt-1 text-sm font-semibold">{order.code}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Loja</p>
            <p className="mt-1 text-sm font-semibold">{order.storeName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Feito em</p>
            <p className="mt-1 text-sm font-semibold">{order.orderedAt}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Prazo</p>
            <p className="mt-1 text-sm font-semibold">{order.dPlusLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Recebimento</p>
            <p className="mt-1 text-sm font-semibold text-warning-foreground">{order.deliveryDateLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Liberação</p>
            <Button
              type="button"
              className="w-full"
              disabled={!order.availableForRelease || order.releasedToProduction}
              onClick={() => workflow.releaseOrder(order.id)}
            >
              {order.releasedToProduction ? "Pedido liberado" : "Liberar para produção"}
            </Button>
          </div>
          <div className="md:col-span-7">
            <div className="rounded-md border border-border/70 bg-panel/40 px-3 py-2 text-sm text-muted-foreground">
              Progresso derivado: <strong>{order.workflowProgress.toFixed(1)}%</strong>. O pedido só sobe para expedição quando todos os produtos da OP concluírem.
            </div>
          </div>
        </CardContent>
      </Card>

      <FactoryFlow
        currentKey="pedidos"
        steps={flowSteps}
        subtitle="Você está auditando um pedido dentro do fluxo operacional completo."
      />

      <Card>
        <CardHeader>
          <CardTitle>Itens Consolidados do Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd Loja</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Kg Interno</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produção</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Linha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">OP</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedOrderItems.map((item) => (
                  <tr key={item.aggregationKey}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productCode} · {item.productName}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.requestedQuantity} {item.requestedUnit}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.internalKg}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productionDate ? formatDateKeyBr(item.productionDate) : "Sem agenda"}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.scheduleName}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.opCode ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens Originais do Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd Loja</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Kg</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status do item</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item) => (
                  <tr key={item.id}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.productCode} · {item.productName}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {item.requestedQuantity} {item.requestedUnit}
                    </td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.internalKg}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OPs Relacionadas</CardTitle>
        </CardHeader>
        <CardContent>
          {relatedOps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma OP gerada. Libere o pedido para produção.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/80">
              <table className="w-full border-collapse">
                <thead className="bg-panel">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">OP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produção</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Linha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Total (Kg)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Progresso</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedOps.map((op) => (
                    <tr key={op.id}>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.code}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.productionDateLabel}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.scheduleName}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.totalKg}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.progress.toFixed(1)}%</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3">
                        <Button asChild type="button" size="sm" variant="ghost">
                          <Link href={`/gestor-fabrica/ordens-producao/${op.id}?ref=${referenceDate}`}>Abrir</Link>
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
    </PageLayout>
  );
}
