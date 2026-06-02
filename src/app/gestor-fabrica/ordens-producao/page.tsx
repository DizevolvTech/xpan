"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarClock, CalendarRange, ClipboardList, Factory, PackageCheck, ShoppingCart, Truck } from "lucide-react";

import { ProductionOrderActionsMenu } from "@/components/production/production-order-actions-menu";
import { ProductionOrderStatusDialog } from "@/components/production/production-order-status-dialog";
import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { InfoHint } from "@/components/shared/info-hint";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
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
import { getProductionOrderNavKey } from "@/lib/factory-kanban";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import type { OperationalDateScopeMode } from "@/lib/operational-date-scope";
import {
  formatDateKeyBr,
  type OrderStatus,
  type ProductionItemStatus,
  type ProductionOrderRow,
} from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";
import { sortItemsByTemporalValue, type TemporalSortOrder } from "@/lib/temporal-table-sort";
import { hierarchyLabels } from "@/lib/production-planning";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";

type OpQueueRow = ProductionOrderRow & {
  capacityKg: number;
  completion: number;
  productsCount: number;
};

// FASE 3 (UI): uma OP de esqueleto (hasDemand === false) é só visão de
// planejamento do cronograma ativo — produto × linha × dia sem nenhum pedido
// ainda. Não é liberável, qtd 0, não desce pro chão. Aqui ela aparece de forma
// MUTED para a fábrica saber que aquele produto sai naquele dia/linha, sem
// competir com o que de fato vai produzir.
function isSkeletonOp(op: ProductionOrderRow) {
  return op.hasDemand === false;
}

// Mínimo do cronograma agregado da OP de esqueleto (referência, não demanda).
function skeletonMinimumKg(op: ProductionOrderRow) {
  return op.items
    .filter((item) => item.demandSource === "cronograma")
    .reduce((sum, item) => sum + item.minimumProductionKg, 0);
}

type DailyLineRow = {
  id: string;
  productionDate: string;
  productionDateLabel: string;
  lineName: string;
  totalKg: number;
  opsCount: number;
  itemsCount: number;
};

// AJ-A2: visão de batelada — agrega demanda por (data × produto) somando
// tudo que está pendente para a fábrica preparar em batch único, em vez de
// olhar pedido-a-pedido. Reconecta o espírito da rota órfã
// /api/store-orders/aggregated-quantities usando o motor (mais correto).
type BatchDemandRow = {
  id: string;
  productionDate: string;
  productionDateLabel: string;
  productId: string;
  productCode: string;
  productName: string;
  totalKg: number;
  // AJ-0006.1: lote mínimo da fábrica + flag de demanda consolidada (todas as lojas) abaixo dele.
  minimumProductionKg: number;
  belowMinimum: boolean;
  opsCount: number;
  ordersCount: number;
  progress: number;
  status: OrderStatus;
};

