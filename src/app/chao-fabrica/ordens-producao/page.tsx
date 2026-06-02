"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarRange,
  ClipboardList,
  Factory,
  Layers,
  PackageCheck,
  Truck,
} from "lucide-react";

import { ProductionOrderActionsMenu } from "@/components/production/production-order-actions-menu";
import { ProductionOrderStatusDialog } from "@/components/production/production-order-status-dialog";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { useToast } from "@/components/shared/toast";
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
import {
  filterFactoryPlanningDataByOperationalScope,
  type OperationalDateScopeMode,
} from "@/lib/operational-date-scope";
import {
  formatDateKeyBr,
  type OrderStatus,
  type ProductionItemStatus,
  type ProductionOrderRow,
} from "@/lib/order-planning";
import { getProductionOrderNavKey } from "@/lib/factory-kanban";
import { paginateArray } from "@/lib/pagination";
import { sortItemsByTemporalValue, type TemporalSortOrder } from "@/lib/temporal-table-sort";
import { hierarchyLabels } from "@/lib/production-planning";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import {
  ReleaseOrderBlockedError,
  useFactoryPlanningSnapshot,
} from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";

type OpQueueRow = ProductionOrderRow & {
  capacityKg: number;
  completion: number;
  productsCount: number;
};

type DailyLineRow = {
  id: string;
  productionDate: string;
  productionDateLabel: string;
  lineName: string;
  totalKg: number;
  opsCount: number;
  itemsCount: number;
};

const ORDER_STATUS_FILTER_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "em_espera", label: "Em Espera" },
  { value: "agendado", label: "Agendado" },
  { value: "em_producao", label: "Em Produção" },
  { value: "aguardando_expedicao", label: "Aguardando Expedição" },
  { value: "rota_entrega", label: "Rota de Entrega" },
  { value: "cancelado", label: "Cancelado" },
];

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

