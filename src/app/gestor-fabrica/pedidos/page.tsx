"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, CalendarRange, Factory, ListChecks, ShoppingCart, Truck, Zap } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FactoryFlow } from "@/components/shared/factory-flow";
import { InfoHint } from "@/components/shared/info-hint";
import { KPICard } from "@/components/shared/kpi-card";
import { OperationFiltersCard } from "@/components/shared/operation-filters-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { useToast } from "@/components/shared/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { aggregateOrderItems } from "@/lib/order-item-aggregation";
import { filterFactoryPlanningDataByOperationalScope } from "@/lib/operational-date-scope";
import {
  formatDateKeyBr,
  type PlannedOrderItem,
  type PlannedOrderRow,
} from "@/lib/order-planning";
import { paginateArray } from "@/lib/pagination";
import { sortItemsByTemporalValue, type TemporalSortOrder } from "@/lib/temporal-table-sort";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import type { OperationalDateScopeMode } from "@/lib/operational-date-scope";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { performReleaseOrderWithConfirm } from "@/lib/release-order-with-confirm";

type OrderSummaryRow = PlannedOrderRow & {
  productsCount: number;
};

function openPrintPage(pathname: string) {
  window.open(pathname, "_blank", "noopener,noreferrer");
}

export default function PedidosFabricaPage() {
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const searchParams = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState("");
  // AJ-0002: filtro inicial vindo do deep-link dos cards do dashboard.
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<TemporalSortOrder>("recent_first");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([]);
  const [detailModal, setDetailModal] = useState<{
    orderId: string;
    view: "aggregated" | "original";
  } | null>(null);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [isAutoReleasing, setIsAutoReleasing] = useState(false);
  const { planningData: planningSnapshot, releaseOrder, cancelOrder, reopenOrder, refresh } = useFactoryPlanningSnapshot(anchorDate);
  const planningData = useMemo(
    () => filterFactoryPlanningDataByOperationalScope(planningSnapshot, scope),
    [planningSnapshot, scope],
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

  const summaryRows = useMemo<OrderSummaryRow[]>(() => {
    return planningData.orders.map((order) => {
      const items = orderItemsByOrderId.get(order.id) ?? [];
      return {
        ...order,
        productsCount: new Set(items.map((item) => item.productId)).size,
      };
    });
  }, [orderItemsByOrderId, planningData.orders]);

  const filteredOrders = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return summaryRows.filter((item) => {
      const matchesSearch =
        normalizedTerm.length === 0 ||
        item.code.toLowerCase().includes(normalizedTerm) ||
        item.storeName.toLowerCase().includes(normalizedTerm);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesStore = storeFilter === "all" || item.storeName === storeFilter;
      const matchesDelivery = deliveryFilter === "all" || item.deliveryDate === deliveryFilter;
      return matchesSearch && matchesStatus && matchesStore && matchesDelivery;
    });
  }, [deliveryFilter, searchTerm, statusFilter, storeFilter, summaryRows]);
  const sortedOrders = useMemo(
    () => sortItemsByTemporalValue(filteredOrders, sortOrder, ["orderedAtKey", "deliveryDate", "orderedAt"]),
    [filteredOrders, sortOrder],
  );

  const pagination = useMemo(() => paginateArray(sortedOrders, page, pageSize), [page, pageSize, sortedOrders]);
  const selectedModalOrder = useMemo(
    () => summaryRows.find((item) => item.id === detailModal?.orderId) ?? null,
    [detailModal?.orderId, summaryRows],
  );
  const selectedModalItems = useMemo(
    () => (detailModal ? orderItemsByOrderId.get(detailModal.orderId) ?? [] : []),
    [detailModal, orderItemsByOrderId],
  );
  const selectedModalAggregatedItems = useMemo(
    () => aggregateOrderItems(selectedModalItems),
    [selectedModalItems],
  );

  const flowSteps = [
    {
      key: "pedidos",
      title: "Pedidos",
      helper: "Demanda auditada",
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

  const storeOptions = useMemo(
    () =>
      Array.from(new Set(summaryRows.map((item) => item.storeName)))
        .sort((a, b) => a.localeCompare(b))
        .map((store) => ({ value: store, label: store })),
    [summaryRows],
  );

  const deliveryOptions = useMemo(
    () => planningData.deliveryDates.map((date) => ({ value: date, label: formatDateKeyBr(date) })),
    [planningData.deliveryDates],
  );

  const kpis = {
    total: summaryRows.length,
    liberados: summaryRows.filter((item) => item.releasedToProduction).length,
    emProducao: summaryRows.filter((item) => item.status === "em_producao").length,
    aguardandoExpedicao: summaryRows.filter((item) => item.status === "aguardando_expedicao").length,
  };

  const scopeLabel = useMemo(() => {
    if (scope.mode === "all") return "Todo o período";
    if (scope.mode === "day") return scope.date;
    return `${scope.startDate} → ${scope.endDate}`;
  }, [scope]);

  const allExpanded =
    pagination.items.length > 0 && pagination.items.every((item) => expandedOrderIds.includes(item.id));

  function toggleExpand(orderId: string) {
    setExpandedOrderIds((current) =>
      current.includes(orderId) ? current.filter((item) => item !== orderId) : [...current, orderId],
    );
  }

  function toggleExpandAll() {
    if (allExpanded) {
      setExpandedOrderIds((current) => current.filter((item) => !pagination.items.some((row) => row.id === item)));
      return;
    }

    setExpandedOrderIds((current) => [
      ...new Set([...current, ...pagination.items.map((item) => item.id)]),
    ]);
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setStoreFilter("all");
    setDeliveryFilter("all");
    setPage(1);
  }

  function openOrderItemsModal(orderId: string, view: "aggregated" | "original") {
    setDetailModal({ orderId, view });
  }

  async function handleCancelOrder(order: OrderSummaryRow) {
    if (order.releasedToProduction) {
      toast.warning("Pedidos já liberados para produção precisam ser tratados pelo fluxo operacional, não por cancelamento.");
      return;
    }

    const confirmed = await confirm({
      title: `Cancelar o pedido ${order.code} da loja ${order.storeName}?`,
      description: "Ele sairá da fila operacional até ser reaberto.",
      tone: "destructive",
      confirmLabel: "Cancelar pedido",
      cancelLabel: "Voltar",
    });

    if (confirmed) {
      void cancelOrder(order.id);
    }
  }

  async function handleReleaseOrder(order: OrderSummaryRow) {
    await performReleaseOrderWithConfirm(order, releaseOrder, confirm, toast);
  }

  // AJ-A6: libera em batelada todos os pedidos elegíveis num clique. Aplica a
  // mesma trava server-side do A1 (sem force) — pedidos bloqueados aparecem
  // como falhas no resumo, sem interromper o batch.
  async function handleAutoReleaseEligible() {
    if (isAutoReleasing) return;

    const eligibleCount = summaryRows.filter(
      (order) =>
        !order.releasedToProduction && order.status !== "cancelado" && order.availableForRelease,
    ).length;

    if (eligibleCount === 0) {
      toast.info("Nenhum pedido elegível para auto-liberação na janela atual.");
      return;
    }

    const confirmed = await confirm({
      title: `Auto-liberar ${eligibleCount} pedido(s) elegível(eis)?`,
      description:
        "Pedidos que passem na validação serão liberados de uma vez. Pedidos bloqueados (capacidade / MPI / janela) ficam de fora e podem ser tratados manualmente.",
      confirmLabel: "Auto-liberar",
      cancelLabel: "Voltar",
    });

    if (!confirmed) return;

    setIsAutoReleasing(true);
    try {
      const response = await fetch("/api/factory-planning/auto-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceDate: anchorDate }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Falha na auto-liberação");
      }
      const result = (await response.json()) as {
        released: Array<{ orderCode: string }>;
        skipped: Array<{ orderCode: string; reason: string }>;
        failed: Array<{ orderCode: string; error: string }>;
      };
      await refresh();

      const parts: string[] = [];
      if (result.released.length > 0) parts.push(`${result.released.length} liberado(s)`);
      if (result.failed.length > 0) parts.push(`${result.failed.length} bloqueado(s)`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} pulado(s)`);

      const summary = parts.join(" · ");
      if (result.released.length > 0 && result.failed.length === 0) {
        toast.success(`Auto-liberação concluída: ${summary || "nada a fazer"}.`);
      } else if (result.failed.length > 0) {
        toast.warning(`Auto-liberação parcial: ${summary}. Trate os bloqueios manualmente.`);
      } else {
        toast.info(`Auto-liberação sem ação: ${summary || "nada elegível"}.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na auto-liberação.");
    } finally {
      setIsAutoReleasing(false);
    }
  }

  async function handleReopenOrder(order: OrderSummaryRow) {
    const confirmed = await confirm({
      title: `Reabrir o pedido ${order.code}?`,
      description: "Ele volta a poder ser liberado para produção.",
      tone: "default",
      confirmLabel: "Reabrir",
      cancelLabel: "Voltar",
    });

    if (confirmed) {
      void reopenOrder(order.id);
    }
  }

  return (
    <PageLayout
      title="Pedidos"
      description="Audite o pedido, expanda os itens inline e libere para produção somente quando estiver pronto."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Pedidos" },
      ]}
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {/* AJ-A6: libera todos os pedidos elegíveis num clique. Aplica a mesma
              trava do A1 — os bloqueados aparecem como falhas no resumo. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleAutoReleaseEligible()}
            disabled={isAutoReleasing}
          >
            <Zap className="size-4" />
            {isAutoReleasing ? "Liberando..." : "Auto-liberar elegíveis"}
          </Button>
          {/* Linha-stats minúscula (KPIs secundários). */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground/80">
            <span>
              <span className="font-medium text-foreground/80">{kpis.total}</span> no período
            </span>
            <span aria-hidden className="text-muted-foreground/40">·</span>
            <span>
              <span className="font-medium text-foreground/80">{kpis.liberados}</span> liberados
            </span>
          </div>
        </div>
      </div>

      {/* KPIs reduzidos 4 → 3 (cortado "Pedidos" — redundante com 'X de Y' abaixo). */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard title="Liberados" value={kpis.liberados} icon={ListChecks} tone="info" compactValue />
        <KPICard title="Em Produção" value={kpis.emProducao} icon={Factory} tone="warning" compactValue />
        <KPICard title="Prontos p/ Expedição" value={kpis.aguardandoExpedicao} icon={Truck} tone="success" compactValue />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle>Pedidos Auditáveis</CardTitle>
                <InfoHint
                  size="sm"
                  content={
                    <div className="space-y-2 text-muted-foreground">
                      <p className="font-semibold text-foreground">Como funciona agora</p>
                      <ol className="list-decimal space-y-1 pl-4">
                        <li>Audite o pedido e expanda apenas o resumo operacional da linha.</li>
                        <li>Use “Liberar para produção” para gerar as OPs consolidadas.</li>
                        <li>
                          O status do pedido sobe automaticamente a partir do avanço dos produtos da OP.
                        </li>
                      </ol>
                    </div>
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredOrders.length} de {summaryRows.length} pedidos visíveis
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={toggleExpandAll}>
              {allExpanded ? "Recolher todos" : "Expandir resumos"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <OperationFiltersCard
            title="Filtros dos Pedidos"
            summary={`${filteredOrders.length} de ${summaryRows.length} pedidos visíveis`}
            helperText="Filtre por pedido, loja, data de entrega ou status."
            searchLabel="Busca"
            searchPlaceholder="Buscar por pedido ou loja..."
            searchValue={searchTerm}
            onSearch={(value) => {
              setSearchTerm(value);
              setPage(1);
            }}
            fields={[
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: (value) => {
                  setStatusFilter(value);
                  setPage(1);
                },
                options: [
                  { value: "em_espera", label: "Em Espera" },
                  { value: "agendado", label: "Agendado" },
                  { value: "em_producao", label: "Em Produção" },
                  { value: "aguardando_expedicao", label: "Aguardando Expedição" },
                  { value: "cancelado", label: "Cancelado" },
                ],
              },
              {
                key: "store",
                label: "Loja",
                value: storeFilter,
                onChange: (value) => {
                  setStoreFilter(value);
                  setPage(1);
                },
                options: storeOptions,
              },
              {
                key: "delivery",
                label: "Recebimento",
                value: deliveryFilter,
                onChange: (value) => {
                  setDeliveryFilter(value);
                  setPage(1);
                },
                options: deliveryOptions,
              },
            ]}
            activeFiltersCount={[
              searchTerm.trim().length > 0 ? 1 : 0,
              statusFilter !== "all" ? 1 : 0,
              storeFilter !== "all" ? 1 : 0,
              deliveryFilter !== "all" ? 1 : 0,
            ].reduce((sum, item) => sum + item, 0)}
            onClear={clearFilters}
          />

          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[800px] border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Pedido</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Loja</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Entrega prevista</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="w-px whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pagination.items.map((order) => {
                  const items = orderItemsByOrderId.get(order.id) ?? [];
                  const aggregatedItems = aggregateOrderItems(items);
                  const isExpanded = expandedOrderIds.includes(order.id);
                  return (
                    <Fragment key={order.id}>
                      <tr className="hover:bg-panel/30">
                        <td className="min-w-[170px] align-top border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <button
                            type="button"
                            className="inline-flex items-start gap-2 text-left font-medium text-foreground"
                            onClick={() => toggleExpand(order.id)}
                          >
                            {isExpanded ? <ArrowDown className="size-4" /> : <ArrowRight className="size-4" />}
                            <span className="whitespace-nowrap font-mono">{order.code}</span>
                          </button>
                        </td>
                        <td className="min-w-[210px] align-top border-t border-border/70 bg-card px-4 py-3 text-sm">{order.storeName}</td>
                        <td className="min-w-[160px] align-top border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <span className="inline-flex whitespace-nowrap rounded-md bg-warning/25 px-2 py-1 text-xs font-semibold text-warning-foreground">
                            {order.deliveryDateLabel}
                          </span>
                          <p className="mt-1 text-[11px] text-muted-foreground">{order.dPlusLabel}</p>
                        </td>
                        <td className="min-w-[190px] align-top border-t border-border/70 bg-card px-4 py-3 text-sm">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="min-w-[360px] align-top border-t border-border/70 bg-card px-4 py-3 text-right">
                          <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                            <Button asChild type="button" variant="outline" size="sm">
                              <Link href={`/gestor-fabrica/pedidos/${order.id}?ref=${anchorDate}`}>Detalhe</Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openPrintPage(`/impressao/pedido-loja/${order.id}?ref=${anchorDate}`)}
                            >
                              Folha Loja
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              // Não desabilitamos mais por availableForRelease: o servidor é a
                              // fonte da verdade e o gestor decide se quer forçar a liberação.
                              disabled={order.releasedToProduction || order.status === "cancelado"}
                              onClick={() => void handleReleaseOrder(order)}
                            >
                              {order.releasedToProduction ? "Liberado" : "Liberar para produção"}
                            </Button>
                            {order.status === "cancelado" ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => handleReopenOrder(order)}>
                                Reabrir
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={order.releasedToProduction}
                                onClick={() => handleCancelOrder(order)}
                              >
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`${order.id}-expanded`}>
                          <td colSpan={8} className="border-t border-border/70 bg-panel/10 px-4 py-4">
                            <div className="grid gap-4 rounded-2xl border border-border/70 bg-card/80 p-4 xl:grid-cols-[1.4fr_0.9fr]">
                              <div className="space-y-3">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    Resumo operacional do pedido
                                  </p>
                                  <InfoHint
                                    size="xs"
                                    content="Abra os itens em modal para revisar com calma sem poluir a grade principal."
                                  />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-full border border-border/70 bg-panel px-2.5 py-1 text-[11px] font-semibold text-foreground">
                                    {items.length} itens originais
                                  </span>
                                  <span className="rounded-full border border-info/30 bg-info/10 px-2.5 py-1 text-[11px] font-semibold text-info-foreground">
                                    {aggregatedItems.length} itens consolidados
                                  </span>
                                  <span className="rounded-full border border-border/70 bg-panel px-2.5 py-1 text-[11px] font-semibold text-foreground">
                                    {formatKgLabel(order.totalKg)} totais
                                  </span>
                                </div>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="justify-between"
                                  onClick={() => openOrderItemsModal(order.id, "aggregated")}
                                >
                                  <span>Itens consolidados</span>
                                  <span className="text-xs text-muted-foreground">{aggregatedItems.length}</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="justify-between"
                                  onClick={() => openOrderItemsModal(order.id, "original")}
                                >
                                  <span>Itens originais</span>
                                  <span className="text-xs text-muted-foreground">{items.length}</span>
                                </Button>
                                <Button asChild type="button" variant="default" className="justify-between sm:col-span-2 xl:col-span-1">
                                  <Link href={`/gestor-fabrica/pedidos/${order.id}?ref=${anchorDate}`}>
                                    <span>Auditar pedido completo</span>
                                    <ArrowRight className="size-4" />
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            label="pedidos"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            sortOrder={sortOrder}
            onSortOrderChange={(nextSortOrder) => {
              setSortOrder(nextSortOrder);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Navegação operacional — fluxo entre páginas irmãs (fica no rodapé,
          fora da primeira dobra, como "para onde ir depois"). */}
      <FactoryFlow
        currentKey="pedidos"
        steps={flowSteps}
        subtitle="Fluxo correto: pedido auditado -> liberar para produção -> acompanhar progresso por item -> expedir."
      />

      <Dialog
        open={detailModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailModal(null);
          }
        }}
      >
        <DialogContent size="3xl" className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {detailModal?.view === "aggregated" ? "Itens consolidados" : "Itens originais"}
              {selectedModalOrder ? ` · ${selectedModalOrder.code}` : ""}
            </DialogTitle>
            <DialogDescription>
              {detailModal?.view === "aggregated"
                ? "Visão consolidada que a fábrica usa para gerar OPs e carga operacional."
                : "Visão original do que a loja pediu antes da consolidação operacional."}
            </DialogDescription>
          </DialogHeader>

          {selectedModalOrder ? (
            <div className="grid gap-3 rounded-xl border border-border/70 bg-panel/20 p-4 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Pedido</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{selectedModalOrder.code}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Loja</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{selectedModalOrder.storeName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Recebimento</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{selectedModalOrder.deliveryDateLabel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
                <div className="mt-1">
                  <StatusBadge status={selectedModalOrder.status} />
                </div>
              </div>
            </div>
          ) : null}

          {detailModal?.view === "aggregated" ? (
            <PaginatedSection
              items={selectedModalAggregatedItems}
              label="itens consolidados"
              initialPageSize={8}
              temporalSortKeys={["deliveryDate", "productionDate", "saleDate"]}
            >
              {(paginatedItems) => (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[860px] border-collapse">
                    <thead className="bg-panel">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Origens</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Qtd Loja</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Kg Interno</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Produção</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Recebimento</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Venda</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">OP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item) => (
                        <tr key={item.aggregationKey}>
                          <td className="min-w-[220px] border-t border-border/70 bg-card px-3 py-3 text-sm">
                            <div className="font-medium text-foreground">
                              {item.productCode} · {item.productName}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.scheduleName}</div>
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {item.sourceItemsCount} itens
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {item.requestedQuantity} {item.requestedUnit}
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">{formatKgValue(item.internalKg)}</td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {item.productionDate ? formatDateKeyBr(item.productionDate) : "Sem agenda"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {formatDateKeyBr(item.deliveryDate)}
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {formatDateKeyBr(item.saleDate)}
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {item.opCode ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PaginatedSection>
          ) : (
            <PaginatedSection
              items={selectedModalItems}
              label="itens originais"
              initialPageSize={8}
              temporalSortKeys={["deliveryDate", "productionDate", "saleDate"]}
            >
              {(paginatedItems) => (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[860px] border-collapse">
                    <thead className="bg-panel">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Qtd Loja</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Kg Interno</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Produção</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Recebimento</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Venda</th>
                        <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item) => (
                        <tr key={item.id}>
                          <td className="min-w-[220px] border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {item.productCode} · {item.productName}
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {item.requestedQuantity} {item.requestedUnit}
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">{formatKgValue(item.internalKg)}</td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {item.productionDate ? formatDateKeyBr(item.productionDate) : "Sem agenda"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {formatDateKeyBr(item.deliveryDate)}
                          </td>
                          <td className="whitespace-nowrap border-t border-border/70 bg-card px-3 py-3 text-sm">
                            {formatDateKeyBr(item.saleDate)}
                          </td>
                          <td className="min-w-[180px] border-t border-border/70 bg-card px-3 py-3 text-sm">
                            <StatusBadge status={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PaginatedSection>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
