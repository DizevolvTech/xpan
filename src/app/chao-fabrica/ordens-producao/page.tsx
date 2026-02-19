"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Factory, Layers, Printer, Truck } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyFactoryOrderStatus, useFactoryOrderStatus } from "@/lib/factory-order-status";
import { printProductionOrder, printSectorProductionOrders } from "@/lib/factory-print";
import {
  buildFactoryPlanningData,
  formatDateKeyBr,
  getTodayDateKey,
  type ProductionOrderRow,
} from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { productionLines } from "@/lib/production-planning";

type OpQueueRow = ProductionOrderRow & {
  capacityKg: number;
  utilization: number;
  pressure: "ok" | "atencao" | "critico";
  productsCount: number;
};

type DailyOpsRow = {
  id: string;
  productionDate: string;
  productionDateLabel: string;
  opsCount: number;
  sectorsCount: number;
  linesCount: number;
  totalKg: number;
};

export default function OrdensProducaoPage() {
  const router = useRouter();
  const [referenceDate, setReferenceDate] = useState(getTodayDateKey());
  const [productionDateFilter, setProductionDateFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sectorPrintFilter, setSectorPrintFilter] = useState("all");
  const [opPage, setOpPage] = useState(1);
  const [opPageSize, setOpPageSize] = useState(20);
  const statusState = useFactoryOrderStatus(referenceDate);

  const basePlanningData = useMemo(() => buildFactoryPlanningData(referenceDate), [referenceDate]);
  const planningData = useMemo(
    () => applyFactoryOrderStatus(basePlanningData, statusState.resolveStatus),
    [basePlanningData, statusState.resolveStatus],
  );

  const capacityByLineName = useMemo(
    () =>
      new Map(
        productionLines
          .filter((line) => line.status === "ativo")
          .map((line) => [line.name, line.capacityPerDayKg]),
      ),
    [],
  );

  const opRows = useMemo<OpQueueRow[]>(() => {
    return planningData.productionOrders.map((op) => {
      const capacityKg = capacityByLineName.get(op.lineName) ?? 0;
      const utilization = capacityKg > 0 ? (op.totalKg / capacityKg) * 100 : 0;
      const pressure: OpQueueRow["pressure"] =
        utilization > 100 ? "critico" : utilization >= 85 ? "atencao" : "ok";

      return {
        ...op,
        capacityKg,
        utilization: Number(utilization.toFixed(1)),
        pressure,
        productsCount: op.items.length,
      };
    });
  }, [capacityByLineName, planningData.productionOrders]);

  const dailyRows = useMemo<DailyOpsRow[]>(() => {
    const map = new Map<
      string,
      {
        productionDateLabel: string;
        opsCount: number;
        sectors: Set<string>;
        lines: Set<string>;
        totalKg: number;
      }
    >();

    opRows.forEach((op) => {
      if (!map.has(op.productionDate)) {
        map.set(op.productionDate, {
          productionDateLabel: op.productionDateLabel,
          opsCount: 0,
          sectors: new Set<string>(),
          lines: new Set<string>(),
          totalKg: 0,
        });
      }

      const row = map.get(op.productionDate);
      if (!row) {
        return;
      }

      row.opsCount += 1;
      row.sectors.add(op.sectorName);
      row.lines.add(op.lineName);
      row.totalKg += op.totalKg;
    });

    return Array.from(map.entries())
      .map(([productionDate, row]) => ({
        id: productionDate,
        productionDate,
        productionDateLabel: row.productionDateLabel,
        opsCount: row.opsCount,
        sectorsCount: row.sectors.size,
        linesCount: row.lines.size,
        totalKg: Number(row.totalKg.toFixed(2)),
      }))
      .sort((a, b) => a.productionDate.localeCompare(b.productionDate));
  }, [opRows]);

  const sectorOptions = useMemo(
    () =>
      Array.from(new Set(opRows.map((item) => item.sectorName)))
        .sort((a, b) => a.localeCompare(b))
        .map((sector) => ({ value: sector, label: sector })),
    [opRows],
  );

  const lineOptions = useMemo(
    () =>
      Array.from(new Set(opRows.map((item) => item.lineName)))
        .sort((a, b) => a.localeCompare(b))
        .map((line) => ({ value: line, label: line })),
    [opRows],
  );

  const opsForSectorPrint = useMemo(
    () => (sectorPrintFilter === "all" ? opRows : opRows.filter((op) => op.sectorName === sectorPrintFilter)),
    [opRows, sectorPrintFilter],
  );

  const filteredOps = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return opRows.filter((item) => {
      const matchesDate = productionDateFilter === "all" || item.productionDate === productionDateFilter;
      const matchesSector = sectorFilter === "all" || item.sectorName === sectorFilter;
      const matchesLine = lineFilter === "all" || item.lineName === lineFilter;
      const matchesSearch =
        term.length === 0 ||
        item.code.toLowerCase().includes(term) ||
        item.lineName.toLowerCase().includes(term) ||
        item.sectorName.toLowerCase().includes(term) ||
        item.items.some(
          (product) =>
            product.productCode.toLowerCase().includes(term) || product.productName.toLowerCase().includes(term),
        );

      return matchesDate && matchesSector && matchesLine && matchesSearch;
    });
  }, [lineFilter, opRows, productionDateFilter, searchTerm, sectorFilter]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim().length > 0) {
      count += 1;
    }
    if (productionDateFilter !== "all") {
      count += 1;
    }
    if (sectorFilter !== "all") {
      count += 1;
    }
    if (lineFilter !== "all") {
      count += 1;
    }
    return count;
  }, [lineFilter, productionDateFilter, searchTerm, sectorFilter]);

  const opPagination = useMemo(() => paginateArray(filteredOps, opPage, opPageSize), [filteredOps, opPage, opPageSize]);

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

  const kpis = {
    totalOps: opRows.length,
    totalKg: Number(opRows.reduce((sum, item) => sum + item.totalKg, 0).toFixed(2)),
    setoresAtivos: new Set(opRows.map((item) => item.sectorName)).size,
    linhasAtivas: new Set(opRows.map((item) => item.lineName)).size,
  };

  const flowSteps = [
    {
      key: "producao",
      title: "Produção",
      helper: "OPs geradas",
      value: opRows.length,
      href: "/chao-fabrica/ordens-producao",
      icon: Factory,
    },
    {
      key: "expedicao",
      title: "Expedição",
      helper: "Separação por pedido",
      value: planningData.expedition.length,
      href: "/chao-fabrica/expedicao",
      icon: Truck,
    },
  ];

  const opColumns = [
    { key: "code", header: "OP" },
    { key: "productionDateLabel", header: "Data Produção" },
    { key: "sectorName", header: "Setor" },
    { key: "lineName", header: "Linha" },
    { key: "productsCount", header: "Produtos" },
    { key: "totalKg", header: "Total (Kg)" },
    {
      key: "utilization",
      header: "Utilização",
      render: (item: OpQueueRow) => (
        <div className="min-w-[160px]">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>{item.utilization.toFixed(1)}%</span>
            <span>{item.capacityKg} Kg</span>
          </div>
          <div className="h-2 rounded-full bg-panel">
            <div
              className={cn(
                "h-full rounded-full",
                item.pressure === "critico"
                  ? "bg-danger"
                  : item.pressure === "atencao"
                    ? "bg-warning"
                    : "bg-success",
              )}
              style={{ width: `${Math.min(item.utilization, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (item: OpQueueRow) => <StatusBadge status={item.status} /> },
  ];

  const opActions = [
    {
      icon: "view" as const,
      label: "Visualizar OP",
      onClick: (item: OpQueueRow) => router.push(`/chao-fabrica/ordens-producao/${item.id}?ref=${referenceDate}`),
    },
    {
      icon: "print" as const,
      label: "Imprimir OP",
      onClick: (item: OpQueueRow) => printProductionOrder(item, referenceDate),
    },
  ];

  const dailyColumns = [
    { key: "productionDateLabel", header: "Data Produção" },
    { key: "opsCount", header: "OPs" },
    { key: "sectorsCount", header: "Setores" },
    { key: "linesCount", header: "Linhas" },
    { key: "totalKg", header: "Carga (Kg)" },
  ];

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
      description="Visualização operacional das OPs já consolidadas para execução no chão de fábrica."
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
        <KPICard title="OPs Consolidadas" value={kpis.totalOps} icon={ClipboardList} tone="neutral" />
        <KPICard title="Carga Total" value={`${kpis.totalKg} Kg`} icon={Factory} tone="success" />
        <KPICard title="Setores Ativos" value={kpis.setoresAtivos} icon={Factory} tone="info" />
        <KPICard title="Linhas Ativas" value={kpis.linhasAtivas} icon={Layers} tone="warning" />
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
        currentKey="producao"
        steps={flowSteps}
        subtitle="Nesta tela você visualiza e executa somente a etapa de produção."
      />

      <Card>
        <CardHeader>
          <CardTitle>Impressão Operacional</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Setor para impressão</p>
            <Select value={sectorPrintFilter} onValueChange={setSectorPrintFilter}>
              <SelectTrigger className="w-full bg-background md:w-[280px]">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {sectorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              printSectorProductionOrders(
                sectorPrintFilter === "all" ? "Todos os setores" : sectorPrintFilter,
                opsForSectorPrint,
                referenceDate,
              )
            }
            disabled={opsForSectorPrint.length === 0}
          >
            <Printer className="size-4" />
            Imprimir OPs do setor
          </Button>
        </CardContent>
      </Card>

      <OperationFiltersCard
        title="Filtros da Produção"
        summary={`${filteredOps.length} de ${opRows.length} OPs visíveis`}
        searchLabel="Busca"
        searchPlaceholder="Buscar por OP, produto, setor ou linha..."
        searchValue={searchTerm}
        onSearch={(value) => {
          setSearchTerm(value);
          setOpPage(1);
        }}
        activeFiltersCount={activeFiltersCount}
        onClear={clearFilters}
        fields={[
          {
            key: "productionDate",
            label: "Data de Produção",
            value: productionDateFilter,
            onChange: (value) => {
              setProductionDateFilter(value);
              setOpPage(1);
            },
            options: planningData.productionDates.map((date) => ({
              value: date,
              label: formatDateKeyBr(date),
            })),
          },
          {
            key: "sector",
            label: "Setor",
            value: sectorFilter,
            onChange: (value) => {
              setSectorFilter(value);
              setOpPage(1);
            },
            options: sectorOptions,
          },
          {
            key: "line",
            label: "Linha",
            value: lineFilter,
            onChange: (value) => {
              setLineFilter(value);
              setOpPage(1);
            },
            options: lineOptions,
          },
        ]}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-background via-background to-panel/80">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle>Ordens de Produção Consolidadas</CardTitle>
            <p className="text-xs text-muted-foreground">
              {filteredOps.length} de {opRows.length} OPs visíveis
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            data={opPagination.items}
            columns={opColumns}
            actions={opActions}
            keyField="id"
            emptyMessage="Nenhuma OP encontrada para os filtros"
            stickyHeader
            rowClassName={(item: OpQueueRow) =>
              item.pressure === "critico" ? "bg-danger/10" : item.pressure === "atencao" ? "bg-warning/10" : ""
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
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Carga por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={dailyRows}
              columns={dailyColumns}
              keyField="id"
              emptyMessage="Sem dados de produção para a referência atual"
              compact
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alinhamento por Linha x Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[980px] border-collapse">
                <thead className="bg-panel">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Linha
                    </th>
                    {alignedLineRows.dates.map((date) => (
                      <th
                        key={date}
                        className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap"
                      >
                        {formatDateKeyBr(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alignedLineRows.lines.map((lineName) => (
                    <tr key={lineName}>
                      <td className="border-t border-border/70 bg-card px-3 py-2 text-sm font-semibold text-foreground whitespace-nowrap">
                        {lineName}
                      </td>
                      {alignedLineRows.dates.map((date) => {
                        const key = `${lineName}|${date}`;
                        const rows = alignedLineRows.map.get(key) ?? [];
                        const totalKg = rows.reduce((sum, row) => sum + row.totalKg, 0);

                        return (
                          <td key={key} className="border-t border-border/70 bg-card px-3 py-2 text-xs whitespace-nowrap">
                            {rows.length === 0 ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <div className="space-y-1">
                                <div className="rounded bg-panel px-2 py-1 font-semibold">{rows.length} OP(s)</div>
                                <div className="text-muted-foreground">{totalKg.toFixed(2)} Kg</div>
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

