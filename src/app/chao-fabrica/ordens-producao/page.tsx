"use client";

import { pushWithProgress } from "@/lib/navigation-progress";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

import { OpDayGroupsTable } from "@/components/production/op-day-groups-table";
import { groupOpsByProductionDay, summarizeOpDates } from "@/lib/op-day-groups";
import { getOperationalTodayKey } from "@/lib/workflow-date-guard";
import { StatusFilterBar } from "@/components/shared/status-filter-bar";
import { useListStatusFilter } from "@/lib/use-list-status-filter";
import { DayPrintButton } from "@/components/production/day-print-button";
import { resolveDayPrintDate } from "@/lib/day-print-date";
import {
  OpQueueAdvanceBar,
  OpQueueAdvanceButton,
  OpQueueSelectCell,
  useOpQueueAdvance,
} from "@/components/production/op-queue-advance";
import { ProductionOrderActionsMenu } from "@/components/production/production-order-actions-menu";
import { ProductionOrderStatusDialog } from "@/components/production/production-order-status-dialog";
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
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useFutureDateOverride } from "@/lib/use-future-date-override";
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

const OP_FINAL_STATUSES = ["aguardando_expedicao", "rota_entrega", "entregue", "cancelado"] as const;

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
  const router = useRouter();
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [productionDateFilter, setProductionDateFilter] = useState("all");
  // Feedback 5/6: por padrão só as pendências; multi-status, Ver histórico e padrão salvo por página.
  const statusFilter = useListStatusFilter({
    pageKey: "chao-fabrica-ordens-producao",
    finalStatuses: OP_FINAL_STATUSES,
    validStatuses: ORDER_STATUS_FILTER_OPTIONS.map((option) => option.value),
  });
  const [sectorFilter, setSectorFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<TemporalSortOrder>("old_first");
  // Feedback 10: OPs de dias futuros ficam escondidas por padrão; "Exibir futuras" mostra todas.
  const [showFuture, setShowFuture] = useState(false);
  const [opPage, setOpPage] = useState(1);
  const [opPageSize, setOpPageSize] = useState(20);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const {
    planningData: planningSnapshot,
    isLoading: isPlanningLoading,
    updateProductionItemStatus,
    advanceProductionItems,
    completeProductionBatch,
  } = useFactoryPlanningSnapshot(anchorDate);
  // Reunião 22/10 (bloco 4): avançar etapa direto da fila, uma ou várias OPs.
  const queueAdvance = useOpQueueAdvance(advanceProductionItems, completeProductionBatch);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );
  // "Imprimir folhas do dia" (mesma UX do gestor): a data-alvo é o filtro de produção se
  // ativo; senão o dia âncora se tiver produção; senão a produção mais próxima — assim o
  // botão não trava quando a produção do dia é futura (âncora = hoje, OPs de amanhã).
  const dayPrintSummary = useMemo(() => {
    const demandOps = planningSnapshot.productionOrders.filter((op) => op.hasDemand !== false);
    const datesWithOps = Array.from(new Set(demandOps.map((op) => op.productionDate))).sort((a, b) =>
      a.localeCompare(b),
    );
    const printDate = resolveDayPrintDate(datesWithOps, anchorDate, productionDateFilter);
    const dayOps = demandOps.filter((op) => op.productionDate === printDate);
    return {
      printDate,
      opCount: dayOps.length,
      // "produtos" = produtos DISTINTOS a produzir (op.items), não linhas de pedido
      // consolidadas (op.itemsCount) — senão 2 lojas pedindo o mesmo produto contam "2".
      productCount: dayOps.reduce((sum, op) => sum + op.items.length, 0),
      totalKg: dayOps.reduce((sum, op) => sum + op.totalKg, 0),
      dayLabel: dayOps[0]?.productionDateLabel ?? printDate,
    };
  }, [planningSnapshot.productionOrders, anchorDate, productionDateFilter]);
  const { snapshot } = useMasterDataSnapshot();
  const toast = useToast();
  const tryFutureDateOverride = useFutureDateOverride();

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

  const matchesStatusFilter = statusFilter.matches;
  const filteredOps = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return opRows.filter((item) => {
      const matchesDate = productionDateFilter === "all" || item.productionDate === productionDateFilter;
      const matchesStatus = matchesStatusFilter(item.status);
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
  }, [lineFilter, opRows, productionDateFilter, searchTerm, sectorFilter, matchesStatusFilter]);
  const sortedOps = useMemo(
    () => sortItemsByTemporalValue(filteredOps, sortOrder, ["productionDate"]),
    [filteredOps, sortOrder],
  );

  const todayKey = getOperationalTodayKey();
  const visibleOps = useMemo(
    () => (showFuture ? sortedOps : sortedOps.filter((op) => op.productionDate <= todayKey)),
    [showFuture, sortedOps, todayKey],
  );
  const hiddenFutureCount = sortedOps.length - visibleOps.length;
  const opPagination = useMemo(() => paginateArray(visibleOps, opPage, opPageSize), [opPage, opPageSize, visibleOps]);
  const opDayGroups = useMemo(
    () =>
      groupOpsByProductionDay(opPagination.items, todayKey, {
        showFuture: true,
        isFinished: (op) => (OP_FINAL_STATUSES as readonly string[]).includes(op.status),
      }).groups,
    [opPagination.items, todayKey],
  );

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

    // Reunião 22/10 (bloco 1): carga por linha segue o filtro da fila (pendentes por padrão).
    opRows.filter((op) => matchesStatusFilter(op.status)).forEach((op) => {
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
  }, [opRows, matchesStatusFilter]);

  const alignedLineRows = useMemo(() => {
    // Reunião 22/10 (bloco 1): o quadro segue o filtro da fila (pendentes por padrão).
    const visibleRows = opRows.filter((row) => matchesStatusFilter(row.status));
    const lines = Array.from(new Set(visibleRows.map((item) => item.lineName))).sort((a, b) => a.localeCompare(b));
    const visibleDates = new Set(visibleRows.map((row) => row.productionDate));
    const dates = planningData.productionDates.filter((date) => visibleDates.has(date));
    const map = new Map<string, OpQueueRow[]>();

    visibleRows.forEach((row) => {
      const key = `${row.lineName}|${row.productionDate}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(row);
    });

    return { lines, dates, map };
  }, [opRows, planningData.productionDates, matchesStatusFilter]);

  // KPIs seguem o filtro da fila (pendentes por padrão; tudo com Ver histórico).
  const kpiOpRows = useMemo(() => opRows.filter((op) => matchesStatusFilter(op.status)), [opRows, matchesStatusFilter]);
  const kpis = useMemo(
    () => ({
      totalOps: kpiOpRows.length,
      totalKg: Number(kpiOpRows.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2)),
      avgCompletion:
        kpiOpRows.length === 0
          ? 0
          : Number((kpiOpRows.reduce((sum, item) => sum + item.completion, 0) / kpiOpRows.length).toFixed(1)),
      activeSubcategories: new Set(kpiOpRows.map((item) => item.lineName)).size,
    }),
    [kpiOpRows],
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
      key: "select",
      header: "",
      className: "w-9 px-1",
      render: (item: OpQueueRow) =>
        item.hasDemand === false ? null : <OpQueueSelectCell control={queueAdvance} op={item} />,
    },
    {
      key: "code",
      header: "OP",
      render: (item: OpQueueRow) => (
        <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-foreground">{item.code}</span>
      ),
    },
    {
      key: "delivery",
      header: "Entregar",
      render: (item: OpQueueRow) => (
        <span className="text-xs tabular-nums text-foreground">
          {summarizeOpDates(
            item.sourceItems.map((src) => ({ date: src.deliveryDate, label: src.deliveryDateLabel })),
          ) ?? "—"}
        </span>
      ),
    },
    {
      key: "sale",
      header: "Vender",
      render: (item: OpQueueRow) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {summarizeOpDates(item.sourceItems.map((src) => ({ date: src.saleDate, label: src.saleDateLabel }))) ?? "—"}
        </span>
      ),
    },
    { key: "lineName", header: hierarchyLabels.line, className: "min-w-[6rem] text-xs" },
    {
      key: "productsCount",
      header: "Produtos",
      render: (item: OpQueueRow) => <span className="tabular-nums text-foreground">{item.productsCount}</span>,
    },
    {
      key: "totalKg",
      header: "Carga (Kg)",
      render: (item: OpQueueRow) => (
        <span className="font-semibold tabular-nums text-foreground">{formatKgValue(item.totalKg)}</span>
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
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <OpQueueAdvanceButton control={queueAdvance} op={item} />
          <ProductionOrderActionsMenu
            detailHref={`/chao-fabrica/ordens-producao/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`}
            preWeighingHref={`/impressao/pre-pesagem/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`}
            packagingHref={`/impressao/separacao-embalagem/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`}
            productionPrintHref={`/impressao/producao/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`}
            onOpenWorkflow={() => openWorkflowDialog(item.id)}
            onOpenPrint={openPrintPage}
          />
        </div>
      ),
    },
  ];

  const dailyColumns = [
    { key: "productionDateLabel", header: "Data" },
    { key: "lineName", header: hierarchyLabels.line, className: "whitespace-nowrap text-xs" },
    { key: "totalKg", header: "Kg planejados" },
    { key: "opsCount", header: "OPs" },
    { key: "itemsCount", header: "Itens consolidados" },
  ];

  const activeFiltersCount = [
    searchTerm.trim().length > 0 ? 1 : 0,
    productionDateFilter !== "all" ? 1 : 0,
    statusFilter.isCustom ? 1 : 0,
    sectorFilter !== "all" ? 1 : 0,
    lineFilter !== "all" ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  function clearFilters() {
    setSearchTerm("");
    setProductionDateFilter("all");
    statusFilter.reset();
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
      // Trava de data futura: gestor/admin podem forçar (forceable do servidor).
      const handled = await tryFutureDateOverride(
        error,
        () => updateProductionItemStatus(productionItemKey, status, { force: true }),
        (message) => {
          setWorkflowError(message);
          toast.error(message);
        },
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
      title="Ordens de Produção"
      description="Painel operacional do chão de fábrica com avanço real por OP e documentos dedicados."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Chão de Fábrica", href: "/chao-fabrica" },
        { label: "Ordens de Produção" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DayPrintButton
            date={dayPrintSummary.printDate}
            dayLabel={dayPrintSummary.dayLabel}
            opCount={dayPrintSummary.opCount}
            productCount={dayPrintSummary.productCount}
            totalKg={dayPrintSummary.totalKg}
          />
          <Button asChild type="button" variant="outline">
            <Link href="/chao-fabrica">
              <ArrowLeft className="size-4" />
              Voltar ao painel
            </Link>
          </Button>
        </div>
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

      <StatusFilterBar control={statusFilter} options={statusOptions} onChange={() => setOpPage(1)} />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <CardTitle>Fila de OPs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {hiddenFutureCount > 0 && !showFuture
                ? `${hiddenFutureCount} OP${hiddenFutureCount === 1 ? "" : "s"} de dias futuros escondida${hiddenFutureCount === 1 ? "" : "s"}.`
                : showFuture
                  ? "Mostrando também as OPs de dias futuros."
                  : "Mostrando as OPs de hoje e atrasadas."}
            </span>
            <Button
              type="button"
              size="sm"
              variant={showFuture ? "default" : "outline"}
              aria-pressed={showFuture}
              onClick={() => {
                setShowFuture((current) => !current);
                setOpPage(1);
              }}
            >
              Exibir futuras{hiddenFutureCount > 0 && !showFuture ? ` (${hiddenFutureCount})` : ""}
            </Button>
          </div>
          <OpQueueAdvanceBar control={queueAdvance} ops={opDayGroups.flatMap((group) => group.ops)} />
          <OpDayGroupsTable
            groups={opDayGroups}
            columns={columns}
            onRowClick={(item) =>
              pushWithProgress(router, `/chao-fabrica/ordens-producao/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`,
              )
            }
            emptyMessage={
              isPlanningLoading && planningSnapshot.productionOrders.length === 0
                ? "Carregando OPs…"
                : "Nenhuma OP encontrada para os filtros"
            }
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
                    <table className="w-full min-w-[640px] border-collapse">
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
