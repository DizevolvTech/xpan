"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, MapPinned, Navigation, Package, Truck, XCircle } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useDeliveryExecution,
} from "@/lib/delivery-execution";
import {
  canRegisterDeliveryFailure,
  getNextDeliveryAction,
  type DeliveryExecutionStatus,
} from "@/lib/delivery-workflow";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import { formatDateKeyBr, type ExpeditionRow } from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";
import { sortItemsByTemporalValue, type TemporalSortOrder } from "@/lib/temporal-table-sort";
import { formatKgLabel } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

type DeliveryRow = ExpeditionRow & {
  routeCode: string;
  zone: string;
  stopLabel: string;
  expeditionReady: boolean;
  executionStatus: DeliveryExecutionStatus;
  executionUpdatedAt: string;
};

const ROUTE_ZONES = ["Centro", "Norte", "Sul", "Leste", "Oeste", "Industrial"];

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return hash;
}

function buildRouteMeta(item: ExpeditionRow, index: number) {
  const seed = hashCode(`${item.orderCode}-${item.storeName}-${item.deliveryDate}-${index}`);
  const routeNumber = (seed % 40) + 1;
  const stopNumber = (seed % 12) + 1;

  return {
    routeCode: `R-${item.deliveryDate.replaceAll("-", "").slice(2)}-${String(routeNumber).padStart(2, "0")}`,
    zone: ROUTE_ZONES[seed % ROUTE_ZONES.length],
    stopLabel: `${stopNumber}a parada`,
  };
}

function formatLastUpdate(dateIso: string) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getMainActionMeta(status: DeliveryExecutionStatus) {
  const action = getNextDeliveryAction(status);
  if (!action) {
    return null;
  }

  return {
    ...action,
    icon:
      action.nextStatus === "no_destino"
        ? MapPinned
        : action.nextStatus === "entregue"
          ? CheckCircle2
          : Navigation,
  };
}

