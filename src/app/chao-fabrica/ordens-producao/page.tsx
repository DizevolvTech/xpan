"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Factory, Layers, PackageCheck, Truck } from "lucide-react";

import { ProductionOrderActionsMenu } from "@/components/production/production-order-actions-menu";
import { ProductionOrderStatusDialog } from "@/components/production/production-order-status-dialog";
import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import {
  formatDateKeyBr,
  type ProductionItemStatus,
  type ProductionOrderRow,
} from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";
import { sortItemsByTemporalValue, type TemporalSortOrder } from "@/lib/temporal-table-sort";
import { hierarchyLabels } from "@/lib/production-planning";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
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

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

export default function OrdensProducaoPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [productionDateFilter, setProductionDateFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<TemporalSortOrder>("recent_first");
  const [opPage, setOpPage] = useState(1);
  const [opPageSize, setOpPageSize] = useState(20);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [pendingItemKey, setPendingItemKey] = useState<string | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
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

  const filteredOps = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return opRows.filter((item) => {
      const matchesDate = productionDateFilter === "all" || item.productionDate === productionDateFilter;
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

      return matchesDate && matchesCategory && matchesSubcategory && matchesSearch;
    });
  }, [lineFilter, opRows, productionDateFilter, searchTerm, sectorFilter]);
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
  ];

  const columns = [
    { key: "code", header: "OP" },
    { key: "productionDateLabel", header: "Data de produção" },
    { key: "sectorName", header: hierarchyLabels.sector },
    { key: "lineName", header: hierarchyLabels.line },
    { key: "scheduleName", header: hierarchyLabels.schedule },
    { key: "productsCount", header: "Produtos" },
    { key: "totalKg", header: "Carga (Kg)" },
    {
      key: "completion",
      header: "% conclusão",
      render: (item: OpQueueRow) => (
        <div className="min-w-[220px]">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.completion.toFixed(1)}%</span>
            <span>{item.capacityKg} Kg/dia de capacidade</span>
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
      render: (item: OpQueueRow) => <StatusBadge status={item.status} />,
    },
    {
      key: "documents",
      header: "Ações",
      render: (item: OpQueueRow) => (
        <ProductionOrderActionsMenu
          detailHref={`/chao-fabrica/ordens-producao/${item.id}?ref=${anchorDate}`}
          preWeighingHref={`/impressao/pre-pesagem/${item.id}?ref=${anchorDate}`}
          productionPrintHref={`/impressao/producao/${item.id}?ref=${anchorDate}`}
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
    sectorFilter !== "all" ? 1 : 0,
    lineFilter !== "all" ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  function clearFilters() {
    setSearchTerm("");
    setProductionDateFilter("all");
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="OPs liberadas" value={kpis.totalOps} icon={ClipboardList} tone="neutral" compactValue />
        <KPICard title="Carga total" value={`${kpis.totalKg} Kg`} icon={Factory} tone="success" compactValue />
        <KPICard title="% conclusão média" value={`${kpis.avgCompletion}%`} icon={PackageCheck} tone="info" compactValue />
        <KPICard title="Subcategorias ativas" value={kpis.activeSubcategories} icon={Layers} tone="warning" compactValue />
      </div>

      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela da produção"
        description="Acompanhe todas as OPs, foque em um dia específico ou feche um período operacional."
      />

      <FactoryFlow
        currentKey="producao"
        steps={flowSteps}
        subtitle="O operador acompanha o avanço por produto. A expedição só libera após a conclusão da OP."
      />

      <OperationFiltersCard
        title="Filtros da Produção"
        summary={`${filteredOps.length} de ${opRows.length} OPs visíveis`}
        searchLabel="Busca"
        searchPlaceholder="Buscar por OP, produto, categoria, subcategoria ou linha..."
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

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-background via-background to-panel/80">
          <CardTitle>Fila de OPs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            data={opPagination.items}
            columns={columns}
            keyField="id"
            pagination={false}
            showFooterControls={false}
            onRowClick={(item) => window.location.assign(`/chao-fabrica/ordens-producao/${item.id}?ref=${anchorDate}`)}
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
            <CardTitle>Resumo diário por subcategoria</CardTitle>
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
            <CardTitle>Kg por subcategoria e dia</CardTitle>
          </CardHeader>
          <CardContent>
            <PaginatedSection items={alignedLineRows.lines} label="sublinhas" initialPageSize={8}>
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
                                    <div className="font-semibold text-foreground">{totalKg.toFixed(2)} Kg</div>
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
