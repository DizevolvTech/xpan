"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Factory, Layers, PackageCheck, ShoppingCart, Truck } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDateKeyBr,
  getTodayDateKey,
  type ProductionOrderRow,
} from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";
import { hierarchyLabels } from "@/lib/production-planning";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

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
  const [referenceDate, setReferenceDate] = useState(getTodayDateKey());
  const [productionDateFilter, setProductionDateFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [opPage, setOpPage] = useState(1);
  const [opPageSize, setOpPageSize] = useState(20);
  const { planningData } = useFactoryPlanningSnapshot(referenceDate);
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

  const opPagination = useMemo(() => paginateArray(filteredOps, opPage, opPageSize), [filteredOps, opPage, opPageSize]);

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
      header: "Documentos",
      render: (item: OpQueueRow) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openPrintPage(`/impressao/pre-pesagem/${item.id}?ref=${referenceDate}`)}>
            Pré-pesagem
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openPrintPage(`/impressao/producao/${item.id}?ref=${referenceDate}`)}>
            Produção
          </Button>
          <Button asChild type="button" size="sm">
            <Link href={`/gestor-fabrica/ordens-producao/${item.id}?ref=${referenceDate}`}>Abrir</Link>
          </Button>
        </div>
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="OPs liberadas" value={kpis.totalOps} icon={ClipboardList} tone="neutral" compactValue />
        <KPICard title="Carga total" value={`${kpis.totalKg} Kg`} icon={Factory} tone="success" compactValue />
        <KPICard title="% conclusão média" value={`${kpis.avgCompletion}%`} icon={PackageCheck} tone="info" compactValue />
        <KPICard title="Subcategorias ativas" value={kpis.activeSubcategories} icon={Layers} tone="warning" compactValue />
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
        currentKey="producao"
        steps={flowSteps}
        subtitle="Pedido auditado gera OP; o progresso da OP sobe automaticamente conforme cada produto avança na operação."
      />

      <Card>
        <CardHeader>
          <CardTitle>Documentos operacionais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pré-pesagem</p>
            <p className="mt-1 text-foreground">Agrupa insumos por produto e destaca MPI/base compartilhada.</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Produção</p>
            <p className="mt-1 text-foreground">Folha dedicada da linha executora com carga, pedidos e andamento atual.</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Expedição</p>
            <p className="mt-1 text-foreground">Checklist sai somente quando todos os produtos da OP estiverem concluídos.</p>
          </div>
        </CardContent>
      </Card>

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
                  {alignedLineRows.lines.map((lineName) => (
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
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