const ORDER_STATUS_FILTER_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "em_espera", label: "Em Espera" },
  { value: "agendado", label: "Agendado" },
  { value: "em_producao", label: "Em Produção" },
  { value: "aguardando_expedicao", label: "Aguardando Expedição" },
  { value: "rota_entrega", label: "Rota de Entrega" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

const AGGREGATE_STATUS_PRIORITY: OrderStatus[] = [
  "em_espera",
  "agendado",
  "em_producao",
  "aguardando_expedicao",
  "rota_entrega",
  "entregue",
  "cancelado",
];

function pickAggregateStatus(statuses: OrderStatus[]): OrderStatus {
  // "Elo mais fraco" — se algum item da batelada ainda está em estágio
  // anterior, a batelada toda só pode reportar esse estágio.
  for (const candidate of AGGREGATE_STATUS_PRIORITY) {
    if (statuses.includes(candidate)) {
      return candidate;
    }
  }
  return "em_espera";
}

export default function OrdensProducaoPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const searchParams = useSearchParams();
  const [productionDateFilter, setProductionDateFilter] = useState("all");
  // AJ-0002: filtro inicial vindo do deep-link dos cards do dashboard.
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all");
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

  // FASE 3 (UI): KPIs e agregações ("o que vai produzir") consideram só OPs com
  // demanda real. Os slots de esqueleto continuam visíveis na Fila de OPs abaixo,
  // mas não inflam contagem de OPs liberadas, conclusão média nem batelada.
  const demandOpRows = useMemo(() => opRows.filter((op) => !isSkeletonOp(op)), [opRows]);

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
  const sortedOps = useMemo(() => {
    const byDate = sortItemsByTemporalValue(filteredOps, sortOrder, ["productionDate"]);
    // FASE 3 (UI): dentro de cada dia/linha, os slots de esqueleto descem para
    // depois dos com demanda — não competem com o que de fato vai produzir.
    // Estável: mesma data + mesma linha → demanda primeiro, ordem preservada.
    return [...byDate].sort((a, b) => {
      if (a.productionDate !== b.productionDate || a.lineName !== b.lineName) {
        return 0;
      }
      return Number(isSkeletonOp(a)) - Number(isSkeletonOp(b));
    });
  }, [filteredOps, sortOrder]);

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

    demandOpRows.forEach((op) => {
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
  }, [demandOpRows]);

  const batchDemandRows = useMemo<BatchDemandRow[]>(() => {
    const map = new Map<
      string,
      {
        row: BatchDemandRow;
        opIds: Set<string>;
        orderCodes: Set<string>;
        progressSum: number;
        progressCount: number;
        statuses: OrderStatus[];
      }
    >();

    planningData.productionOrders
      .filter((op) => !isSkeletonOp(op))
      .forEach((op) => {
      op.items.forEach((item) => {
        // Item de cronograma (qtd 0) não é demanda — não entra na batelada.
        if (item.demandSource === "cronograma") {
          return;
        }
        const key = `${op.productionDate}|${item.productId}`;
        const existing = map.get(key);
        const sourceItemsForProduct = op.sourceItems.filter(
          (source) => source.productId === item.productId,
        );
        const orderCodesForProduct = sourceItemsForProduct.map((source) => source.orderCode);

        if (existing) {
          existing.row.totalKg = Number((existing.row.totalKg + item.totalKg).toFixed(2));
          existing.opIds.add(op.id);
          orderCodesForProduct.forEach((code) => existing.orderCodes.add(code));
          existing.progressSum += item.progress;
          existing.progressCount += 1;
          existing.statuses.push(op.status);
          existing.row.opsCount = existing.opIds.size;
          existing.row.ordersCount = existing.orderCodes.size;
          return;
        }

        const opIds = new Set<string>([op.id]);
        const orderCodes = new Set<string>(orderCodesForProduct);
        map.set(key, {
          row: {
            id: key,
            productionDate: op.productionDate,
            productionDateLabel: op.productionDateLabel,
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            totalKg: Number(item.totalKg.toFixed(2)),
            minimumProductionKg: item.minimumProductionKg,
            belowMinimum: false,
            opsCount: opIds.size,
            ordersCount: orderCodes.size,
            progress: item.progress,
            status: op.status,
          },
          opIds,
          orderCodes,
          progressSum: item.progress,
          progressCount: 1,
          statuses: [op.status],
        });
      });
    });

    return Array.from(map.values())
      .map((entry) => {
        entry.row.progress =
          entry.progressCount > 0
            ? Number((entry.progressSum / entry.progressCount).toFixed(1))
            : 0;
        entry.row.status = pickAggregateStatus(entry.statuses);
        // AJ-0006.1: alerta quando a demanda consolidada (todas as lojas) ainda
        // não atinge o lote mínimo de produção da fábrica para este produto.
        entry.row.belowMinimum =
          entry.row.minimumProductionKg > 0 && entry.row.totalKg < entry.row.minimumProductionKg;
        return entry.row;
      })
      .sort((a, b) => {
        const byDate = a.productionDate.localeCompare(b.productionDate);
        if (byDate !== 0) {
          return byDate;
        }
        return b.totalKg - a.totalKg;
      });
  }, [planningData.productionOrders]);

  const alignedLineRows = useMemo(() => {
    const lines = Array.from(new Set(demandOpRows.map((item) => item.lineName))).sort((a, b) => a.localeCompare(b));
    const dates = Array.from(new Set(demandOpRows.map((item) => item.productionDate))).sort((a, b) =>
      a.localeCompare(b),
    );
    const map = new Map<string, OpQueueRow[]>();

    demandOpRows.forEach((row) => {
      const key = `${row.lineName}|${row.productionDate}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(row);
    });

    return { lines, dates, map };
  }, [demandOpRows]);

  const kpis = useMemo(
    () => ({
      totalOps: demandOpRows.length,
      totalKg: Number(demandOpRows.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2)),
      avgCompletion:
        demandOpRows.length === 0
          ? 0
          : Number(
              (demandOpRows.reduce((sum, item) => sum + item.completion, 0) / demandOpRows.length).toFixed(1),
            ),
      activeSubcategories: new Set(demandOpRows.map((item) => item.lineName)).size,
    }),
    [demandOpRows],
  );

  const selectedOp = useMemo(
    () => opRows.find((item) => item.id === selectedOpId) ?? null,
    [opRows, selectedOpId],
  );

  // AJ-0013: OPs já liberadas mas agendadas para data futura (lead days) somem
  // da fila do dia e pareciam "sumidas". Tornar explícitas com a data prevista.
  const scheduledOps = useMemo(
    () =>
      demandOpRows
        .filter((item) => item.status === "agendado")
        .sort((a, b) => a.productionDate.localeCompare(b.productionDate)),
    [demandOpRows],
  );
  const nextScheduledLabel = scheduledOps[0]?.productionDateLabel ?? "—";

  const scopeLabel = useMemo(() => {
    if (scope.mode === "all") return "Todo o período";
    if (scope.mode === "day") return scope.date;
    return `${scope.startDate} → ${scope.endDate}`;
  }, [scope]);

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
      value: demandOpRows.length,
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
    { key: "code", header: "OP" },
    { key: "productionDateLabel", header: "Data de produção" },
    { key: "sectorName", header: hierarchyLabels.sector },
    { key: "lineName", header: hierarchyLabels.line },
    { key: "scheduleName", header: hierarchyLabels.schedule },
    { key: "productsCount", header: "Produtos" },
    {
      key: "totalKg",
      header: "Carga (Kg)",
      render: (item: OpQueueRow) => {
        if (isSkeletonOp(item)) {
          const minimumKg = skeletonMinimumKg(item);
          return (
            <div className="flex flex-col gap-0.5 text-muted-foreground">
              <span aria-label="Sem carga — slot sem pedido">—</span>
              {minimumKg > 0 ? (
                <span className="text-[11px] tabular-nums">
                  mín. {formatKgValue(minimumKg, { maximumFractionDigits: 2 })} Kg
                </span>
              ) : null}
            </div>
          );
        }
        return formatKgValue(item.totalKg);
      },
    },
    {
      key: "completion",
      header: "% conclusão",
      render: (item: OpQueueRow) =>
        isSkeletonOp(item) ? (
          <span className="text-xs text-muted-foreground/70">Aguardando pedido</span>
        ) : (
          <div className="min-w-[220px]">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{item.completion.toFixed(1)}%</span>
              <span>{formatKgValue(item.capacityKg)} Kg/dia de capacidade</span>
            </div>
            <div className="h-2 rounded-full bg-panel">
              <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(item.completion, 100)}%` }} />
            </div>
          </div>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: OpQueueRow) =>
        isSkeletonOp(item) ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/[var(--opacity-strong)] px-2.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-secondary-foreground ring-1 ring-inset ring-border">
            <span className="size-1.5 rounded-full bg-muted-foreground/[var(--opacity-strong)]" aria-hidden />
            Sem pedido
          </span>
        ) : (
          <StatusBadge status={item.status} />
        ),
    },
    {
      key: "documents",
      header: "Ações",
      // Slots de esqueleto (qtd 0) não são liberáveis nem imprimíveis — sem menu.
      render: (item: OpQueueRow) =>
        isSkeletonOp(item) ? (
          <span className="block text-right text-xs text-muted-foreground/60" aria-hidden>
            —
          </span>
        ) : (
          <ProductionOrderActionsMenu
            detailHref={`/gestor-fabrica/ordens-producao/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`}
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

  const batchDemandColumns = [
    { key: "productionDateLabel", header: "Data" },
    {
      key: "product",
      header: "Produto",
      render: (item: BatchDemandRow) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{item.productName}</span>
          <span className="text-xs text-muted-foreground">{item.productCode}</span>
        </div>
      ),
    },
    {
      key: "totalKg",
      header: "Demanda total",
      render: (item: BatchDemandRow) => (
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-foreground">
            {formatKgLabel(item.totalKg, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {item.belowMinimum ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-warning/[var(--opacity-subtle)] px-2 py-0.5 text-[11px] font-medium text-warning">
              <AlertTriangle className="size-3" aria-hidden />
              Abaixo do lote mínimo
              <InfoHint
                size="xs"
                tone="warning"
                content={`A demanda consolidada de todas as lojas (${formatKgLabel(item.totalKg, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) está abaixo do lote mínimo de produção (${formatKgLabel(item.minimumProductionKg, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Avalie consolidar com outra data ou produzir o mínimo.`}
              />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "coverage",
      header: "Cobertura",
      render: (item: BatchDemandRow) => (
        <div className="text-xs text-muted-foreground">
          <div>{item.opsCount} OP(s)</div>
          <div>{item.ordersCount} pedido(s)</div>
        </div>
      ),
    },
    {
      key: "progress",
      header: "% conclusão",
      render: (item: BatchDemandRow) => (
        <div className="min-w-[180px]">
          <div className="mb-1 text-xs text-muted-foreground">{item.progress.toFixed(1)}%</div>
          <div className="h-2 rounded-full bg-panel">
            <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(item.progress, 100)}%` }} />
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: BatchDemandRow) => <StatusBadge status={item.status} />,
    },
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
      setWorkflowError(
        error instanceof Error ? error.message : "Falha ao atualizar o estágio operacional.",
      );
    } finally {
      setPendingItemKey(null);
    }
  }

  return (
    <PageLayout
      title="Ordens de Produção"
      description="Acompanhe somente OPs liberadas. O avanço agora é derivado do status operacional de cada produto."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Ordens de Produção" },
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
      {/* Action bar — escopo em pílula popover (alinhado ao dashboard). */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Popover open={isScopeOpen} onOpenChange={setIsScopeOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ajustar janela operacional"
            >
              <CalendarRange className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">Janela:</span>
              <span className="font-semibold">{scopeLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] space-y-3 p-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Janela operacional
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

        {/* Linha-stats minúscula — KPIs secundários (linhas ativas + agendadas). */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground/80">
          <span>
            <span className="font-medium text-foreground/80">{kpis.activeSubcategories}</span> linhas ativas
          </span>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <span>
            <span className="font-medium text-foreground/80">{scheduledOps.length}</span>{" "}
            agendada{scheduledOps.length === 1 ? "" : "s"}
            {scheduledOps.length > 0 ? ` (próx. ${nextScheduledLabel})` : ""}
          </span>
        </div>
      </div>

      {/* KPIs 5 → 3 primários (linhas ativas e agendadas viraram linha-stats). */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard title="OPs liberadas" value={kpis.totalOps} icon={ClipboardList} tone="neutral" compactValue />
        <KPICard title="Carga total" value={formatKgLabel(kpis.totalKg, { maximumFractionDigits: 2 })} icon={Factory} tone="success" compactValue />
        <KPICard title="% conclusão média" value={`${kpis.avgCompletion}%`} icon={PackageCheck} tone="info" compactValue />
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
        helperText="Kg por OP ficam em destaque; unidades aparecem apenas como complemento nas telas de detalhe."
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

      {scheduledOps.length > 0 ? (
        <Card className="border-info/40 bg-info/5">
          <CardHeader className="flex flex-row items-center gap-1.5">
            <CalendarClock className="size-4 text-info" />
            <CardTitle className="text-base">
              {scheduledOps.length} OP{scheduledOps.length === 1 ? "" : "s"} agendada
              {scheduledOps.length === 1 ? "" : "s"} para os próximos dias
            </CardTitle>
            <InfoHint
              size="xs"
              content="Pedidos já liberados, mas cuja produção cai numa data futura por causa dos lead days. Não aparecem na fila do dia — clique para abrir a OP."
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {scheduledOps.slice(0, 12).map((op) => (
              <Link
                key={op.id}
                href={`/gestor-fabrica/ordens-producao/${encodeURIComponent(getProductionOrderNavKey(op))}?ref=${anchorDate}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm transition-colors hover:bg-panel/50"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">{op.code}</span>
                  <span className="text-muted-foreground">{op.lineName}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground">{formatKgLabel(op.totalKg, { maximumFractionDigits: 2 })}</span>
                  <span className="rounded-md bg-info/15 px-2 py-1 text-xs font-semibold text-info">
                    Produz {op.productionDateLabel}
                  </span>
                </span>
              </Link>
            ))}
            {scheduledOps.length > 12 ? (
              <p className="text-xs text-muted-foreground">
                + {scheduledOps.length - 12} outras agendadas. Use o filtro de status “Agendado” na fila abaixo.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <div className="flex items-center gap-1.5">
            <CardTitle>Fila de OPs</CardTitle>
            <InfoHint
              content="Linhas em tom apagado com a etiqueta “Sem pedido” são slots do cronograma: o produto sai naquele dia/linha, mas ainda não há pedido. Servem de referência — não são liberáveis. O “mín.” mostra o lote mínimo do cronograma."
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            data={opPagination.items}
            columns={columns}
            keyField="id"
            pagination={false}
            showFooterControls={false}
            onRowClick={(item) => window.location.assign(`/gestor-fabrica/ordens-producao/${encodeURIComponent(getProductionOrderNavKey(item))}?ref=${anchorDate}`)}
            // Esqueleto não abre detalhe (não há OP real pra acionar) e fica MUTED.
            isRowClickable={(item) => !isSkeletonOp(item)}
            rowClassName={(item) => (isSkeletonOp(item) ? "text-muted-foreground opacity-[0.72]" : "")}
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

      <div className="space-y-4">
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

        {/* AJ-A2: Demanda agregada por produto — bateladas em vez de pedido-a-pedido. */}
        <Card>
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center gap-1.5">
              <CardTitle>Demanda por produto (batelada)</CardTitle>
              <InfoHint
                content="Some toda a demanda do mesmo produto numa única linha por data. Use isso pra preparar massa, fermento e fornadas em batelada única — sem repetir set-up para cada pedido."
              />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              data={batchDemandRows}
              columns={batchDemandColumns}
              keyField="id"
              emptyMessage="Nenhuma demanda agregada para a janela atual"
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

      {/* Navegação operacional — fluxo entre páginas irmãs (rodapé). */}
      <FactoryFlow
        currentKey="producao"
        steps={flowSteps}
        subtitle="Pedido auditado gera OP; o progresso da OP sobe automaticamente conforme cada produto avança na operação."
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
        detailHrefBase="/gestor-fabrica/ordens-producao"
        pendingItemKey={pendingItemKey}
        error={workflowError}
        onUpdateStatus={handleWorkflowAction}
      />
    </PageLayout>
  );
}
