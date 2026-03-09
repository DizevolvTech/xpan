"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Factory, ListChecks, ShoppingCart, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { applyFactoryWorkflowState, useFactoryWorkflowState } from "@/lib/factory-order-status";
import {
  buildFactoryPlanningData,
  formatDateKeyBr,
  getTodayDateKey,
  type PlannedOrderItem,
  type PlannedOrderRow,
} from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";

type OrderSummaryRow = PlannedOrderRow & {
  productsCount: number;
};

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

export default function PedidosFabricaPage() {
  const [referenceDate, setReferenceDate] = useState(getTodayDateKey());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([]);
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

  const orderItemsByOrderId = useMemo(() => {
    const map = new Map<string, PlannedOrderItem[]>();
    planningData.orderItems.forEach((item) => {
      if (!map.has(item.orderId)) {
        map.set(item.orderId, []);
      }
      map.get(item.orderId)?.push(item);
    });
    return map;
  }, [planningData.orderItems]);

  const summaryRows = useMemo<OrderSummaryRow[]>(() => {
    return planningData.orders.map((order) => {
      const items = orderItemsByOrderId.get(order.id) ?? [];
      return {
        ...order,
        productsCount: new Set(items.map((item) => item.productId)).size,
      };
    });
  }, [orderItemsByOrderId, planningData.orders]);

  const filteredOrders = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return summaryRows.filter((item) => {
      const matchesSearch =
        normalizedTerm.length === 0 ||
        item.code.toLowerCase().includes(normalizedTerm) ||
        item.storeName.toLowerCase().includes(normalizedTerm);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesStore = storeFilter === "all" || item.storeName === storeFilter;
      const matchesDelivery = deliveryFilter === "all" || item.deliveryDate === deliveryFilter;
      return matchesSearch && matchesStatus && matchesStore && matchesDelivery;
    });
  }, [deliveryFilter, searchTerm, statusFilter, storeFilter, summaryRows]);

  const pagination = useMemo(() => paginateArray(filteredOrders, page, pageSize), [filteredOrders, page, pageSize]);

  const flowSteps = [
    {
      key: "pedidos",
      title: "Pedidos",
      helper: "Demanda auditada",
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

  const storeOptions = useMemo(
    () =>
      Array.from(new Set(summaryRows.map((item) => item.storeName)))
        .sort((a, b) => a.localeCompare(b))
        .map((store) => ({ value: store, label: store })),
    [summaryRows],
  );

  const deliveryOptions = useMemo(
    () => planningData.deliveryDates.map((date) => ({ value: date, label: formatDateKeyBr(date) })),
    [planningData.deliveryDates],
  );

  const kpis = {
    total: summaryRows.length,
    liberados: summaryRows.filter((item) => item.releasedToProduction).length,
    emProducao: summaryRows.filter((item) => item.status === "em_producao").length,
    aguardandoExpedicao: summaryRows.filter((item) => item.status === "aguardando_expedicao").length,
  };

  const allExpanded =
    pagination.items.length > 0 && pagination.items.every((item) => expandedOrderIds.includes(item.id));

  function toggleExpand(orderId: string) {
    setExpandedOrderIds((current) =>
      current.includes(orderId) ? current.filter((item) => item !== orderId) : [...current, orderId],
    );
  }

  function toggleExpandAll() {
    if (allExpanded) {
      setExpandedOrderIds((current) => current.filter((item) => !pagination.items.some((row) => row.id === item)));
      return;
    }

    setExpandedOrderIds((current) => [
      ...new Set([...current, ...pagination.items.map((item) => item.id)]),
    ]);
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setStoreFilter("all");
    setDeliveryFilter("all");
    setPage(1);
  }

  return (
    <PageLayout
      title="Pedidos"
      description="Audite o pedido, expanda os itens inline e libere para produção somente quando estiver pronto."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Pedidos" },
      ]}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Pedidos" value={kpis.total} icon={ShoppingCart} tone="neutral" compactValue />
        <KPICard title="Liberados" value={kpis.liberados} icon={ListChecks} tone="info" compactValue />
        <KPICard title="Em Produção" value={kpis.emProducao} icon={Factory} tone="warning" compactValue />
        <KPICard title="Prontos p/ Expedição" value={kpis.aguardandoExpedicao} icon={Truck} tone="success" compactValue />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Controle de Referência</CardTitle>
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
      </Card>

      <FactoryFlow
        currentKey="pedidos"
        steps={flowSteps}
        subtitle="Fluxo correto: pedido auditado -> liberar para produção -> acompanhar progresso por item -> expedir."
      />

      <Card>
        <CardHeader>
          <CardTitle>Como funciona agora</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Passo 1</p>
            <p className="mt-1 font-medium text-foreground">Audite o pedido e expanda os itens sem sair da lista.</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Passo 2</p>
            <p className="mt-1 font-medium text-foreground">Use “Liberar para produção” para gerar as OPs consolidadas.</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Passo 3</p>
            <p className="mt-1 font-medium text-foreground">O status do pedido sobe automaticamente a partir do avanço dos produtos da OP.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-background via-background to-panel/80">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Pedidos Auditáveis</CardTitle>
              <p className="text-xs text-muted-foreground">
                {filteredOrders.length} de {summaryRows.length} pedidos visíveis
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={toggleExpandAll}>
              {allExpanded ? "Recolher todos" : "Expandir todos"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <OperationFiltersCard
            title="Filtros dos Pedidos"
            summary={`${filteredOrders.length} de ${summaryRows.length} pedidos visíveis`}
            helperText="Filtre por pedido, loja, data de entrega ou status."
            searchLabel="Busca"
            searchPlaceholder="Buscar por pedido ou loja..."
            searchValue={searchTerm}
            onSearch={(value) => {
              setSearchTerm(value);
              setPage(1);
            }}
            fields={[
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: (value) => {
                  setStatusFilter(value);
                  setPage(1);
                },
                options: [
                  { value: "em_espera", label: "Em Espera" },
                  { value: "agendado", label: "Agendado" },
                  { value: "em_producao", label: "Em Produção" },
                  { value: "aguardando_expedicao", label: "Aguardando Expedição" },
                ],
              },
              {
                key: "store",
                label: "Loja",
                value: storeFilter,
                onChange: (value) => {
                  setStoreFilter(value);
                  setPage(1);
                },
                options: storeOptions,
              },
              {
                key: "delivery",
                label: "Recebimento",
                value: deliveryFilter,
                onChange: (value) => {
                  setDeliveryFilter(value);
                  setPage(1);
                },
                options: deliveryOptions,
              },
            ]}
            activeFiltersCount={[
              searchTerm.trim().length > 0 ? 1 : 0,
              statusFilter !== "all" ? 1 : 0,
              storeFilter !== "all" ? 1 : 0,
              deliveryFilter !== "all" ? 1 : 0,
            ].reduce((sum, item) => sum + item, 0)}
            onClear={clearFilters}
          />

          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full min-w-[980px] border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Pedido</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Loja</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Recebimento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produtos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Total (Kg)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Progresso</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pagination.items.map((order) => {
                  const items = orderItemsByOrderId.get(order.id) ?? [];
                  const isExpanded = expandedOrderIds.includes(order.id);
                  return (
                    <Fragment key={order.id}>
                      <tr className="hover:bg-panel/30">
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 font-medium text-foreground"
                            onClick={() => toggleExpand(order.id)}
                          >
                            {isExpanded ? <ArrowDown className="size-4" /> : <ArrowRight className="size-4" />}
                            {order.code}
                          </button>
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{order.storeName}</td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <span className="rounded-md bg-warning/25 px-2 py-1 text-xs font-semibold text-warning-foreground">
                            {order.deliveryDateLabel}
                          </span>
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          {order.productsCount} produtos
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{order.totalKg} Kg</td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <div className="min-w-[150px]">
                            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{order.workflowProgress.toFixed(1)}%</span>
                              <span>{order.releasedToProduction ? "Liberado" : "Aguardando liberação"}</span>
                            </div>
                            <div className="h-2 rounded-full bg-panel">
                              <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(order.workflowProgress, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="border-t border-border/70 bg-card px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button asChild type="button" variant="outline" size="sm">
                              <Link href={`/gestor-fabrica/pedidos/${order.id}?ref=${referenceDate}`}>Detalhe</Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openPrintPage(`/impressao/pedido-loja/${order.id}?ref=${referenceDate}`)}
                            >
                              Folha Loja
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!order.availableForRelease || order.releasedToProduction}
                              onClick={() => workflow.releaseOrder(order.id)}
                            >
                              {order.releasedToProduction ? "Liberado" : "Liberar para produção"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`${order.id}-expanded`}>
                          <td colSpan={8} className="border-t border-border/70 bg-panel/10 px-4 py-4">
                            <div className="overflow-hidden rounded-xl border border-border/70">
                              <table className="w-full border-collapse">
                                <thead className="bg-card">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Qtd Loja</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Kg Interno</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Produção</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Linha</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Status do item</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                        {item.productCode} · {item.productName}
                                      </td>
                                      <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                        {item.requestedQuantity} {item.requestedUnit}
                                      </td>
                                      <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.internalKg}</td>
                                      <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                        {item.productionDate ? formatDateKeyBr(item.productionDate) : "Sem agenda"}
                                      </td>
                                      <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.scheduleName ?? "Sem linha"}</td>
                                      <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                        <StatusBadge status={item.status} />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            label="pedidos"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
