"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeft, Factory, Printer, ShoppingCart, Truck } from "lucide-react";

import { FactoryFlow } from "@/components/shared/factory-flow";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aggregateOrderItems } from "@/lib/order-item-aggregation";
import { formatDateKeyBr } from "@/lib/order-planning";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

export default function PedidoDetailsPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const { planningData, releaseOrder, cancelOrder, reopenOrder } = useFactoryPlanningSnapshot(anchorDate);

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
  const canCancelOrder = Boolean(order && !order.releasedToProduction && order.status !== "cancelado");

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
            onClick={() => openPrintPage(`/impressao/pedido-loja/${order.id}?ref=${anchorDate}`)}
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
      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela do pedido"
        description="O pedido continua aberto pelo identificador, mas o contexto temporal do fluxo segue o recorte global da operação."
      />

      <Card>
        <CardHeader>
          <CardTitle>Resumo do Pedido</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
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
          <div className="space-y-2 sm:col-span-2 lg:col-span-1 xl:col-span-1">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Liberação</p>
            <Button
              type="button"
              className="h-auto min-h-10 w-full whitespace-normal px-4 py-2.5 text-center leading-tight"
              disabled={!order.availableForRelease || order.releasedToProduction || order.status === "cancelado"}
              onClick={() => void releaseOrder(order.id)}
            >
              {order.releasedToProduction ? "Pedido liberado" : "Liberar para produção"}
            </Button>
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-2 xl:col-span-2">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Gestão do pedido</p>
            {order.status === "cancelado" ? (
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-10 w-full whitespace-normal px-4 py-2.5 text-center leading-tight"
                onClick={() => {
                  if (window.confirm(`Reabrir o pedido ${order.code}?`)) {
                    void reopenOrder(order.id);
                  }
                }}
              >
                Reabrir pedido
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-10 w-full whitespace-normal px-4 py-2.5 text-center leading-tight"
                disabled={!canCancelOrder}
                onClick={() => {
                  if (
                    window.confirm(
                      `Cancelar o pedido ${order.code}? Ele sairá do fluxo operacional até ser reaberto.`,
                    )
                  ) {
                    void cancelOrder(order.id);
                  }
                }}
              >
                Cancelar pedido
              </Button>
            )}
          </div>
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-7">
            <div className="rounded-md border border-border/70 bg-panel/40 px-3 py-2 text-sm text-muted-foreground">
              Progresso derivado: <strong>{order.workflowProgress.toFixed(1)}%</strong>.{" "}
              {order.status === "cancelado"
                ? "Pedido cancelado pela fábrica e fora do fluxo operacional até reabertura."
                : "O pedido só sobe para expedição quando todos os produtos da OP concluírem."}
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
          <PaginatedSection
            items={aggregatedOrderItems}
            label="itens consolidados"
            initialPageSize={8}
            temporalSortKeys={["deliveryDate", "productionDate", "saleDate"]}
          >
            {(paginatedItems) => (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full min-w-[980px] border-collapse">
                  <thead className="bg-panel">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd Loja</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Kg Interno</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produção</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Venda</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Linha</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">OP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
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
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{formatDateKeyBr(item.saleDate)}</td>
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
            )}
          </PaginatedSection>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens Originais do Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <PaginatedSection
            items={orderItems}
            label="itens originais"
            initialPageSize={8}
            temporalSortKeys={["deliveryDate", "productionDate", "saleDate"]}
          >
            {(paginatedItems) => (
              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead className="bg-panel">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qtd Loja</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Kg</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Venda</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status do item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr key={item.id}>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {item.productCode} · {item.productName}
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {item.requestedQuantity} {item.requestedUnit}
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{item.internalKg}</td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{formatDateKeyBr(item.saleDate)}</td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <StatusBadge status={item.status} />
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

      <Card>
        <CardHeader>
          <CardTitle>OPs Relacionadas</CardTitle>
        </CardHeader>
        <CardContent>
          {relatedOps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma OP gerada. Libere o pedido para produção.</p>
          ) : (
            <PaginatedSection items={relatedOps} label="OPs relacionadas" initialPageSize={6}>
              {(paginatedOps) => (
                <div className="overflow-x-auto rounded-xl border border-border/80">
                  <table className="w-full min-w-[860px] border-collapse">
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
                      {paginatedOps.map((op) => (
                        <tr key={op.id}>
                          <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.code}</td>
                          <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.productionDateLabel}</td>
                          <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.scheduleName}</td>
                          <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.totalKg}</td>
                          <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{op.progress.toFixed(1)}%</td>
                          <td className="border-t border-border/70 bg-card px-4 py-3">
                            <Button asChild type="button" size="sm" variant="ghost">
                              <Link href={`/gestor-fabrica/ordens-producao/${op.id}?ref=${anchorDate}`}>Abrir</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PaginatedSection>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
