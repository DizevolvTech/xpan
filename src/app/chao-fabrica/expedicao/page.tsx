"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Factory, ListChecks, Package, Printer, Truck } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyFactoryOrderStatus, useFactoryOrderStatus } from "@/lib/factory-order-status";
import { printExpeditionSeparation } from "@/lib/factory-print";
import {
  buildFactoryPlanningData,
  formatDateKeyBr,
  getTodayDateKey,
  type ExpeditionRow,
} from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";

type ExpeditionOrderRow = ExpeditionRow;

export default function ExpedicaoPage() {
  const [referenceDate, setReferenceDate] = useState(getTodayDateKey());
  const [searchTerm, setSearchTerm] = useState("");
  const [deliveryDateFilter, setDeliveryDateFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const statusState = useFactoryOrderStatus(referenceDate);

  const basePlanningData = useMemo(() => buildFactoryPlanningData(referenceDate), [referenceDate]);
  const planningData = useMemo(
    () => applyFactoryOrderStatus(basePlanningData, statusState.resolveStatus),
    [basePlanningData, statusState.resolveStatus],
  );

  const orderRows = useMemo<ExpeditionOrderRow[]>(
    () =>
      [...planningData.expedition].sort((a, b) => {
        const byDelivery = a.deliveryDate.localeCompare(b.deliveryDate);
        if (byDelivery !== 0) {
          return byDelivery;
        }

        const byStore = a.storeName.localeCompare(b.storeName);
        if (byStore !== 0) {
          return byStore;
        }

        return a.orderCode.localeCompare(b.orderCode);
      }),
    [planningData.expedition],
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

  const activeFiltersCount = useMemo(() => {
    let count = 0;

    if (searchTerm.trim().length > 0) {
      count += 1;
    }
    if (deliveryDateFilter !== "all") {
      count += 1;
    }
    if (storeFilter !== "all") {
      count += 1;
    }
    if (statusFilter !== "all") {
      count += 1;
    }

    return count;
  }, [deliveryDateFilter, searchTerm, statusFilter, storeFilter]);

  const storeOptions = useMemo(
    () =>
      Array.from(new Set(orderRows.map((item) => item.storeName)))
        .sort((a, b) => a.localeCompare(b))
        .map((storeName) => ({ value: storeName, label: storeName })),
    [orderRows],
  );

  const deliveryOptions = useMemo(
    () => planningData.deliveryDates.map((deliveryDate) => ({ value: deliveryDate, label: formatDateKeyBr(deliveryDate) })),
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
    entregasHoje: orderRows.filter((item) => item.deliveryDate === referenceDate).length,
  };

  const flowSteps = [
    {
      key: "producao",
      title: "Produção",
      helper: "OPs em Kg",
      value: planningData.productionOrders.length,
      href: "/chao-fabrica/ordens-producao",
      icon: Factory,
    },
    {
      key: "expedicao",
      title: "Expedição",
      helper: "Pedidos para separar",
      value: planningData.expedition.length,
      href: "/chao-fabrica/expedicao",
      icon: Truck,
    },
  ];

  const orderColumns = [
    { key: "orderCode", header: "Pedido" },
    { key: "storeName", header: "Loja" },
    {
      key: "deliveryDateLabel",
      header: "Entrega",
      render: (item: ExpeditionOrderRow) => (
        <span className="rounded-md bg-success/30 px-2 py-1 text-xs font-semibold text-success-foreground">
          {item.deliveryDateLabel}
        </span>
      ),
    },
    { key: "itemsCount", header: "Itens" },
    { key: "totalKg", header: "Carga (Kg)" },
    {
      key: "status",
      header: "Status",
      render: (item: ExpeditionOrderRow) => <StatusBadge status={item.status} />,
    },
    {
      key: "print",
      header: "Impressão",
      render: (item: ExpeditionOrderRow) => (
        <Button type="button" variant="outline" size="sm" onClick={() => printExpeditionSeparation(item, referenceDate)}>
          <Printer className="size-4" />
          Imprimir
        </Button>
      ),
    },
    {
      key: "separar",
      header: "Separação",
      render: (item: ExpeditionOrderRow) => {
        const canSeparate = item.status === "em_producao" || item.status === "rota_entrega";

        if (!canSeparate) {
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Disponível quando o pedido estiver em produção ou em rota de entrega."
            >
              Aguardando produção
            </Button>
          );
        }

        return (
          <Button asChild type="button" variant="outline" size="sm">
            <Link href={`/chao-fabrica/expedicao/${item.id}?ref=${referenceDate}`}>Abrir separação</Link>
          </Button>
        );
      },
    },
  ];

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
      description="Visualização operacional dos pedidos para separação e envio."
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
        <KPICard title="Pedidos para separar" value={kpis.pedidos} icon={Truck} tone="info" />
        <KPICard title="Itens para separar" value={kpis.itens} icon={Package} tone="neutral" />
        <KPICard title="Carga total" value={`${kpis.totalKg} Kg`} icon={ListChecks} tone="success" />
        <KPICard title="Entregas no dia" value={kpis.entregasHoje} icon={Truck} tone="warning" />
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
        currentKey="expedicao"
        steps={flowSteps}
        subtitle="Visualize os pedidos liberados, abra a separação e execute a expedição."
      />

      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Separação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Passo 1</p>
            <p className="mt-1 font-medium text-foreground">Selecione um pedido na tabela principal.</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Passo 2</p>
            <p className="mt-1 font-medium text-foreground">
              Abra a página de separação para visualizar os itens e a reconversão por unidade logística.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-panel/45 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Passo 3</p>
            <p className="mt-1 font-medium text-foreground">
              Gere a impressão operacional e execute a separação física para envio.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-background via-background to-panel/80">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle>Pedidos de Expedição</CardTitle>
            <p className="text-xs text-muted-foreground">
              {filteredOrders.length} de {orderRows.length} pedidos visíveis
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <OperationFiltersCard
            title="Filtros da Expedição"
            summary={`${filteredOrders.length} de ${orderRows.length} pedidos visíveis`}
            helperText="Filtre a tabela para encontrar o pedido e abrir a separação."
            searchLabel="Busca"
            searchPlaceholder="Buscar por pedido ou loja..."
            searchValue={searchTerm}
            onSearch={(value) => {
              setSearchTerm(value);
              setOrdersPage(1);
            }}
            fields={[
              {
                key: "deliveryDate",
                label: "Data de Entrega",
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
                  { value: "agendado", label: "Agendado" },
                  { value: "em_producao", label: "Em Produção" },
                  { value: "em_espera", label: "Em Espera" },
                  { value: "rota_entrega", label: "Rota de Entrega" },
                ],
              },
            ]}
            activeFiltersCount={activeFiltersCount}
            onClear={clearFilters}
          />

          <DataTable
            data={ordersPagination.items}
            columns={orderColumns}
            keyField="id"
            emptyMessage="Nenhum pedido de expedição encontrado"
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

