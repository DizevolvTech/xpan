"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Factory, ListChecks, Package, ShoppingCart, Truck } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { InfoHint } from "@/components/shared/info-hint";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type DeliveryExecutionStatus, useDeliveryExecution } from "@/lib/delivery-execution";
import {
  getExpeditionVisibleStatus,
  isOrderReadyForDeliveryExecution,
  type ExpeditionVisibleStatus,
} from "@/lib/delivery-workflow";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import {
  formatDateKeyBr,
  type ExpeditionRow,
  type ProductionOrderRow,
} from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";
import { sortItemsByTemporalValue, type TemporalSortOrder } from "@/lib/temporal-table-sort";
import { formatKgLabel } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

type ExpeditionOrderRow = ExpeditionRow & {
  checklistReady: boolean;
  checklistStatus: DeliveryExecutionStatus;
  visibleStatus: ExpeditionVisibleStatus;
  readyOpsCount: number;
  totalOpsCount: number;
};

function describeChecklistStatus(item: ExpeditionOrderRow) {
  if (!item.checklistReady) {
    if (item.totalOpsCount > 0 && item.readyOpsCount === item.totalOpsCount) {
      return "Todas as OPs estao prontas, mas o pedido ainda nao fechou 100% para a expedicao.";
    }
    if (item.totalOpsCount > 0) {
      return `Aguardando produção completa: ${item.readyOpsCount}/${item.totalOpsCount} OPs prontas`;
    }
    return "Aguardando liberação e conclusão da produção";
  }
  if (item.checklistStatus === "aguardando_expedicao") {
    return "Checklist pendente";
  }
  if (item.checklistStatus === "pronto_coleta") {
    return "Checklist concluído e pronto para coleta";
  }
  if (item.checklistStatus === "em_rota" || item.checklistStatus === "no_destino") {
    return "Checklist concluído e entrega em andamento";
  }
  if (item.checklistStatus === "entregue") {
    return "Checklist concluído e pedido entregue";
  }

  return "Checklist concluído com tentativa de entrega falha";
}

