"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarRange, Factory, ListChecks, Package, Truck } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type DeliveryExecutionStatus, useDeliveryExecution } from "@/lib/delivery-execution";
import {
  getExpeditionVisibleStatus,
  isOrderReadyForDeliveryExecution,
  type ExpeditionVisibleStatus,
} from "@/lib/delivery-workflow";
import {
  filterFactoryPlanningDataByOperationalScope,
  type OperationalDateScopeMode,
} from "@/lib/operational-date-scope";
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
      return "Todas as OPs estão prontas, mas o pedido ainda não fechou 100% para a expedição.";
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
  const [isScopeOpen, setIsScopeOpen] = useState(false);
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

  // Stats secundárias: dado útil mas não compete com os 3 KPIs primários.
  const secondaryStats = [
    { label: "Itens", value: kpis.itens },
  ];

  const scopeLabel =
    scope.mode === "all"
      ? "Todo o período"
      : scope.mode === "day"
        ? scope.date
        : `${scope.startDate} → ${scope.endDate}`;

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

  // Tablet do chão: pedido/loja em texto base, recebimento em chip legível,
  // ação primária em size="lg" (h-11=44px) atendendo UX-0010.
  const columns = [
    {
      key: "orderCode",
      header: "Pedido",
      render: (item: ExpeditionOrderRow) => (
        <span className="font-mono text-base font-semibold tabular-nums text-foreground">
          {item.orderCode}
        </span>
      ),
    },
    {
      key: "storeName",
      header: "Loja",
      render: (item: ExpeditionOrderRow) => (
        <span className="text-sm font-medium text-foreground">{item.storeName}</span>
      ),
    },
    {
      key: "deliveryDateLabel",
      header: "Recebimento",
      render: (item: ExpeditionOrderRow) => (
        <span className="inline-flex items-center rounded-md bg-warning/25 px-2.5 py-1 text-sm font-semibold tabular-nums text-warning-foreground">
          {item.deliveryDateLabel}
        </span>
      ),
    },
    {
      key: "itemsCount",
      header: "Itens",
      render: (item: ExpeditionOrderRow) => (
        <span className="text-sm tabular-nums text-foreground">{item.itemsCount}</span>
      ),
    },
    {
      key: "totalKg",
      header: "Carga (Kg)",
      render: (item: ExpeditionOrderRow) => (
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatKgLabel(item.totalKg)}
        </span>
      ),
    },
    {
      key: "opsProgress",
      header: "OPs prontas",
      render: (item: ExpeditionOrderRow) =>
        item.totalOpsCount > 0 ? (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {item.readyOpsCount}/{item.totalOpsCount}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      key: "workflowProgress",
      header: "Conclusão",
      render: (item: ExpeditionOrderRow) => (
        <div className="min-w-[170px]">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {item.workflowProgress.toFixed(1)}%
            </span>
            <span className="text-[11px] text-muted-foreground">
              {item.releasedToProduction ? "Liberado" : "Aguardando liberação"}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-panel">
            <div
              className="h-full rounded-full bg-info"
              style={{ width: `${Math.min(item.workflowProgress, 100)}%` }}
            />
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
        <div className="flex min-w-[260px] flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {item.checklistReady ? (
              <Button
                asChild
                type="button"
                size="lg"
                variant={item.checklistStatus === "aguardando_expedicao" ? "default" : "outline"}
              >
                <Link href={`/chao-fabrica/expedicao/${item.id}?ref=${anchorDate}`}>
                  {item.checklistStatus === "aguardando_expedicao" ? "Abrir checklist" : "Ver checklist"}
                </Link>
              </Button>
            ) : (
              <Button type="button" size="lg" disabled>
                Aguardando produção
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => openPrintPage(`/impressao/expedicao/${item.id}?ref=${anchorDate}`)}
            >
              Imprimir
            </Button>
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
      {/* Action bar — pílula de escopo. Chão opera no "agora": só precisa
          saber qual janela está visível, sem card cheio com descrição. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-4">
        <Popover open={isScopeOpen} onOpenChange={setIsScopeOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-card px-4 text-sm font-medium text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ajustar janela operacional"
            >
              <CalendarRange className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">Janela:</span>
              <span className="font-semibold">{scopeLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] space-y-3 p-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Janela da expedição
              </p>
              <p className="text-xs text-muted-foreground">{summary}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Modo</Label>
              <Select
                value={scope.mode}
                onValueChange={(value) => setMode(value as OperationalDateScopeMode)}
              >
                <SelectTrigger className="bg-background/80">
                  <SelectValue placeholder="Selecionar modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o período</SelectItem>
                  <SelectItem value="day">Data específica</SelectItem>
                  <SelectItem value="range">Período fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope.mode === "day" ? (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Data</Label>
                <Input
                  type="date"
                  value={scope.date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            ) : null}
            {scope.mode === "range" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={scope.startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={scope.endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>

      {/* 3 KPIs primários — número grande, leitura de longe no tablet/totem. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KPICard title="Pedidos" value={kpis.pedidos} icon={Truck} tone="info" compactValue />
        <KPICard
          title="Prontos para checklist"
          value={kpis.prontos}
          icon={ListChecks}
          tone="warning"
          compactValue
        />
        <KPICard
          title="Carga total"
          value={formatKgLabel(kpis.totalKg, { maximumFractionDigits: 2 })}
          icon={Factory}
          tone="success"
          compactValue
        />
      </div>

      {/* Stats secundárias: linha enxuta de apoio. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
        {secondaryStats.map((stat, index) => (
          <span key={stat.label} className="inline-flex items-center gap-1.5">
            {index > 0 && <span aria-hidden className="text-border">·</span>}
            <Package className="size-3 text-muted-foreground/70" aria-hidden />
            <span>{stat.label}:</span>
            <span className="font-semibold text-foreground tabular-nums">{stat.value}</span>
          </span>
        ))}
      </div>

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
        <CardHeader className="border-b border-border/60">
          <CardTitle>Fila de checklists</CardTitle>
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
                window.location.assign(`/chao-fabrica/expedicao/${item.id}?ref=${anchorDate}`);
              }
            }}
            isRowClickable={(item) => item.checklistReady}
            rowClassName={() => "min-h-[44px]"}
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

      {/* Navegação entre etapas — footer. Onde ir depois desta tela. */}
      <FactoryFlow
        currentKey="expedicao"
        steps={flowSteps}
        subtitle="A fila do chão de fábrica mostra somente pedidos realmente prontos para conferência final."
      />
    </PageLayout>
  );
}