export default function OrdensProducaoPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [productionDateFilter, setProductionDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<TemporalSortOrder>("recent_first");
  const [opPage, setOpPage] = useState(1);
  const [opPageSize, setOpPageSize] = useState(20);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const { planningData: planningSnapshot, updateProductionItemStatus } = useFactoryPlanningSnapshot(anchorDate);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );
  const { snapshot } = useMasterDataSnapshot();
  const toast = useToast();
  const confirm = useConfirm();

  const capacityByLineId = useMemo(
    () => new Map(snapshot.lines.map((line) => [line.id, line.capacityPerDayKg])),
    [snapshot.lines],
  );

  const opRows = useMemo<OpQueueRow[]>(
    () =>
      planningData.productionOrders.map((op) => ({
        ...op,
        capacityKg: capacityByLineId.get(op.lineId) ?? 0,
        completion: op.progress,
        productsCount: op.items.length,
      })),
    [capacityByLineId, planningData.productionOrders],
  );

  const filteredOps = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return opRows.filter((item) => {
      const matchesDate = productionDateFilter === "all" || item.productionDate === productionDateFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesCategory = sectorFilter === "all" || item.sectorName === sectorFilter;
      const matchesSubcategory = lineFilter === "all" || item.lineName === lineFilter;
      const matchesSearch =
        term.length === 0 ||
        item.code.toLowerCase().includes(term) ||
        item.sectorName.toLowerCase().includes(term) ||
        item.lineName.toLowerCase().includes(term) ||
        item.scheduleName.toLowerCase().includes(term) ||
        item.items.some(
          (product) =>
            product.productCode.toLowerCase().includes(term) || product.productName.toLowerCase().includes(term),
        );

      return matchesDate && matchesStatus && matchesCategory && matchesSubcategory && matchesSearch;
    });
  }, [lineFilter, opRows, productionDateFilter, searchTerm, sectorFilter, statusFilter]);
  const sortedOps = useMemo(
    () => sortItemsByTemporalValue(filteredOps, sortOrder, ["productionDate"]),
    [filteredOps, sortOrder],
  );

  const opPagination = useMemo(() => paginateArray(sortedOps, opPage, opPageSize), [opPage, opPageSize, sortedOps]);

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(opRows.map((item) => item.sectorName)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    [opRows],
  );

  const subcategoryOptions = useMemo(
    () =>
      Array.from(new Set(opRows.map((item) => item.lineName)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    [opRows],
  );
  const statusOptions = useMemo(
    () =>
      ORDER_STATUS_FILTER_OPTIONS.filter((option) =>
        opRows.some((item) => item.status === option.value),
      ),
    [opRows],
  );

  const dailyLineRows = useMemo<DailyLineRow[]>(() => {
    const map = new Map<string, DailyLineRow>();

    opRows.forEach((op) => {
      const key = `${op.productionDate}|${op.lineName}`;
      const current = map.get(key);

      if (current) {
        current.totalKg = Number((current.totalKg + op.totalKg).toFixed(2));
        current.opsCount += 1;
        current.itemsCount += op.itemsCount;
        return;
      }

      map.set(key, {
        id: key,
        productionDate: op.productionDate,
        productionDateLabel: op.productionDateLabel,
        lineName: op.lineName,
        totalKg: op.totalKg,
        opsCount: 1,
        itemsCount: op.itemsCount,
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const byDate = a.productionDate.localeCompare(b.productionDate);
      if (byDate !== 0) {
        return byDate;
      }
      return a.lineName.localeCompare(b.lineName);
    });
  }, [opRows]);

  const alignedLineRows = useMemo(() => {
    const lines = Array.from(new Set(opRows.map((item) => item.lineName))).sort((a, b) => a.localeCompare(b));
    const dates = planningData.productionDates;
    const map = new Map<string, OpQueueRow[]>();

    opRows.forEach((row) => {
      const key = `${row.lineName}|${row.productionDate}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(row);
    });

    return { lines, dates, map };
  }, [opRows, planningData.productionDates]);

  const kpis = useMemo(
    () => ({
      totalOps: opRows.length,
      totalKg: Number(opRows.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2)),
      avgCompletion:
        opRows.length === 0
          ? 0
          : Number((opRows.reduce((sum, item) => sum + item.completion, 0) / opRows.length).toFixed(1)),
      activeSubcategories: new Set(opRows.map((item) => item.lineName)).size,
    }),
    [opRows],
  );

  // Stats secundárias: dados úteis, mas não competem com os 3 KPIs primários.
  // Tablet/totem do chão: número grande + lista alta + 1 botão grande. Resto vira texto.
  const secondaryStats = useMemo(
    () => [
      { label: "Carga total", value: `${formatKgLabel(kpis.totalKg, { maximumFractionDigits: 2 })}` },
      { label: "Linhas ativas", value: kpis.activeSubcategories },
    ],
    [kpis.activeSubcategories, kpis.totalKg],
  );

  const scopeLabel = useMemo(() => {
    if (scope.mode === "all") return "Todo o período";
    if (scope.mode === "day") return scope.date;
    return `${scope.startDate} → ${scope.endDate}`;
  }, [scope]);

  const selectedOp = useMemo(
    () => opRows.find((item) => item.id === selectedOpId) ?? null,
    [opRows, selectedOpId],
  );

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
    {
      key: "entregas",
      title: "Entregas",
      helper: "Execução em campo",
      // Esta tela não carrega o estado de execução de entregas; o detalhe vive
      // na própria tela de Entregas. Mantemos o passo navegável sem inventar fonte.
      value: 0,
      href: "/chao-fabrica/entregas",
      icon: Truck,
    },
  ];

  // Tablet do chão: tipografia maior em código da OP (visível de longe) e progresso.
  const columns = [
    {
      key: "code",
      header: "OP",
      render: (item: OpQueueRow) => (
        <span className="font-mono text-base font-semibold tabular-nums text-foreground">
          {item.code}
        </span>
      ),
    },
    {
      key: "productionDateLabel",
      header: "Data de produção",
      render: (item: OpQueueRow) => (
        <span className="text-sm tabular-nums text-foreground">{item.productionDateLabel}</span>
      ),
    },
    { key: "sectorName", header: hierarchyLabels.sector },
    { key: "lineName", header: hierarchyLabels.line },
    { key: "scheduleName", header: hierarchyLabels.schedule },
    {
      key: "productsCount",
      header: "Produtos",
      render: (item: OpQueueRow) => (
        <span className="text-sm tabular-nums text-foreground">{item.productsCount}</span>
      ),
    },
    {
      key: "totalKg",
      header: "Carga (Kg)",
      render: (item: OpQueueRow) => (
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatKgValue(item.totalKg)}
        </span>
      ),
    },
    {
      key: "completion",
      header: "% conclusão",
      render: (item: OpQueueRow) => (
        <div className="min-w-[200px]">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {item.completion.toFixed(1)}%
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatKgValue(item.capacityKg)} Kg/dia
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-panel">
            <div
              className="h-full rounded-full bg-info"
              style={{ width: `${Math.min(item.completion, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: OpQueueRow) => <StatusBadge status={item.status} />,
    },
    {
      key: "documents",
      header: "Ações",
      render: (item: OpQueueRow) => (
        <ProductionOrderActionsMenu
          detailHref={`/chao-fabrica/ordens-producao/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`}
          preWeighingHref={`/impressao/pre-pesagem/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`}
          productionPrintHref={`/impressao/producao/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`}
          onOpenWorkflow={() => openWorkflowDialog(item.id)}
          onOpenPrint={openPrintPage}
        />
      ),
    },
  ];

  const dailyColumns = [
    { key: "productionDateLabel", header: "Data" },
    { key: "lineName", header: hierarchyLabels.line },
    { key: "totalKg", header: "Kg planejados" },
    { key: "opsCount", header: "OPs" },
    { key: "itemsCount", header: "Itens consolidados" },
  ];

  const activeFiltersCount = [
    searchTerm.trim().length > 0 ? 1 : 0,
    productionDateFilter !== "all" ? 1 : 0,
    statusFilter !== "all" ? 1 : 0,
    sectorFilter !== "all" ? 1 : 0,
    lineFilter !== "all" ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  function clearFilters() {
    setSearchTerm("");
    setProductionDateFilter("all");
    setStatusFilter("all");
    setSectorFilter("all");
    setLineFilter("all");
    setOpPage(1);
  }

  function openWorkflowDialog(opId: string) {
    setWorkflowError(null);
    setSelectedOpId(opId);
  }

  async function handleWorkflowAction(productionItemKey: string, status: ProductionItemStatus) {
    setWorkflowError(null);
    setPendingItemKey(productionItemKey);

    try {
      await updateProductionItemStatus(productionItemKey, status);
    } catch (error) {
      // Trava de data futura: o servidor manda 400 + reason=production_in_future.
      // Se forceable (papel gestor/admin), oferecer "concluir mesmo assim" e refazer
      // com force: true — espelha o override de liberação em gestor-fabrica.
      if (
        error instanceof ReleaseOrderBlockedError &&
        error.forceable &&
        error.reason === "production_in_future"
      ) {
        const confirmed = await confirm({
          title: "Concluir produção em data futura?",
          description: error.message,
          tone: "default",
          confirmLabel: "Concluir mesmo assim",
          cancelLabel: "Cancelar",
        });
        if (confirmed) {
          try {
            await updateProductionItemStatus(productionItemKey, status, { force: true });
          } catch (forceError) {
            const message =
              forceError instanceof Error
                ? forceError.message
                : "Falha ao atualizar o estágio operacional.";
            setWorkflowError(message);
            toast.error(message);
          }
        }
      } else {
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
      title="Ordens de Produção"
      description="Painel operacional do chão de fábrica com avanço real por OP e documentos dedicados."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Chão de Fábrica", href: "/chao-fabrica" },
        { label: "Ordens de Produção" },
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
      {/* Action bar — pílula de escopo. ScopeCard cheio fica nas telas analíticas;
          chão opera no "agora" e só precisa saber qual janela está visível. */}
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
                Janela da produção
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

      {/* 3 KPIs primários — números grandes, leitura de longe. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KPICard title="OPs liberadas" value={kpis.totalOps} icon={ClipboardList} tone="neutral" compactValue />
        <KPICard title="% conclusão média" value={`${kpis.avgCompletion}%`} icon={PackageCheck} tone="info" compactValue />
        <KPICard
          title="Carga em produção"
          value={formatKgLabel(kpis.totalKg, { maximumFractionDigits: 2 })}
          icon={Factory}
          tone="success"
          compactValue
        />
      </div>

      {/* Stats secundárias: linha enxuta de apoio, sem mini-cards aninhados. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
        {secondaryStats.map((stat, index) => (
          <span key={stat.label} className="inline-flex items-center gap-1.5">
            {index > 0 && <span aria-hidden className="text-border">·</span>}
            <Layers className="size-3 text-muted-foreground/70" aria-hidden />
            <span>{stat.label}:</span>
            <span className="font-semibold text-foreground tabular-nums">{stat.value}</span>
          </span>
        ))}
      </div>

      <OperationFiltersCard
        title="Filtros da Produção"
        summary={`${filteredOps.length} de ${opRows.length} OPs visíveis`}
        searchLabel="Busca"
        searchPlaceholder="Buscar por OP, produto, categoria ou linha de produção..."
        searchValue={searchTerm}
        onSearch={(value) => {
          setSearchTerm(value);
          setOpPage(1);
        }}
        activeFiltersCount={activeFiltersCount}
        onClear={clearFilters}
        helperText="Kg seguem como métrica principal; progresso operacional indica a prioridade real da fila."
        fields={[
          {
            key: "productionDate",
            label: "Data de produção",
            value: productionDateFilter,
            onChange: (value) => {
              setProductionDateFilter(value);
              setOpPage(1);
            },
            options: planningData.productionDates.map((date) => ({ value: date, label: formatDateKeyBr(date) })),
          },
          {
            key: "status",
            label: "Status",
            value: statusFilter,
            onChange: (value) => {
              setStatusFilter(value);
              setOpPage(1);
            },
            options: statusOptions,
          },
          {
            key: "sector",
            label: hierarchyLabels.sector,
            value: sectorFilter,
            onChange: (value) => {
              setSectorFilter(value);
              setOpPage(1);
            },
            options: categoryOptions,
          },
          {
            key: "line",
            label: hierarchyLabels.line,
            value: lineFilter,
            onChange: (value) => {
              setLineFilter(value);
              setOpPage(1);
            },
            options: subcategoryOptions,
          },
        ]}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <CardTitle>Fila de OPs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            data={opPagination.items}
            columns={columns}
            keyField="id"
            pagination={false}
            showFooterControls={false}
            onRowClick={(item) =>
              window.location.assign(
                `/chao-fabrica/ordens-producao/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`,
              )
            }
            rowClassName={() => "min-h-[44px]"}
            emptyMessage="Nenhuma OP encontrada para os filtros"
            stickyHeader
          />

          <PaginationControls
            page={opPagination.page}
            pageSize={opPagination.pageSize}
            totalItems={opPagination.totalItems}
            totalPages={opPagination.totalPages}
            startIndex={opPagination.startIndex}
            endIndex={opPagination.endIndex}
            onPageChange={setOpPage}
            onPageSizeChange={(size) => {
              setOpPageSize(size);
              setOpPage(1);
            }}
            label="OPs"
            sortOrder={sortOrder}
            onSortOrderChange={(nextSortOrder) => {
              setSortOrder(nextSortOrder);
              setOpPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Visões analíticas — fora da primeira dobra. Chão precisa decidir
          qual OP iniciar agora; resumos por linha/dia são para auditoria. */}
      <details className="group rounded-xl border border-border/60 bg-panel/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
          <span>Visões analíticas por linha</span>
          <span className="text-xs font-medium text-muted-foreground group-open:hidden">Mostrar</span>
          <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">Ocultar</span>
        </summary>
        <div className="space-y-4 px-4 pb-4 pt-1">
          <Card>
            <CardHeader>
              <CardTitle>Resumo diário por linha de produção</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={dailyLineRows}
                columns={dailyColumns}
                keyField="id"
                emptyMessage="Sem carga planejada para a referência atual"
                compact
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kg por linha de produção e dia</CardTitle>
            </CardHeader>
            <CardContent>
              <PaginatedSection items={alignedLineRows.lines} label="linhas de produção" initialPageSize={8}>
                {(paginatedLines) => (
                  <div className="overflow-x-auto rounded-xl border border-border/80">
                    <table className="w-full min-w-[920px] border-collapse">
                      <thead className="bg-panel">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{hierarchyLabels.line}</th>
                          {alignedLineRows.dates.map((date) => (
                            <th key={date} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                              {formatDateKeyBr(date)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLines.map((lineName) => (
                          <tr key={lineName}>
                            <td className="border-t border-border/70 bg-card px-3 py-2 text-sm font-semibold text-foreground">{lineName}</td>
                            {alignedLineRows.dates.map((date) => {
                              const key = `${lineName}|${date}`;
                              const rows = alignedLineRows.map.get(key) ?? [];
                              const totalKg = rows.reduce((sum, row) => sum + row.totalKg, 0);
                              const totalItems = rows.reduce((sum, row) => sum + row.itemsCount, 0);

                              return (
                                <td key={key} className="border-t border-border/70 bg-card px-3 py-2 text-xs">
                                  {rows.length === 0 ? (
                                    <span className="text-muted-foreground">-</span>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="font-semibold text-foreground">{formatKgLabel(totalKg, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                      <div className="text-muted-foreground">
                                        {rows.length} OP(s) · {totalItems} item(ns)
                                      </div>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </PaginatedSection>
            </CardContent>
          </Card>
        </div>
      </details>

      {/* Navegação entre etapas — footer. Onde ir depois desta tela. */}
      <FactoryFlow
        currentKey="producao"
        steps={flowSteps}
        subtitle="O operador acompanha o avanço por produto. A expedição só libera após a conclusão da OP."
      />

      <ProductionOrderStatusDialog
        open={selectedOpId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOpId(null);
            setWorkflowError(null);
          }
        }}
        op={selectedOp}
        referenceDate={anchorDate}
        detailHrefBase="/chao-fabrica/ordens-producao"
        pendingItemKey={pendingItemKey}
        error={workflowError}
        onUpdateStatus={handleWorkflowAction}
      />
    </PageLayout>
  );
}