export default function ExpedicaoPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [searchTerm, setSearchTerm] = useState("");
  const [deliveryDateFilter, setDeliveryDateFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<TemporalSortOrder>("recent_first");
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const { planningData: planningSnapshot } = useFactoryPlanningSnapshot(anchorDate);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );
  const deliveryExecutionState = useDeliveryExecution();
  const opsSummaryByOrderId = useMemo(() => {
    const summary = new Map<string, { readyOpsCount: number; totalOpsCount: number }>();

    planningData.productionOrders.forEach((op: ProductionOrderRow) => {
      const relatedOrderIds = new Set(op.sourceItems.map((sourceItem) => sourceItem.orderId));
      relatedOrderIds.forEach((orderId) => {
        const current = summary.get(orderId) ?? { readyOpsCount: 0, totalOpsCount: 0 };
        current.totalOpsCount += 1;
        if (op.status === "aguardando_expedicao") {
          current.readyOpsCount += 1;
        }
        summary.set(orderId, current);
      });
    });

    return summary;
  }, [planningData.productionOrders]);

  const orderRows = useMemo<ExpeditionOrderRow[]>(
    () =>
      [...planningData.expedition]
        .sort((a, b) => {
          const byDelivery = a.deliveryDate.localeCompare(b.deliveryDate);
          if (byDelivery !== 0) {
            return byDelivery;
          }
          const byStore = a.storeName.localeCompare(b.storeName);
          if (byStore !== 0) {
            return byStore;
          }
          return a.orderCode.localeCompare(b.orderCode);
        })
        .map((item) => {
          const opsSummary = opsSummaryByOrderId.get(item.orderId) ?? { readyOpsCount: 0, totalOpsCount: 0 };
          const productionReady = isOrderReadyForDeliveryExecution(item.status);
          const execution = deliveryExecutionState.resolveExecution(item.orderId, productionReady);
          const checklistReady = productionReady;
          const checklistStatus = execution.status;

          return {
            ...item,
            checklistReady,
            checklistStatus,
            visibleStatus: getExpeditionVisibleStatus(item.status, checklistStatus),
            readyOpsCount: opsSummary.readyOpsCount,
            totalOpsCount: opsSummary.totalOpsCount,
          };
        }),
    [deliveryExecutionState, opsSummaryByOrderId, planningData.expedition],
  );

  const filteredOrders = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return orderRows.filter((item) => {
      const matchesSearch =
        normalizedTerm.length === 0 ||
        item.orderCode.toLowerCase().includes(normalizedTerm) ||
        item.storeName.toLowerCase().includes(normalizedTerm);
      const matchesDelivery = deliveryDateFilter === "all" || item.deliveryDate === deliveryDateFilter;
      const matchesStore = storeFilter === "all" || item.storeName === storeFilter;
      const matchesStatus = statusFilter === "all" || item.visibleStatus === statusFilter;

      return matchesSearch && matchesDelivery && matchesStore && matchesStatus;
    });
  }, [deliveryDateFilter, orderRows, searchTerm, statusFilter, storeFilter]);
  const sortedOrders = useMemo(
    () => sortItemsByTemporalValue(filteredOrders, sortOrder, ["deliveryDate"]),
    [filteredOrders, sortOrder],
  );

  const storeOptions = useMemo(
    () =>
      Array.from(new Set(orderRows.map((item) => item.storeName)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    [orderRows],
  );

  const deliveryOptions = useMemo(
    () => planningData.deliveryDates.map((date) => ({ value: date, label: formatDateKeyBr(date) })),
    [planningData.deliveryDates],
  );

  const ordersPagination = useMemo(
    () => paginateArray(sortedOrders, ordersPage, ordersPageSize),
    [ordersPage, ordersPageSize, sortedOrders],
  );

  const kpis = {
    pedidos: orderRows.length,
    itens: orderRows.reduce((sum, item) => sum + item.itemsCount, 0),
    totalKg: Number(orderRows.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2)),
    prontos: orderRows.filter((item) => item.checklistReady && item.checklistStatus === "aguardando_expedicao").length,
  };

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

  const columns = [
    { key: "orderCode", header: "Pedido" },
    { key: "storeName", header: "Loja" },
    {
      key: "deliveryDateLabel",
      header: "Recebimento",
      render: (item: ExpeditionOrderRow) => (
        <span className="rounded-md bg-warning/25 px-2 py-1 text-xs font-semibold text-warning-foreground">
          {item.deliveryDateLabel}
        </span>
      ),
    },
    { key: "itemsCount", header: "Itens" },
    { key: "totalKg", header: "Carga (Kg)" },
    {
      key: "opsProgress",
      header: "OPs prontas",
      render: (item: ExpeditionOrderRow) =>
        item.totalOpsCount > 0 ? `${item.readyOpsCount}/${item.totalOpsCount}` : "-",
    },
    {
      key: "workflowProgress",
      header: "Conclusão",
      render: (item: ExpeditionOrderRow) => (
        <div className="min-w-[170px]">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.workflowProgress.toFixed(1)}%</span>
            <span>{item.releasedToProduction ? "Liberado" : "Aguardando liberação"}</span>
          </div>
          <div className="h-2 rounded-full bg-panel">
            <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(item.workflowProgress, 100)}%` }} />
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: ExpeditionOrderRow) => <StatusBadge status={item.visibleStatus} />,
    },
    {
      key: "actions",
      header: "Ações",
      render: (item: ExpeditionOrderRow) => (
        <div className="flex min-w-[240px] flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => openPrintPage(`/impressao/expedicao/${item.id}?ref=${anchorDate}`)}>
              Imprimir
            </Button>
            {item.checklistReady ? (
              <Button asChild type="button" size="sm" variant={item.checklistStatus === "aguardando_expedicao" ? "default" : "outline"}>
                <Link href={`/gestor-fabrica/expedicao/${item.id}?ref=${anchorDate}`}>
                  {item.checklistStatus === "aguardando_expedicao" ? "Abrir checklist" : "Ver checklist"}
                </Link>
              </Button>
            ) : (
              <Button type="button" size="sm" disabled>
                Aguardando produção
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{describeChecklistStatus(item)}</span>
        </div>
      ),
    },
  ];

  const activeFiltersCount = [
    searchTerm.trim().length > 0 ? 1 : 0,
    deliveryDateFilter !== "all" ? 1 : 0,
    storeFilter !== "all" ? 1 : 0,
    statusFilter !== "all" ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  function clearFilters() {
    setSearchTerm("");
    setDeliveryDateFilter("all");
    setStoreFilter("all");
    setStatusFilter("all");
    setOrdersPage(1);
  }

  return (
    <PageLayout
      title="Expedição"
      description="Checklist final por loja e pedido. A expedição só abre quando todas as OPs vinculadas ao pedido estiverem concluídas."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Expedição" },
      ]}
      actions={
        <Button asChild type="button" variant="outline">
          <Link href="/gestor-fabrica/ordens-producao">
            <ArrowLeft className="size-4" />
            Voltar para produção
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Pedidos" value={kpis.pedidos} icon={Truck} tone="info" compactValue />
        <KPICard title="Itens" value={kpis.itens} icon={Package} tone="neutral" compactValue />
        <KPICard title="Carga total" value={formatKgLabel(kpis.totalKg, { maximumFractionDigits: 2 })} icon={ListChecks} tone="success" compactValue />
        <KPICard title="Prontos para checklist" value={kpis.prontos} icon={ShoppingCart} tone="warning" compactValue />
      </div>

      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela da expedição"
        description="Veja toda a fila, um único recebimento ou um período fechado mantendo a mesma leitura entre checklist e entrega."
      />

      <FactoryFlow
        currentKey="expedicao"
        steps={flowSteps}
        subtitle="A separação final deixou de depender de edição manual de status. Ela abre quando a produção conclui."
      />

      <OperationFiltersCard
        title="Filtros da Expedição"
        summary={`${filteredOrders.length} de ${orderRows.length} pedidos visíveis`}
        searchLabel="Busca"
        searchPlaceholder="Buscar por pedido ou loja..."
        searchValue={searchTerm}
        onSearch={(value) => {
          setSearchTerm(value);
          setOrdersPage(1);
        }}
        activeFiltersCount={activeFiltersCount}
        onClear={clearFilters}
        helperText="O status aqui é por pedido, não por OP. 'Aguardando expedição' só aparece quando todas as OPs vinculadas ao pedido estiverem concluídas."
        fields={[
          {
            key: "deliveryDate",
            label: "Recebimento",
            value: deliveryDateFilter,
            onChange: (value) => {
              setDeliveryDateFilter(value);
              setOrdersPage(1);
            },
            options: deliveryOptions,
          },
          {
            key: "store",
            label: "Loja",
            value: storeFilter,
            onChange: (value) => {
              setStoreFilter(value);
              setOrdersPage(1);
            },
            options: storeOptions,
          },
          {
            key: "status",
            label: "Status",
            value: statusFilter,
            onChange: (value) => {
              setStatusFilter(value);
              setOrdersPage(1);
            },
            options: [
              { value: "em_espera", label: "Em espera" },
              { value: "agendado", label: "Agendado" },
              { value: "em_producao", label: "Em produção" },
              { value: "aguardando_expedicao", label: "Aguardando expedição" },
              { value: "pronto_coleta", label: "Pronto para coleta" },
              { value: "em_rota", label: "Em rota" },
              { value: "no_destino", label: "No destino" },
              { value: "entregue", label: "Entregue" },
              { value: "tentativa_falha", label: "Tentativa falha" },
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-background via-background to-panel/80">
          <div className="flex items-center gap-1.5">
            <CardTitle>Fila de checklists</CardTitle>
            <InfoHint
              size="sm"
              content={
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  <li>Imprima o checklist por pedido diretamente na lista.</li>
                  <li>
                    O status aqui é por pedido: ele só vira pronto quando todas as OPs vinculadas chegarem a 100%.
                  </li>
                  <li>Não há roteirização nem nota de transferência nesta rodada.</li>
                </ul>
              }
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            data={ordersPagination.items}
            columns={columns}
            keyField="id"
            pagination={false}
            showFooterControls={false}
            onRowClick={(item) => {
              if (item.checklistReady) {
                window.location.assign(`/gestor-fabrica/expedicao/${item.id}?ref=${anchorDate}`);
              }
            }}
            isRowClickable={(item) => item.checklistReady}
            emptyMessage="Nenhum pedido encontrado para os filtros"
            stickyHeader
          />

          <PaginationControls
            page={ordersPagination.page}
            pageSize={ordersPagination.pageSize}
            totalItems={ordersPagination.totalItems}
            totalPages={ordersPagination.totalPages}
            startIndex={ordersPagination.startIndex}
            endIndex={ordersPagination.endIndex}
            onPageChange={setOrdersPage}
            onPageSizeChange={(size) => {
              setOrdersPageSize(size);
              setOrdersPage(1);
            }}
            label="pedidos"
            sortOrder={sortOrder}
            onSortOrderChange={(nextSortOrder) => {
              setSortOrder(nextSortOrder);
              setOrdersPage(1);
            }}
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
