"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, Package, Plus, ShoppingCart, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchFilter } from "@/components/shared/search-filter";
import { PageLayout } from "@/components/shared/page-layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { filterStoreOrderSummariesByOperationalScope } from "@/lib/operational-date-scope";
import {
  getBaseDateByCutoff,
  getDeliveryDateByStoreRule,
  getOperationalBaseDateByStoreRule,
} from "@/lib/order-planning";
import {
  getStoreCanOrderSunday,
  getStoreReceivesSunday,
  productionWeekDays,
  type ProductionWeekDay,
} from "@/lib/production-planning";
import type { StoreOrderCatalogProduct, StoreOrderSummary } from "@/lib/store-order-types";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useOperationalDateScope } from "@/lib/use-operational-date-scope";
import { useStoreOccurrences } from "@/lib/use-store-occurrences";
import { useStoreScope } from "@/lib/use-store-scope";
import { useCreateStoreOrder, useStoreOrderCatalog, useStoreOrderSummaries } from "@/lib/use-store-orders";

type EditableDayField = "sex" | "sab" | "dom" | "seg" | "ter" | "qua" | "qui";
const WEEK_SEQUENCE: EditableDayField[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const FIELD_BY_JS_DAY_INDEX: EditableDayField[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const WEEK_LABEL: Record<EditableDayField, string> = {
  seg: "SEG",
  ter: "TER",
  qua: "QUA",
  qui: "QUI",
  sex: "SEX",
  sab: "SÁB",
  dom: "DOM",
};
const productionDayLabels = new Map(productionWeekDays.map((day) => [day.key, day.shortLabel]));

function getDayFieldByDate(date: Date): EditableDayField {
  return FIELD_BY_JS_DAY_INDEX[date.getDay()];
}

function rotateDays(startDay: EditableDayField): EditableDayField[] {
  const startIndex = WEEK_SEQUENCE.indexOf(startDay);
  return [...WEEK_SEQUENCE.slice(startIndex), ...WEEK_SEQUENCE.slice(0, startIndex)];
}

function formatDateWithWeekday(date: Date): string {
  const dateLabel = new Intl.DateTimeFormat("pt-BR").format(date);
  const weekdayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  return `${dateLabel} - ${weekdayLabel.charAt(0).toUpperCase()}${weekdayLabel.slice(1)}`;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateKeyWithWeekday(dateKey: string) {
  return formatDateWithWeekday(new Date(`${dateKey}T00:00:00`));
}

function formatOperationalDays(days: ProductionWeekDay[]) {
  return days.map((day) => productionDayLabels.get(day) ?? day).join(" · ");
}

function getMinimumProductionAlert(product: StoreOrderCatalogProduct, quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const totalKg = Number((quantity * product.salesToKgFactor).toFixed(3));
  if (totalKg >= product.minimumProductionKg) {
    return null;
  }

  return `Pedido abaixo do mínimo produtivo: ${totalKg} Kg informados para mínimo de ${product.minimumProductionKg} Kg.`;
}

function buildOrderPrintPath(orderId: string, referenceDate: string) {
  return `/impressao/pedido-loja/${orderId}?ref=${referenceDate}`;
}

function buildOrderDetailPath(orderId: string, referenceDate: string) {
  return `/loja/pedidos/${orderId}?ref=${referenceDate}`;
}

export default function PedidosLojaPage() {
  const router = useRouter();
  const { profile } = useCurrentProfile();
  const { snapshot } = useMasterDataSnapshot();
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [orderProducts, setOrderProducts] = useState<StoreOrderCatalogProduct[]>([]);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [orderNote, setOrderNote] = useState("");

  const referenceDate = useMemo(() => new Date(), []);
  const orderedAtIso = useMemo(() => referenceDate.toISOString(), [referenceDate]);
  const { orders: storeOrderSummaries, refresh: refreshStoreOrders } = useStoreOrderSummaries(anchorDate);
  const activeStores = useMemo(
    () => snapshot.stores.filter((store) => store.status === "ativo"),
    [snapshot.stores],
  );
  const {
    availableStores,
    activeStoreId: selectedStoreId,
    activeStore: selectedStore,
    setActiveStoreId: setSelectedStoreId,
    shouldShowStoreSelector,
  } = useStoreScope(activeStores, profile?.allowedStoreIds);
  const { catalog } = useStoreOrderCatalog(selectedStoreId, orderedAtIso);
  const { occurrences } = useStoreOccurrences(selectedStoreId);
  const { createOrder, isSubmitting } = useCreateStoreOrder(() => {
    void refreshStoreOrders();
    setIsNewOrderOpen(false);
    setOrderNote("");
  });

  useEffect(() => {
    setOrderProducts(catalog);
  }, [catalog]);
  const effectiveBaseDateKey = useMemo(() => {
    return selectedStore
      ? getOperationalBaseDateByStoreRule(orderedAtIso, selectedStore, snapshot.operationalSettings)
      : orderedAtIso.slice(0, 10);
  }, [orderedAtIso, selectedStore, snapshot.operationalSettings]);
  const orderCalendarDateKey = useMemo(() => toDateKey(referenceDate), [referenceDate]);
  const cutoffBaseDateKey = useMemo(
    () => getBaseDateByCutoff(orderedAtIso, snapshot.operationalSettings.orderCutoffTime),
    [orderedAtIso, snapshot.operationalSettings.orderCutoffTime],
  );
  const deliveryDateKey = useMemo(
    () =>
      selectedStore
        ? getDeliveryDateByStoreRule(effectiveBaseDateKey, selectedStore, snapshot.operationalSettings)
        : effectiveBaseDateKey,
    [effectiveBaseDateKey, selectedStore, snapshot.operationalSettings],
  );
  const deliveryDate = useMemo(() => new Date(`${deliveryDateKey}T00:00:00`), [deliveryDateKey]);
  const highlightedDay = useMemo(() => getDayFieldByDate(deliveryDate), [deliveryDate]);
  const dayColumns = useMemo(() => rotateDays(highlightedDay), [highlightedDay]);
  const deliveryDateLabel = useMemo(() => formatDateWithWeekday(deliveryDate), [deliveryDate]);
  const orderingDaysLabel = useMemo(
    () => (selectedStore ? formatOperationalDays(selectedStore.orderingDays) : "-"),
    [selectedStore],
  );
  const receivingDaysLabel = useMemo(
    () => (selectedStore ? formatOperationalDays(selectedStore.receivingDays) : "-"),
    [selectedStore],
  );
  const cutoffAppliedMessage = useMemo(() => {
    if (!selectedStore || cutoffBaseDateKey === orderCalendarDateKey) {
      return null;
    }

    return `Pedido lançado após o cutoff de ${snapshot.operationalSettings.orderCutoffTime}. A base operacional saiu de ${formatDateKeyWithWeekday(orderCalendarDateKey)} para ${formatDateKeyWithWeekday(cutoffBaseDateKey)}.`;
  }, [
    cutoffBaseDateKey,
    orderCalendarDateKey,
    selectedStore,
    snapshot.operationalSettings.orderCutoffTime,
  ]);
  const orderingWindowAdjustmentMessage = useMemo(() => {
    if (!selectedStore || effectiveBaseDateKey === cutoffBaseDateKey) {
      return null;
    }

    return `Como a loja não opera pedidos em ${formatDateKeyWithWeekday(cutoffBaseDateKey)}, a base avançou para ${formatDateKeyWithWeekday(effectiveBaseDateKey)}.`;
  }, [cutoffBaseDateKey, effectiveBaseDateKey, selectedStore]);

  const scopedStoreOrderSummaries = useMemo(
    () =>
      {
        const timeScopedOrders = filterStoreOrderSummariesByOperationalScope(storeOrderSummaries, scope);
        return selectedStoreId
          ? timeScopedOrders.filter((item) => item.storeId === selectedStoreId)
          : timeScopedOrders;
      },
    [scope, selectedStoreId, storeOrderSummaries],
  );

  const filteredPedidos = useMemo(
    () =>
      scopedStoreOrderSummaries.filter(
        (item) =>
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.store.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [scopedStoreOrderSummaries, searchTerm],
  );

  const orderKpis = useMemo(
    () => ({
      total: scopedStoreOrderSummaries.length,
      agendado: scopedStoreOrderSummaries.filter((item) => item.status === "agendado").length,
      emProducao: scopedStoreOrderSummaries.filter((item) => item.status === "em_producao").length,
      entregas: scopedStoreOrderSummaries.filter((item) =>
        [
          "aguardando_expedicao",
          "pronto_coleta",
          "em_rota",
          "no_destino",
          "entregue",
          "tentativa_falha",
        ].includes(item.status),
      ).length,
      ocorrenciasAbertas: occurrences.filter(
        (item) => item.status === "aberta" || item.status === "em_analise",
      ).length,
    }),
    [occurrences, scopedStoreOrderSummaries],
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(orderProducts.map((item) => item.category)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    [orderProducts],
  );

  const filteredOrderProducts = useMemo(() => {
    const term = catalogSearchTerm.trim().toLowerCase();

    return orderProducts.filter((item) => {
      const matchesSearch =
        term.length === 0 ||
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [catalogSearchTerm, categoryFilter, orderProducts]);
  const availableCatalogCount = useMemo(
    () => orderProducts.filter((item) => item.available).length,
    [orderProducts],
  );
  const blockedCatalogCount = useMemo(
    () => orderProducts.filter((item) => !item.available).length,
    [orderProducts],
  );

  const columns = [
    { key: "code", header: "Código" },
    { key: "date", header: "Data" },
    {
      key: "deliveryDate",
      header: "Data Prevista Entrega",
      render: (item: StoreOrderSummary) => (
        <span className="rounded-md bg-warning/30 px-2 py-1 text-xs font-semibold text-warning-foreground">
          {item.deliveryDate}
        </span>
      ),
    },
    { key: "status", header: "Status", render: (item: StoreOrderSummary) => <StatusBadge status={item.status} /> },
    { key: "store", header: "Loja Solicitante" },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: StoreOrderSummary) => router.push(buildOrderDetailPath(item.id, anchorDate)),
    },
    {
      icon: "print" as const,
      label: "Imprimir",
      onClick: (item: StoreOrderSummary) =>
        window.open(buildOrderPrintPath(item.id, anchorDate), "_blank", "noopener,noreferrer"),
    },
  ];

  const handleQuantityChange = (productId: string, field: EditableDayField, value: number) => {
    if (field !== highlightedDay) {
      return;
    }

    const product = orderProducts.find((entry) => entry.id === productId);
    if (!product || !product.available) {
      return;
    }

    const numericValue = Number.isFinite(value) && value > 0 ? value : 0;
    const sanitizedValue =
      product.unitKind === "discrete"
        ? Math.max(0, Math.round(numericValue))
        : Number(numericValue.toFixed(3));

    setOrderProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) {
          return product;
        }

        const nextProduct = { ...product };
        nextProduct[field] = sanitizedValue;
        nextProduct.total = sanitizedValue;
        return nextProduct;
      }),
    );
  };

  function clearCatalogFilters() {
    setCatalogSearchTerm("");
    setCategoryFilter("all");
  }

  function handleNewOrderDialogChange(open: boolean) {
    setIsNewOrderOpen(open);

    if (!open) {
      setOrderNote("");
      setOrderProducts(catalog);
      clearCatalogFilters();
    }
  }

  async function handleSubmitOrder() {
    if (!selectedStore) {
      return;
    }

    const items = orderProducts
      .filter((product) => product.available && product[highlightedDay] > 0)
      .map((product) => ({
        productId: product.productId,
        quantity: product[highlightedDay],
        unit: product.unit,
      }));

    if (items.length === 0) {
      window.alert("Selecione ao menos um item disponível com quantidade positiva.");
      return;
    }

    await createOrder({
      storeId: selectedStore.id,
      note: orderNote.trim(),
      orderedAt: referenceDate.toISOString(),
      items,
    });
    setOrderProducts(catalog);
    setOrderNote("");
  }

  return (
    <PageLayout
      title="Meus Pedidos"
      description="Gerencie seus pedidos"
      badge="Loja"
      breadcrumbs={[{ label: "Loja", href: "/loja" }, { label: "Pedidos" }]}
    >
      <OperationalDateScopeCard
        scope={scope}
        summary={summary}
        setMode={setMode}
        setDate={setDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        title="Janela da loja"
        description="Pedidos e catálogo respeitam as lojas autorizadas e o mesmo recorte temporal do restante da operação."
        extraControls={
          shouldShowStoreSelector ? (
            <div className="min-w-[260px] space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Loja</p>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="w-[260px] bg-background/80">
                  <SelectValue placeholder="Filtrar por loja" />
                </SelectTrigger>
                <SelectContent>
                  {availableStores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : selectedStore ? (
            <div className="min-w-[260px] space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Loja</p>
              <span className="flex min-h-10 items-center rounded-md border border-border/70 bg-panel px-3 text-sm text-foreground">
                {selectedStore.name}
              </span>
            </div>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Total de Pedidos" value={orderKpis.total} icon={ShoppingCart} tone="info" />
        <KPICard title="Agendado" value={orderKpis.agendado} icon={Clock3} tone="warning" />
        <KPICard title="Em Produção" value={orderKpis.emProducao} icon={Package} tone="neutral" />
        <KPICard title="Entregas" value={orderKpis.entregas} icon={Truck} tone="success" />
        <KPICard title="Ocorrências" value={orderKpis.ocorrenciasAbertas} icon={AlertCircle} tone="danger" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Pedidos</CardTitle>
          <Dialog open={isNewOrderOpen} onOpenChange={handleNewOrderDialogChange}>
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="size-4" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent size="full">
              <DialogHeader>
                <DialogTitle>Pedido Diário</DialogTitle>
                <DialogDescription>Faça seu pedido de produtos</DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-2">
                {availableStores.length === 0 ? (
                  <div className="rounded-lg border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground">
                    Nenhuma loja ativa está vinculada ao seu perfil. Revise os vínculos de loja antes de criar pedidos.
                  </div>
                ) : null}

                <div className="rounded-lg border border-border/80 bg-panel p-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Nome da Loja</Label>
                      <Select value={selectedStore?.id ?? ""} onValueChange={setSelectedStoreId} disabled={availableStores.length === 0}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma loja" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Data de Entrega (D+X)</Label>
                      <Input
                        value={`${deliveryDateLabel} (D+${snapshot.operationalSettings.expeditionLeadDays})`}
                        disabled
                        className="border-warning/40 bg-warning/20 font-semibold text-warning-foreground"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Horário Limite Global</Label>
                      <Input value={snapshot.operationalSettings.orderCutoffTime} disabled className="bg-muted" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Janela de Recebimento</Label>
                      <Input value={selectedStore?.receiveWindow ?? "Nenhuma loja disponível"} disabled className="bg-muted" />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <p>
                      Dias de pedido: <strong>{orderingDaysLabel}</strong>. Domingo permitido:{" "}
                      <strong>{selectedStore ? (getStoreCanOrderSunday(selectedStore) ? "Sim" : "Não") : "-"}</strong>.
                    </p>
                    <p>
                      Dias de recebimento: <strong>{receivingDaysLabel}</strong>. Recebe domingo:{" "}
                      <strong>{selectedStore ? (getStoreReceivesSunday(selectedStore) ? "Sim" : "Não") : "-"}</strong>.
                    </p>
                  </div>
                  {cutoffAppliedMessage ? (
                    <div className="mt-3 rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
                      {cutoffAppliedMessage}
                    </div>
                  ) : null}
                  {orderingWindowAdjustmentMessage ? (
                    <div className="mt-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
                      {orderingWindowAdjustmentMessage}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border/80 bg-panel/55 p-3">
                  <div className="grid gap-3 lg:grid-cols-[2fr_1fr_auto]">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Buscar Produto</Label>
                      <Input
                        value={catalogSearchTerm}
                        onChange={(event) => setCatalogSearchTerm(event.target.value)}
                        placeholder="Código, nome ou categoria..."
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Categoria</Label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" onClick={clearCatalogFilters}>
                        Limpar
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {filteredOrderProducts.length} de {orderProducts.length} itens no catálogo. Elegíveis:{" "}
                    <strong>{availableCatalogCount}</strong>. Bloqueados nesta janela: <strong>{blockedCatalogCount}</strong>.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Coluna ativa do pedido: <strong>{WEEK_LABEL[highlightedDay]}</strong> (sempre na primeira posição).
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Disponibilidade considera apenas produtos da sublinha ativa compatíveis com os dias de fabricação da ficha do produto. Avisos de mínimo produtivo não bloqueiam o pedido.
                  </p>
                </div>

                <PaginatedSection items={filteredOrderProducts} label="itens do catálogo" initialPageSize={8}>
                  {(paginatedProducts) => (
                    <div className="max-h-[420px] overflow-auto rounded-lg border border-border/80">
                      <table className="w-full min-w-[1120px] border-collapse border-spacing-0">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-secondary/85">
                            <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">Código</th>
                            <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">Produto</th>
                            <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">Categoria</th>
                            <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">Un.</th>
                            {dayColumns.map((dayField, index) => (
                              <th
                                key={dayField}
                                className={cn(
                                  "px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em]",
                                  index === 0 && "bg-success/40",
                                )}
                              >
                                {WEEK_LABEL[dayField]}
                              </th>
                            ))}
                            <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrderProducts.length === 0 ? (
                            <tr>
                              <td colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">
                                Nenhum produto encontrado para os filtros selecionados.
                              </td>
                            </tr>
                          ) : (
                            paginatedProducts.map((product) => (
                              <tr
                                key={product.id}
                                className={cn(
                                  "border-t border-border/70",
                                  !product.available && "bg-muted/30 text-muted-foreground",
                                )}
                              >
                                <td className="px-2 py-2 font-mono text-sm">{product.code}</td>
                                <td className="px-2 py-2 text-sm">
                                  <div className="font-medium text-foreground">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {product.scheduleName}
                                    {product.productionDays.length > 0
                                      ? ` · Fabrica em ${formatOperationalDays(product.productionDays)}`
                                      : ""}
                                  </div>
                                  {!product.available && product.blockedReason ? (
                                    <div className="mt-1 text-xs font-medium text-danger-foreground">
                                      Indisponível: {product.blockedReason}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-2 py-2 text-sm">{product.category}</td>
                                <td className="px-2 py-2 text-sm">
                                  <div>{product.unit}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Min. {product.minimumProductionKg} Kg
                                  </div>
                                </td>
                                {dayColumns.map((dayField, index) => {
                                  const isActiveColumn = index === 0;
                                  const canEdit = isActiveColumn;

                                  return (
                                    <td
                                      key={`${product.id}-${dayField}`}
                                      className={cn("px-1 py-1", isActiveColumn && "bg-success/25")}
                                    >
                                      <Input
                                        type="number"
                                        className="h-8 w-16 text-center"
                                        min="0"
                                        step={product.unitKind === "discrete" ? "1" : "0.1"}
                                        value={product[dayField]}
                                        onChange={(e) => handleQuantityChange(product.id, dayField, Number(e.target.value))}
                                        disabled={!canEdit || !product.available}
                                      />
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-2 text-sm font-semibold">
                                  {product.available ? (
                                    <div>
                                      {product[highlightedDay]} {product.unit}
                                    </div>
                                  ) : (
                                    <div className="text-xs font-semibold text-danger-foreground">
                                      Bloqueado nesta janela
                                    </div>
                                  )}
                                  {product.available && getMinimumProductionAlert(product, product[highlightedDay]) ? (
                                    <div className="mt-1 text-xs font-normal text-warning-foreground">
                                      {getMinimumProductionAlert(product, product[highlightedDay])}
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </PaginatedSection>

                <div className="grid gap-2">
                  <Label htmlFor="order-note" className="text-xs text-muted-foreground">Observações do Pedido</Label>
                  <Textarea
                    id="order-note"
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    placeholder="Inclua observações operacionais para produção, expedição ou recebimento da loja."
                    className="min-h-[110px]"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleNewOrderDialogChange(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void handleSubmitOrder()} disabled={isSubmitting || !selectedStore}>
                  Fazer Pedido
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código ou loja..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            showFilters={false}
          />
          <DataTable
            data={filteredPedidos}
            columns={columns}
            actions={actions}
            keyField="id"
            onRowClick={(item) => router.push(buildOrderDetailPath(item.id, anchorDate))}
            emptyMessage="Nenhum pedido encontrado"
            stickyHeader
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
