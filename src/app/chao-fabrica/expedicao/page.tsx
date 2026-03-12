"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Factory, ListChecks, Package, Truck } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type DeliveryExecutionStatus, useDeliveryExecution } from "@/lib/delivery-execution";
import {
  formatDateKeyBr,
  getTodayDateKey,
  type ExpeditionRow,
} from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

type ExpeditionOrderRow = ExpeditionRow & {
  checklistReady: boolean;
  checklistStatus: DeliveryExecutionStatus;
};

function describeChecklistStatus(item: ExpeditionOrderRow) {
  if (!item.checklistReady) {
    return "Aguardando conclusão da produção";
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
  const [referenceDate, setReferenceDate] = useState(getTodayDateKey());
  const [searchTerm, setSearchTerm] = useState("");
  const [deliveryDateFilter, setDeliveryDateFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const { planningData } = useFactoryPlanningSnapshot(referenceDate);
  const deliveryExecutionState = useDeliveryExecution(referenceDate);

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
          const checklistReady = item.status === "aguardando_expedicao";
          const checklistStatus = deliveryExecutionState.resolveExecution(item.orderId, checklistReady).status;

          return {
            ...item,
            checklistReady,
            checklistStatus,
          };
        }),
    [deliveryExecutionState, planningData.expedition],
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
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesDelivery && matchesStore && matchesStatus;
    });
  }, [deliveryDateFilter, orderRows, searchTerm, statusFilter, storeFilter]);

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
    () => paginateArray(filteredOrders, ordersPage, ordersPageSize),
    [filteredOrders, ordersPage, ordersPageSize],
  );

  const kpis = {
    pedidos: orderRows.length,
    itens: orderRows.reduce((sum, item) => sum + item.itemsCount, 0),
    totalKg: Number(orderRows.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2)),
    prontos: orderRows.filter((item) => item.status === "aguardando_expedicao").length,
  };

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
      render: (item: ExpeditionOrderRow) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "Checklist",
      render: (item: ExpeditionOrderRow) => (
        <div className="flex min-w-[240px] flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => openPrintPage(`/impressao/expedicao/${item.id}?ref=${referenceDate}`)}>
              Imprimir
            </Button>
            {item.checklistReady ? (
              <Button asChild type="button" size="sm" variant={item.checklistStatus === "aguardando_expedicao" ? "default" : "outline"}>
                <Link href={`/chao-fabrica/expedicao/${item.id}?ref=${referenceDate}`}>
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
      description="Checklist final do chão de fábrica. A conferência só abre com a produção concluída."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Chão de Fábrica", href: "/chao-fabrica" },
        { label: "Expedição" },
      ]}
      actions={
        <Button asChild type="button" variant="outline">
          <Link href="/chao-fabrica">
            <ArrowLeft className="size-4" />
            Voltar ao painel
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Pedidos" value={kpis.pedidos} icon={Truck} tone="info" compactValue />
        <KPICard title="Itens" value={kpis.itens} icon={Package} tone="neutral" compactValue />
        <KPICard title="Carga total" value={`${kpis.totalKg} Kg`} icon={ListChecks} tone="success" compactValue />
        <KPICard title="Prontos para checklist" value={kpis.prontos} icon={Factory} tone="warning" compactValue />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Controle de Referência</CardTitle>
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
      </Card>

      <FactoryFlow
        currentKey="expedicao"
        steps={flowSteps}
        subtitle="A fila do chão de fábrica mostra somente pedidos realmente prontos para conferência final."
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
        helperText="Os pedidos aguardam checklist até a OP atingir 100%."
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
            ],
          },
        ]}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-background via-background to-panel/80">
          <CardTitle>Fila de checklists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            data={ordersPagination.items}
            columns={columns}
            keyField="id"
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
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