export default function EntregasPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [deliveryDateFilter, setDeliveryDateFilter] = useState("all");
  // AJ-0002: filtro inicial vindo do deep-link dos cards do dashboard.
  const [executionStatusFilter, setExecutionStatusFilter] = useState(
    () => searchParams.get("status") ?? "all",
  );
  const [zoneFilter, setZoneFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<TemporalSortOrder>("recent_first");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { planningData: planningSnapshot } = useFactoryPlanningSnapshot(anchorDate);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
  );
  const deliveryExecutionState = useDeliveryExecution();

  // AJ-0017: mapa pedido → OP (primeira OP encontrada) para deep-link da
  // entrega que ainda está "aguardando produção" direto na ordem de produção.
  const opIdByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    planningData.productionOrders.forEach((op) => {
      op.sourceItems.forEach((source) => {
        if (!map.has(source.orderId)) {
          map.set(source.orderId, op.id);
        }
      });
    });
    return map;
  }, [planningData.productionOrders]);

  const deliveryRows = useMemo<DeliveryRow[]>(
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
        .map((item, index) => {
          const routeMeta = buildRouteMeta(item, index);
          const expeditionReady = item.status === "aguardando_expedicao";
          const execution = deliveryExecutionState.resolveExecution(
            item.orderId,
            expeditionReady,
          );

          return {
            ...item,
            ...routeMeta,
            expeditionReady,
            executionStatus: execution.status,
            executionUpdatedAt: execution.updatedAt,
          };
        }),
    [deliveryExecutionState, planningData.expedition],
  );

  const filteredRows = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return deliveryRows.filter((item) => {
      const matchesSearch =
        normalizedTerm.length === 0 ||
        item.orderCode.toLowerCase().includes(normalizedTerm) ||
        item.storeName.toLowerCase().includes(normalizedTerm) ||
        item.routeCode.toLowerCase().includes(normalizedTerm);
      const matchesDeliveryDate = deliveryDateFilter === "all" || item.deliveryDate === deliveryDateFilter;
      const matchesExecutionStatus = executionStatusFilter === "all" || item.executionStatus === executionStatusFilter;
      const matchesZone = zoneFilter === "all" || item.zone === zoneFilter;

      return matchesSearch && matchesDeliveryDate && matchesExecutionStatus && matchesZone;
    });
  }, [deliveryDateFilter, deliveryRows, executionStatusFilter, searchTerm, zoneFilter]);
  const sortedRows = useMemo(
    () => sortItemsByTemporalValue(filteredRows, sortOrder, ["deliveryDate"]),
    [filteredRows, sortOrder],
  );

  const paginatedRows = useMemo(() => paginateArray(sortedRows, page, pageSize), [page, pageSize, sortedRows]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;

    if (searchTerm.trim().length > 0) {
      count += 1;
    }
    if (deliveryDateFilter !== "all") {
      count += 1;
    }
    if (executionStatusFilter !== "all") {
      count += 1;
    }
    if (zoneFilter !== "all") {
      count += 1;
    }

    return count;
  }, [deliveryDateFilter, executionStatusFilter, searchTerm, zoneFilter]);

  const kpis = useMemo(
    () => ({
      total: deliveryRows.length,
      prontas: deliveryRows.filter((item) => item.executionStatus === "pronto_coleta").length,
      emRota: deliveryRows.filter((item) => item.executionStatus === "em_rota" || item.executionStatus === "no_destino").length,
      entregues: deliveryRows.filter((item) => item.executionStatus === "entregue").length,
      falhas: deliveryRows.filter((item) => item.executionStatus === "tentativa_falha").length,
    }),
    [deliveryRows],
  );

  const flowSteps = [
    {
      key: "expedicao",
      title: "Expedição",
      helper: "Pedidos separados",
      value: planningData.expedition.length,
      href: "/chao-fabrica/expedicao",
      icon: Package,
    },
    {
      key: "entregas",
      title: "Entregas",
      helper: "Execução em campo",
      value: filteredRows.length,
      href: "/chao-fabrica/entregas",
      icon: Truck,
    },
  ];

  const columns = [
    { key: "orderCode", header: "Pedido" },
    { key: "storeName", header: "Loja" },
    { key: "routeCode", header: "Rota" },
    { key: "zone", header: "Zona" },
    {
      key: "deliveryDate",
      header: "Entrega",
      render: (item: DeliveryRow) => (
        <span className="rounded-md bg-success/30 px-2 py-1 text-xs font-semibold text-success-foreground">
          {item.deliveryDateLabel}
        </span>
      ),
    },
    { key: "stopLabel", header: "Parada" },
    {
      key: "executionStatus",
      header: "Execução",
      render: (item: DeliveryRow) => <StatusBadge status={item.executionStatus} />,
    },
    {
      key: "updatedAt",
      header: "Atualizado",
      render: (item: DeliveryRow) => <span className="text-xs text-muted-foreground">{formatLastUpdate(item.executionUpdatedAt)}</span>,
    },
    {
      key: "actions",
      header: "Ações",
      render: (item: DeliveryRow) => {
        const mainAction = getMainActionMeta(item.executionStatus);
        const canMarkFailure = canRegisterDeliveryFailure(item.executionStatus);

        if (item.executionStatus === "aguardando_expedicao") {
          const opId = opIdByOrderId.get(item.orderId);
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                title={
                  item.expeditionReady
                    ? "Conclua o checklist da expedição antes de iniciar a entrega."
                    : "Pedido ainda não liberado para expedição."
                }
              >
                {item.expeditionReady ? "Aguardando checklist" : "Aguardando expedição"}
              </Button>
              {!item.expeditionReady && opId ? (
                <Button asChild type="button" variant="ghost" size="sm">
                  <Link
                    href={`/chao-fabrica/ordens-producao/${opId}?ref=${anchorDate}`}
                    title="Abrir a ordem de produção deste pedido"
                  >
                    <Package className="size-4" />
                    Ver OP
                  </Link>
                </Button>
              ) : null}
            </div>
          );
        }

        if (item.executionStatus === "entregue") {
          return <span className="text-xs font-semibold text-success-foreground">Entrega concluída</span>;
        }

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {mainAction && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => void deliveryExecutionState.updateExecution(item.orderId, mainAction.nextStatus)}
              >
                <mainAction.icon className="size-4" />
                {mainAction.label}
              </Button>
            )}
            {canMarkFailure && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void deliveryExecutionState.updateExecution(item.orderId, "tentativa_falha")}
              >
                <XCircle className="size-4" />
                Falha
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  function clearFilters() {
    setSearchTerm("");
    setDeliveryDateFilter("all");
    setExecutionStatusFilter("all");
    setZoneFilter("all");
    setPage(1);
  }

  return (
    <PageLayout
      title="Entregas"
      description="Execução de entregas em campo: inicie rotas, marque chegada, confirme entrega e registre falhas."
      badge="Uber de Entregas"
      breadcrumbs={[{ label: "Chão de Fábrica", href: "/chao-fabrica" }, { label: "Entregas" }]}
      actions={
        <Button asChild type="button" variant="outline">
          <Link href="/chao-fabrica">
            <ArrowLeft className="size-4" />
            Voltar ao painel
          </Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Pedidos para entrega" value={kpis.total} tone="info" icon={Truck} compactValue />
        <KPICard title="Prontos para sair" value={kpis.prontas} tone="warning" icon={Package} compactValue />
        <KPICard title="Em rota" value={kpis.emRota} tone="success" icon={Navigation} compactValue />
        <KPICard title="Entregues" value={kpis.entregues} tone="success" icon={CheckCircle2} compactValue />
        <KPICard title="Falhas de tentativa" value={kpis.falhas} tone="danger" icon={XCircle} compactValue />
      </div>

      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela das entregas"
        description="Acompanhe toda a malha, um único dia de entrega ou um período fechado sem refazer o planejamento."
      />

      <FactoryFlow
        currentKey="entregas"
        steps={flowSteps}
        subtitle="Fluxo: pedido separado, saída para entrega, chegada no destino e confirmação final."
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-background via-background to-panel/80">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle>Despacho e execução</CardTitle>
            <p className="text-xs text-muted-foreground">
              {filteredRows.length} de {deliveryRows.length} pedidos visíveis
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <OperationFiltersCard
            title="Filtros de entrega"
            summary={`${filteredRows.length} de ${deliveryRows.length} pedidos visíveis`}
            helperText="Use no celular para localizar rápido por rota, loja ou pedido."
            searchLabel="Busca"
            searchPlaceholder="Buscar pedido, loja ou rota..."
            searchValue={searchTerm}
            onSearch={(value) => {
              setSearchTerm(value);
              setPage(1);
            }}
            fields={[
              {
                key: "deliveryDate",
                label: "Data de entrega",
                value: deliveryDateFilter,
                onChange: (value) => {
                  setDeliveryDateFilter(value);
                  setPage(1);
                },
                options: planningData.deliveryDates.map((deliveryDate) => ({
                  value: deliveryDate,
                  label: formatDateKeyBr(deliveryDate),
                })),
              },
              {
                key: "zone",
                label: "Zona",
                value: zoneFilter,
                onChange: (value) => {
                  setZoneFilter(value);
                  setPage(1);
                },
                options: Array.from(new Set(deliveryRows.map((item) => item.zone)))
                  .sort((a, b) => a.localeCompare(b))
                  .map((zone) => ({ value: zone, label: zone })),
              },
              {
                key: "execution",
                label: "Execução",
                value: executionStatusFilter,
                onChange: (value) => {
                  setExecutionStatusFilter(value);
                  setPage(1);
                },
                options: [
                  { value: "aguardando_expedicao", label: "Aguardando Expedição" },
                  { value: "pronto_coleta", label: "Pronto p/ Coleta" },
                  { value: "em_rota", label: "Em Rota" },
                  { value: "no_destino", label: "No Destino" },
                  { value: "entregue", label: "Entregue" },
                  { value: "tentativa_falha", label: "Tentativa Falhou" },
                ],
              },
            ]}
            activeFiltersCount={activeFiltersCount}
            onClear={clearFilters}
          />

          <div className="grid gap-3 md:hidden">
            {paginatedRows.items.map((item) => {
              const mainAction = getMainActionMeta(item.executionStatus);
              const canMarkFailure = canRegisterDeliveryFailure(item.executionStatus);

              return (
                <article key={item.id} className="rounded-xl border border-border/75 bg-card p-3 shadow-[var(--shadow-soft)]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{item.routeCode}</p>
                      <p className="text-sm font-semibold text-foreground">{item.orderCode}</p>
                      <p className="text-xs text-muted-foreground">{item.storeName}</p>
                    </div>
                    <StatusBadge status={item.executionStatus} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-border/70 bg-panel/45 p-2">
                      <p className="text-muted-foreground">Zona</p>
                      <p className="font-semibold text-foreground">{item.zone}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-panel/45 p-2">
                      <p className="text-muted-foreground">Parada</p>
                      <p className="font-semibold text-foreground">{item.stopLabel}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-panel/45 p-2">
                      <p className="text-muted-foreground">Entrega</p>
                      <p className="font-semibold text-foreground">{item.deliveryDateLabel}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-panel/45 p-2">
                      <p className="text-muted-foreground">Carga</p>
                      <p className="font-semibold text-foreground">{formatKgLabel(item.totalKg)}</p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">Última atualização: {formatLastUpdate(item.executionUpdatedAt)}</p>

                  <div className="mt-3 grid gap-2">
                    {item.executionStatus === "aguardando_expedicao" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled
                          title={
                            item.expeditionReady
                              ? "Conclua o checklist da expedição antes de iniciar a entrega."
                              : "Pedido ainda não liberado para expedição."
                          }
                        >
                          {item.expeditionReady ? "Aguardando checklist" : "Aguardando expedição"}
                        </Button>
                        {!item.expeditionReady && opIdByOrderId.get(item.orderId) ? (
                          <Button asChild type="button" variant="ghost" size="sm">
                            <Link
                              href={`/chao-fabrica/ordens-producao/${opIdByOrderId.get(item.orderId)}?ref=${anchorDate}`}
                            >
                              <Package className="size-4" />
                              Ver OP em produção
                            </Link>
                          </Button>
                        ) : null}
                      </>
                    ) : item.executionStatus === "entregue" ? (
                      <Button type="button" variant="outline" size="sm" disabled>
                        Entrega concluída
                      </Button>
                    ) : (
                      <>
                        {mainAction && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void deliveryExecutionState.updateExecution(item.orderId, mainAction.nextStatus)}
                          >
                            <mainAction.icon className="size-4" />
                            {mainAction.label}
                          </Button>
                        )}
                        {canMarkFailure && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void deliveryExecutionState.updateExecution(item.orderId, "tentativa_falha")}
                          >
                            <XCircle className="size-4" />
                            Registrar falha
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden md:block">
            <DataTable
              data={paginatedRows.items}
              columns={columns}
              keyField="id"
              pagination={false}
              showFooterControls={false}
              emptyMessage="Nenhum pedido encontrado para execução de entrega"
              stickyHeader
            />
          </div>

          <PaginationControls
            page={paginatedRows.page}
            pageSize={paginatedRows.pageSize}
            totalItems={paginatedRows.totalItems}
            totalPages={paginatedRows.totalPages}
            startIndex={paginatedRows.startIndex}
            endIndex={paginatedRows.endIndex}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            label="entregas"
            sortOrder={sortOrder}
            onSortOrderChange={(nextSortOrder) => {
              setSortOrder(nextSortOrder);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
