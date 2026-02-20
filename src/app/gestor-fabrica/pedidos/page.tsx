"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Factory, ListChecks, Printer, ShoppingCart, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { FactoryFlow } from "@/components/shared/factory-flow";
import { KPICard } from "@/components/shared/kpi-card";
import { OrderStatusControl } from "@/components/shared/order-status-control";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyFactoryOrderStatus, useFactoryOrderStatus } from "@/lib/factory-order-status";
import {
  buildFactoryPlanningData,
  formatDateKeyBr,
  getTodayDateKey,
  type PlannedOrderItem,
  type PlannedOrderRow,
  type ProductionOrderRow,
} from "@/lib/order-planning";
import { printOrderSummary } from "@/lib/factory-print";
import { paginateArray } from "@/lib/pagination";

type ItemQueueRow = PlannedOrderItem & {
  requestedLabel: string;
  productionDateLabel: string;
  deliveryDateLabel: string;
  attention: "ok" | "atrasado" | "sem_agenda";
};

type OrderSummaryRow = PlannedOrderRow & {
  productsCount: number;
};

export default function PedidosFabricaPage() {
  const router = useRouter();
  const [referenceDate, setReferenceDate] = useState(getTodayDateKey());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [attentionFilter, setAttentionFilter] = useState("all");
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(20);
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageSize, setSummaryPageSize] = useState(12);
  const statusState = useFactoryOrderStatus(referenceDate);

  const basePlanningData = useMemo(() => buildFactoryPlanningData(referenceDate), [referenceDate]);
  const planningData = useMemo(
    () => applyFactoryOrderStatus(basePlanningData, statusState.resolveStatus),
    [basePlanningData, statusState.resolveStatus],
  );

  const itemRows = useMemo<ItemQueueRow[]>(() => {
    return planningData.orderItems
      .map((item) => {
        const attention: ItemQueueRow["attention"] = !item.canPlan ? "sem_agenda" : item.delayed ? "atrasado" : "ok";
        return {
          ...item,
          requestedLabel: `${item.requestedQuantity} ${item.requestedUnit}`,
          productionDateLabel: item.productionDate ? formatDateKeyBr(item.productionDate) : "Sem agenda",
          deliveryDateLabel: formatDateKeyBr(item.deliveryDate),
          attention,
        };
      })
      .sort((a, b) => {
        const byDelivery = a.deliveryDate.localeCompare(b.deliveryDate);
        if (byDelivery !== 0) {
          return byDelivery;
        }
        const byOrder = a.orderCode.localeCompare(b.orderCode);
        if (byOrder !== 0) {
          return byOrder;
        }
        return a.productCode.localeCompare(b.productCode);
      });
  }, [planningData.orderItems]);

  const filteredItems = useMemo(() => {
    return itemRows.filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        item.orderCode.toLowerCase().includes(term) ||
        item.storeName.toLowerCase().includes(term) ||
        item.productCode.toLowerCase().includes(term) ||
        item.productName.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesStore = storeFilter === "all" || item.storeName === storeFilter;
      const matchesUnit = unitFilter === "all" || item.requestedUnit === unitFilter;
      const matchesDelivery = deliveryFilter === "all" || item.deliveryDate === deliveryFilter;
      const matchesAttention = attentionFilter === "all" || item.attention === attentionFilter;

      return matchesSearch && matchesStatus && matchesStore && matchesUnit && matchesDelivery && matchesAttention;
    });
  }, [attentionFilter, deliveryFilter, itemRows, searchTerm, statusFilter, storeFilter, unitFilter]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) {
      count += 1;
    }
    if (statusFilter !== "all") {
      count += 1;
    }
    if (storeFilter !== "all") {
      count += 1;
    }
    if (unitFilter !== "all") {
      count += 1;
    }
    if (deliveryFilter !== "all") {
      count += 1;
    }
    if (attentionFilter !== "all") {
      count += 1;
    }
    return count;
  }, [attentionFilter, deliveryFilter, searchTerm, statusFilter, storeFilter, unitFilter]);

  const queuePagination = useMemo(
    () => paginateArray(filteredItems, queuePage, queuePageSize),
    [filteredItems, queuePage, queuePageSize],
  );

  const summaryRows = useMemo<OrderSummaryRow[]>(() => {
    const productsByOrderId = new Map<string, Set<string>>();

    planningData.orderItems.forEach((item) => {
      if (!productsByOrderId.has(item.orderId)) {
        productsByOrderId.set(item.orderId, new Set<string>());
      }
      productsByOrderId.get(item.orderId)?.add(item.productId);
    });

    return planningData.orders.map((order) => ({
      ...order,
      productsCount: productsByOrderId.get(order.id)?.size ?? 0,
    }));
  }, [planningData.orderItems, planningData.orders]);

  const summaryByOrderId = useMemo(
    () => new Map(summaryRows.map((order) => [order.id, order])),
    [summaryRows],
  );
  const orderItemsByOrderId = useMemo(() => {
    const map = new Map<string, PlannedOrderItem[]>();
    planningData.orderItems.forEach((item) => {
      if (!map.has(item.orderId)) {
        map.set(item.orderId, []);
      }
      map.get(item.orderId)?.push(item);
    });
    return map;
  }, [planningData.orderItems]);
  const relatedOpsByOrderId = useMemo(() => {
    const orderIdByCode = new Map(summaryRows.map((order) => [order.code, order.id]));
    const map = new Map<string, ProductionOrderRow[]>();

    summaryRows.forEach((order) => {
      map.set(order.id, []);
    });

    planningData.productionOrders.forEach((op) => {
      op.orderCodes.forEach((orderCode) => {
        const matchingOrderId = orderIdByCode.get(orderCode);
        if (!matchingOrderId) {
          return;
        }
        const current = map.get(matchingOrderId) ?? [];
        map.set(matchingOrderId, [...current, op]);
      });
    });

    return map;
  }, [planningData.productionOrders, summaryRows]);

  const summaryPagination = useMemo(
    () => paginateArray(summaryRows, summaryPage, summaryPageSize),
    [summaryRows, summaryPage, summaryPageSize],
  );

  const storeOptions = useMemo(
    () =>
      Array.from(new Set(itemRows.map((item) => item.storeName)))
        .sort((a, b) => a.localeCompare(b))
        .map((store) => ({ value: store, label: store })),
    [itemRows],
  );

  const unitOptions = useMemo(
    () =>
      Array.from(new Set(itemRows.map((item) => item.requestedUnit)))
        .sort((a, b) => a.localeCompare(b))
        .map((unit) => ({ value: unit, label: unit })),
    [itemRows],
  );

  const deliveryOptions = useMemo(
    () =>
      Array.from(new Set(itemRows.map((item) => item.deliveryDate)))
        .sort((a, b) => a.localeCompare(b))
        .map((date) => ({ value: date, label: formatDateKeyBr(date) })),
    [itemRows],
  );

  const flowSteps = [
    {
      key: "pedidos",
      title: "Pedidos",
      helper: "Itens vendidos",
      value: planningData.orderItems.length,
      href: "/gestor-fabrica/pedidos",
      icon: ShoppingCart,
    },
    {
      key: "producao",
      title: "Produção",
      helper: "OPs em Kg",
      value: planningData.productionOrders.length,
      href: "/gestor-fabrica/ordens-producao",
      icon: Factory,
    },
    {
      key: "expedicao",
      title: "Expedição",
      helper: "Itens para separar",
      value: planningData.expeditionItems.length,
      href: "/gestor-fabrica/expedicao",
      icon: Truck,
    },
  ];

  const kpis = {
    itens: itemRows.length,
    pedidos: planningData.orders.length,
    producaoHoje: itemRows.filter((item) => item.status === "em_producao").length,
    semAgenda: itemRows.filter((item) => !item.canPlan).length,
  };

  const queueColumns = [
    {
      key: "orderCode",
      header: "Pedido",
      render: (item: ItemQueueRow) => {
        const orderSummary = summaryByOrderId.get(item.orderId);
        return (
          <div className="flex flex-col">
            <span>{item.orderCode}</span>
            {orderSummary ? (
              <span className="text-xs text-muted-foreground">
                {orderSummary.productsCount} produtos · {orderSummary.itemsCount} itens
              </span>
            ) : null}
          </div>
        );
      },
    },
    { key: "storeName", header: "Loja" },
    {
      key: "product",
      header: "Produto",
      render: (item: ItemQueueRow) => (
        <span className="text-sm">
          {item.productCode} · {item.productName}
        </span>
      ),
    },
    { key: "requestedLabel", header: "Qtd Pedida" },
    { key: "internalKg", header: "Kg Interno" },
    { key: "productionDateLabel", header: "Produção" },
    {
      key: "deliveryDateLabel",
      header: "Recebimento",
      render: (item: ItemQueueRow) => (
        <span className="rounded-md bg-warning/30 px-2 py-1 text-xs font-semibold text-warning-foreground">
          {item.deliveryDateLabel}
        </span>
      ),
    },
    {
      key: "opCode",
      header: "OP",
      render: (item: ItemQueueRow) => item.opCode ?? "-",
    },
    {
      key: "status",
      header: "Status",
      render: (item: ItemQueueRow) => <StatusBadge status={item.status} />,
    },
  ];

  const queueActions = [
    {
      icon: "view" as const,
      label: "Visualizar pedido",
      onClick: (item: ItemQueueRow) => router.push(`/gestor-fabrica/pedidos/${item.orderId}?ref=${referenceDate}`),
    },
  ];

  const summaryColumns = [
    { key: "code", header: "Pedido" },
    { key: "storeName", header: "Loja" },
    { key: "productsCount", header: "Produtos" },
    { key: "itemsCount", header: "Itens" },
    { key: "totalKg", header: "Total (Kg)" },
    { key: "productionDateLabel", header: "Produção" },
    { key: "deliveryDateLabel", header: "Recebimento" },
    { key: "opsLabel", header: "OPs" },
    {
      key: "status",
      header: "Status",
      render: (item: OrderSummaryRow) => <StatusBadge status={item.status} />,
    },
    {
      key: "statusControl",
      header: "Alterar Status",
      render: (item: OrderSummaryRow) => (
        <OrderStatusControl
          orderId={item.id}
          status={item.status}
          onStatusChange={statusState.updateOrderStatus}
          compact
        />
      ),
    },
  ];

  const summaryActions = [
    {
      icon: "view" as const,
      label: "Abrir detalhe",
      onClick: (item: OrderSummaryRow) => router.push(`/gestor-fabrica/pedidos/${item.id}?ref=${referenceDate}`),
    },
    {
      icon: "print" as const,
      label: "Imprimir pedido",
      onClick: (item: OrderSummaryRow) => {
        const orderItems = orderItemsByOrderId.get(item.id) ?? [];
        const relatedOps = relatedOpsByOrderId.get(item.id) ?? [];
        printOrderSummary(item, orderItems, relatedOps, referenceDate);
      },
    },
  ];

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setStoreFilter("all");
    setUnitFilter("all");
    setDeliveryFilter("all");
    setAttentionFilter("all");
  }

  return (
    <PageLayout
      title="Gestão de Pedidos"
      description="Visão consolidada por pedido com quantidade de produtos, itens e carga total, com detalhe por item."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Pedidos" },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/ordens-producao">
              <Factory className="size-4" />
              Ordens de Produção
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-fabrica/expedicao">
              <Truck className="size-4" />
              Expedição
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Itens de Pedido" value={kpis.itens} icon={ShoppingCart} tone="info" compactValue />
        <KPICard title="Pedidos" value={kpis.pedidos} icon={ListChecks} tone="neutral" compactValue />
        <KPICard title="Produção no Dia" value={kpis.producaoHoje} icon={Factory} tone="success" compactValue />
        <KPICard title="Sem Agenda" value={kpis.semAgenda} icon={AlertTriangle} tone="danger" compactValue />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Controle de Referência</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Data de corte da fábrica
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

      <FactoryFlow currentKey="pedidos" steps={flowSteps} subtitle="Pedido vendido -> conversão em Kg -> produção -> expedição." />

      <Card>
        <CardHeader>
          <CardTitle>Controle Operacional</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <p className="rounded-lg border border-border/70 bg-panel/45 px-3 py-2 text-sm text-muted-foreground">
            Atualize o status direto na tabela de pedidos consolidados para manter produção e expedição sincronizadas.
          </p>
          <p className="rounded-lg border border-border/70 bg-panel/45 px-3 py-2 text-sm text-muted-foreground">
            Use o ícone <Printer className="mx-1 inline size-3.5" /> para gerar impressão operacional de cada pedido.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="pedidos" className="space-y-4">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="pedidos" className="gap-2">
            Pedidos (Consolidado)
            <span className="rounded-full bg-panel px-2 py-0.5 text-[11px] font-semibold">
              {summaryRows.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="itens" className="gap-2">
            Itens (Detalhe)
            <span className="rounded-full bg-panel px-2 py-0.5 text-[11px] font-semibold">{filteredItems.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Consolidados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DataTable
                data={summaryPagination.items}
                columns={summaryColumns}
                actions={summaryActions}
                keyField="id"
                emptyMessage="Nenhum pedido disponível"
                stickyHeader
              />

              <PaginationControls
                page={summaryPagination.page}
                pageSize={summaryPagination.pageSize}
                totalItems={summaryPagination.totalItems}
                totalPages={summaryPagination.totalPages}
                startIndex={summaryPagination.startIndex}
                endIndex={summaryPagination.endIndex}
                onPageChange={setSummaryPage}
                onPageSizeChange={(size) => {
                  setSummaryPageSize(size);
                  setSummaryPage(1);
                }}
                label="pedidos"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="itens" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/70 bg-gradient-to-r from-background via-background to-panel/80">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <CardTitle>Detalhe por Item de Pedido</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {filteredItems.length} de {itemRows.length} itens visíveis
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <OperationFiltersCard
                title="Filtros da Fila"
                summary={`${filteredItems.length} de ${itemRows.length} itens visíveis`}
                searchLabel="Busca"
                searchPlaceholder="Buscar por pedido, loja ou produto..."
                searchValue={searchTerm}
                onSearch={setSearchTerm}
                fields={[
                  {
                    key: "status",
                    label: "Status",
                    value: statusFilter,
                    onChange: setStatusFilter,
                    options: [
                      { value: "agendado", label: "Agendado" },
                      { value: "em_producao", label: "Em Produção" },
                      { value: "em_espera", label: "Em Espera" },
                      { value: "rota_entrega", label: "Rota de Entrega" },
                    ],
                  },
                  {
                    key: "store",
                    label: "Loja",
                    value: storeFilter,
                    onChange: setStoreFilter,
                    options: storeOptions,
                  },
                  {
                    key: "unit",
                    label: "Unidade",
                    value: unitFilter,
                    onChange: setUnitFilter,
                    options: unitOptions,
                  },
                  {
                    key: "delivery",
                    label: "Recebimento",
                    value: deliveryFilter,
                    onChange: setDeliveryFilter,
                    options: deliveryOptions,
                  },
                  {
                    key: "attention",
                    label: "Atenção",
                    value: attentionFilter,
                    onChange: setAttentionFilter,
                    options: [
                      { value: "sem_agenda", label: "Sem agenda" },
                      { value: "atrasado", label: "Atrasado" },
                      { value: "ok", label: "Sem pendência" },
                    ],
                  },
                ]}
                activeFiltersCount={activeFiltersCount}
                onClear={clearFilters}
              />

              <DataTable
                data={queuePagination.items}
                columns={queueColumns}
                actions={queueActions}
                keyField="id"
                emptyMessage="Nenhum item de pedido encontrado"
                stickyHeader
              />

              <PaginationControls
                page={queuePagination.page}
                pageSize={queuePagination.pageSize}
                totalItems={queuePagination.totalItems}
                totalPages={queuePagination.totalPages}
                startIndex={queuePagination.startIndex}
                endIndex={queuePagination.endIndex}
                onPageChange={setQueuePage}
                onPageSizeChange={(size) => {
                  setQueuePageSize(size);
                  setQueuePage(1);
                }}
                label="itens"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
