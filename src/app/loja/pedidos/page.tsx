"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, Package, Plus, ShoppingCart, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/shared/info-hint";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { OperationalSequenceCard } from "@/components/shared/operational-sequence-card";
import { OperationalDateScopeCard } from "@/components/shared/operational-date-scope-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { SearchableSelect } from "@/components/shared/searchable-select";
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
import { summarizeOperationalDates } from "@/lib/operational-sequence";
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
import { useCreateStoreOrder, useStoreOrderCatalog, useStoreOrderDetail, useStoreOrderSummaries, useUpdateStoreOrder } from "@/lib/use-store-orders";

type EditableDayField = "sex" | "sab" | "dom" | "seg" | "ter" | "qua" | "qui";
type SelectedOrderItemSummary = {
  productId: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  unit: StoreOrderCatalogProduct["unit"];
  unitKind: StoreOrderCatalogProduct["unitKind"];
  productionDate: string | null;
  deliveryDate: string;
  saleDate: string;
};

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

function buildOrderPrintPath(orderId: string, referenceDate: string) {
  return `/impressao/pedido-loja/${orderId}?ref=${referenceDate}`;
}

function buildOrderDetailPath(orderId: string, referenceDate: string) {
  return `/loja/pedidos/${orderId}?ref=${referenceDate}`;
}

function formatRequestedQuantity(quantity: number, unitKind: StoreOrderCatalogProduct["unitKind"]) {
  if (unitKind === "discrete") {
    return String(Math.round(quantity));
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(quantity);
}

export default function PedidosLojaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useCurrentProfile();
  const { snapshot } = useMasterDataSnapshot();
  const { scope, anchorDate, summary, setMode, setDate, setStartDate, setEndDate } = useOperationalDateScope();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isOrderConfirmationOpen, setIsOrderConfirmationOpen] = useState(false);
  const [orderProducts, setOrderProducts] = useState<StoreOrderCatalogProduct[]>([]);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [orderNote, setOrderNote] = useState("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [hideUnavailable, setHideUnavailable] = useState(false);

  const referenceDate = useMemo(() => new Date(), []);
  const orderedAtIso = useMemo(() => referenceDate.toISOString(), [referenceDate]);
  const { orders: storeOrderSummaries, isLoading: isLoadingOrders, refresh: refreshStoreOrders } = useStoreOrderSummaries(anchorDate);
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
  const { createOrder, isSubmitting: isCreating } = useCreateStoreOrder(() => {
    void refreshStoreOrders();
    setIsNewOrderOpen(false);
    setEditingOrderId(null);
    setOrderNote("");
  });
  const { updateOrder, isSubmitting: isUpdating } = useUpdateStoreOrder(() => {
    void refreshStoreOrders();
    setIsNewOrderOpen(false);
    setEditingOrderId(null);
    setOrderNote("");
  });
  const isSubmitting = isCreating || isUpdating;
  const { order: editingOrderDetail, isLoading: isLoadingEditOrder } = useStoreOrderDetail(editingOrderId ?? "", anchorDate);
  const isEditOrderLoading = Boolean(editingOrderId) && isLoadingEditOrder;

  useEffect(() => {
    setOrderProducts(catalog);
  }, [catalog]);

  // Open edit dialog when redirected from detail page with ?editOrder=id
  useEffect(() => {
    const editOrderParam = searchParams.get("editOrder");
    if (editOrderParam && !isNewOrderOpen) {
      setEditingOrderId(editOrderParam);
      setIsNewOrderOpen(true);
      router.replace("/loja/pedidos");
    }
  }, [searchParams, isNewOrderOpen, router]);

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
  const saleDate = useMemo(() => {
    const date = new Date(`${deliveryDateKey}T00:00:00`);
    const leadDays = Math.max(0, snapshot.operationalSettings.saleLeadDays ?? 1);
    date.setDate(date.getDate() + leadDays);
    return date;
  }, [deliveryDateKey, snapshot.operationalSettings.saleLeadDays]);

  const highlightedDay = useMemo(() => getDayFieldByDate(saleDate), [saleDate]);

  // Pre-fill the order grid when opening an existing order for editing
  useEffect(() => {
    if (!editingOrderDetail || !isNewOrderOpen || catalog.length === 0) return;

    setOrderNote(editingOrderDetail.note ?? "");
    setOrderProducts((currentProducts) =>
      currentProducts.map((product) => {
        const existingItem = editingOrderDetail.items.find((item) => item.productId === product.productId);
        if (!existingItem) return product;

        return { ...product, [highlightedDay]: existingItem.quantity };
      }),
    );
  }, [editingOrderDetail, isNewOrderOpen, catalog.length, highlightedDay]);

  const dayColumns = useMemo(() => rotateDays(highlightedDay), [highlightedDay]);
  const deliveryDateLabel = useMemo(() => formatDateWithWeekday(deliveryDate), [deliveryDate]);
  const saleDateLabel = useMemo(() => formatDateWithWeekday(saleDate), [saleDate]);
  const baseOperationalDateLabel = useMemo(
    () => formatDateKeyWithWeekday(effectiveBaseDateKey),
    [effectiveBaseDateKey],
  );
  const orderDateLabel = useMemo(
    () => formatDateKeyWithWeekday(orderCalendarDateKey),
    [orderCalendarDateKey],
  );
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
  const storeOptions = useMemo(
    () =>
      availableStores.map((store) => ({
        value: store.id,
        label: store.name,
      })),
    [availableStores],
  );
  const shouldUseSearchableStoreSelect = availableStores.length >= 8;

  const filteredOrderProducts = useMemo(() => {
    const term = catalogSearchTerm.trim().toLowerCase();

    const matched = orderProducts.filter((item) => {
      const matchesSearch =
        term.length === 0 ||
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });

    const scoped = hideUnavailable ? matched.filter((item) => item.available) : matched;

    // AJ-0005: itens indisponíveis vão para o fim da lista, preservando a
    // ordem original do catálogo dentro de cada grupo (disponível / bloqueado).
    return scoped
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        if (a.item.available !== b.item.available) {
          return a.item.available ? -1 : 1;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.item);
  }, [catalogSearchTerm, categoryFilter, hideUnavailable, orderProducts]);
  const selectedOrderItems = useMemo<SelectedOrderItemSummary[]>(
    () =>
      orderProducts
        .filter((product) => product.available && product[highlightedDay] > 0)
        .map((product) => ({
          productId: product.productId,
          code: product.code,
          name: product.name,
          category: product.category,
          quantity: product[highlightedDay],
          unit: product.unit,
          unitKind: product.unitKind,
          productionDate: product.productionDate,
          deliveryDate: product.deliveryDate,
          saleDate: product.saleDate,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [highlightedDay, orderProducts],
  );
  const selectedProductionSummary = useMemo(
    () =>
      summarizeOperationalDates(
        selectedOrderItems.map((item) => item.productionDate),
        {
          emptyValue: "Escolha os itens abaixo",
          emptyHelper: "Cada produto mostra sua própria data de produção conforme o cronograma ativo.",
          mixedValue: "Varia por item",
        },
      ),
    [selectedOrderItems],
  );
  const selectedSaleSummary = useMemo(
    () =>
      summarizeOperationalDates(
        selectedOrderItems.map((item) => item.saleDate),
        {
          emptyValue: "Escolha os itens abaixo",
          emptyHelper: "A previsão de venda aparece por item depois que a entrega é calculada.",
          mixedValue: "Varia por item",
        },
      ),
    [selectedOrderItems],
  );
  const orderSequenceSteps = useMemo(
    () => [
      {
        key: "ordered",
        label: "Pedido lançado",
        value: orderDateLabel,
        helper: selectedStore
          ? "Este é o dia em que a loja registra a necessidade."
          : "Selecione uma loja para calcular a janela operacional.",
        tone: "neutral" as const,
      },
      {
        key: "base",
        label: "Base operacional",
        value: baseOperationalDateLabel,
        helper:
          effectiveBaseDateKey === orderCalendarDateKey
            ? "A base permaneceu no mesmo dia porque o pedido está dentro da regra operacional."
            : "Depois do cutoff ou fora do dia permitido, a base avança para o próximo dia operacional.",
        tone: "info" as const,
      },
      {
        key: "delivery",
        label: "Receber na loja",
        value: deliveryDateLabel,
        helper: `Prazo global da fábrica: D+${snapshot.operationalSettings.expeditionLeadDays} a partir da base operacional.`,
        tone: "warning" as const,
      },
      {
        key: "sale",
        label: "Vender a partir de",
        value: selectedSaleSummary.value,
        helper:
          selectedOrderItems.length > 0
            ? selectedSaleSummary.helper ??
              "A venda prevista começa depois da entrega, conforme a regra operacional do produto."
            : selectedSaleSummary.helper,
        tone: "success" as const,
      },
    ],
    [
      baseOperationalDateLabel,
      deliveryDateLabel,
      effectiveBaseDateKey,
      orderCalendarDateKey,
      orderDateLabel,
      selectedOrderItems.length,
      selectedSaleSummary.helper,
      selectedSaleSummary.value,
      selectedStore,
      snapshot.operationalSettings.expeditionLeadDays,
    ],
  );
  const availableCatalogCount = useMemo(
    () => orderProducts.filter((item) => item.available).length,
    [orderProducts],
  );
  const blockedCatalogCount = useMemo(
    () => orderProducts.filter((item) => !item.available).length,
    [orderProducts],
  );

  const columns = [
    { key: "code", header: "Código", sortable: true },
    { key: "date", header: "Pedido lançado", sortable: true },
    {
      key: "deliveryDate",
      header: "Recebimento previsto",
      sortable: true,
      sortValue: (item: StoreOrderSummary) => item.deliveryDate,
      render: (item: StoreOrderSummary) => (
        <span className="rounded-md bg-warning/30 px-2 py-1 text-xs font-semibold text-warning-foreground">
          {item.deliveryDate}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (item: StoreOrderSummary) => <StatusBadge status={item.status} />,
    },
    { key: "store", header: "Loja solicitante", sortable: true },
  ];

  function handleOpenEditOrder(order: StoreOrderSummary) {
    setEditingOrderId(order.id);
    setIsNewOrderOpen(true);
  }

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: StoreOrderSummary) => router.push(buildOrderDetailPath(item.id, anchorDate)),
    },
    {
      icon: "edit" as const,
      label: "Editar pedido",
      onClick: (item: StoreOrderSummary) => handleOpenEditOrder(item),
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
      setIsOrderConfirmationOpen(false);
      setEditingOrderId(null);
      setOrderNote("");
      setOrderProducts(catalog);
      clearCatalogFilters();
    }
  }

  function handleOpenOrderConfirmation() {
    if (!selectedStore) {
      return;
    }

    if (selectedOrderItems.length === 0) {
      window.alert("Selecione ao menos um item disponível com quantidade positiva.");
      return;
    }

    // Warn when a filter is active and other categories have zero-quantity items
    if (categoryFilter !== "all" || catalogSearchTerm.trim().length > 0) {
      const filledCategories = new Set(selectedOrderItems.map((item) => item.category));
      const allCategories = new Set(orderProducts.filter((p) => p.available).map((p) => p.category));
      const emptyCategories = [...allCategories].filter((cat) => !filledCategories.has(cat));

      if (emptyCategories.length > 0) {
        const proceed = window.confirm(
          `Você está com filtro ativo. As seguintes categorias não possuem itens no pedido:\n\n• ${emptyCategories.join("\n• ")}\n\nDeseja finalizar assim mesmo?`,
        );

        if (!proceed) {
          return;
        }
      }
    }

    setIsOrderConfirmationOpen(true);
  }

  async function handleConfirmOrderSubmission() {
    if (!selectedStore) {
      return;
    }

    if (selectedOrderItems.length === 0) {
      setIsOrderConfirmationOpen(false);
      window.alert("Selecione ao menos um item disponível com quantidade positiva.");
      return;
    }

    const orderItems = selectedOrderItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unit: item.unit,
    }));

    try {
      if (editingOrderId) {
        await updateOrder(editingOrderId, {
          note: orderNote.trim(),
          items: orderItems,
        });
      } else {
        await createOrder({
          storeId: selectedStore.id,
          note: orderNote.trim(),
          orderedAt: referenceDate.toISOString(),
          items: orderItems,
        });
      }
      setIsOrderConfirmationOpen(false);
      setEditingOrderId(null);
      setOrderProducts(catalog);
      setOrderNote("");
    } catch (submitError) {
      setIsOrderConfirmationOpen(false);
      window.alert(
        submitError instanceof Error
          ? submitError.message
          : editingOrderId ? "Falha ao atualizar pedido." : "Falha ao criar pedido. Tente novamente.",
      );
    }
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
              {shouldUseSearchableStoreSelect ? (
                <SearchableSelect
                  value={selectedStoreId}
                  onValueChange={setSelectedStoreId}
                  options={storeOptions}
                  placeholder="Filtrar por loja"
                  searchPlaceholder="Buscar loja..."
                  emptyMessage="Nenhuma loja encontrada."
                  title="Filtrar por loja"
                  description="Selecione a loja para atualizar a janela operacional e o catálogo."
                  className="w-[260px] bg-background/80"
                />
              ) : (
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
              )}
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
                <DialogTitle>{editingOrderId ? "Editar Pedido" : "Pedido Diário"}</DialogTitle>
                <DialogDescription>Faça seu pedido de produtos</DialogDescription>
              </DialogHeader>

              {isEditOrderLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
                  <p className="text-sm text-muted-foreground">Carregando dados do pedido…</p>
                </div>
              ) : (
              <>
              <div className="space-y-6 py-2">
                {availableStores.length === 0 ? (
                  <div className="rounded-lg border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground">
                    Nenhuma loja ativa está vinculada ao seu perfil. Revise os vínculos de loja antes de criar pedidos.
                  </div>
                ) : null}

                <div className="rounded-lg border border-border/80 bg-panel p-4">
                  <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                    <div className="grid gap-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground">Loja</Label>
                        <InfoHint
                          size="xs"
                          content={
                            <div className="space-y-2 text-xs text-muted-foreground">
                              <p>
                                Dias de pedido: <strong className="text-foreground">{orderingDaysLabel}</strong>. Domingo permitido:{" "}
                                <strong className="text-foreground">
                                  {selectedStore ? (getStoreCanOrderSunday(selectedStore) ? "Sim" : "Não") : "-"}
                                </strong>.
                              </p>
                              <p>
                                Dias de recebimento: <strong className="text-foreground">{receivingDaysLabel}</strong>. Recebe domingo:{" "}
                                <strong className="text-foreground">
                                  {selectedStore ? (getStoreReceivesSunday(selectedStore) ? "Sim" : "Não") : "-"}
                                </strong>.
                              </p>
                            </div>
                          }
                        />
                      </div>
                      {shouldUseSearchableStoreSelect ? (
                        <SearchableSelect
                          value={selectedStore?.id ?? ""}
                          onValueChange={setSelectedStoreId}
                          options={storeOptions}
                          placeholder="Selecione uma loja"
                          searchPlaceholder="Buscar loja..."
                          emptyMessage="Nenhuma loja encontrada."
                          title="Selecionar loja"
                          description="A loja define a janela operacional e as regras de entrega."
                          disabled={availableStores.length === 0}
                        />
                      ) : (
                        <Select
                          value={selectedStore?.id ?? ""}
                          onValueChange={setSelectedStoreId}
                          disabled={availableStores.length === 0}
                        >
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
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Pedido lançado em</Label>
                      <Input value={orderDateLabel} disabled className="bg-muted" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Base operacional</Label>
                      <Input value={baseOperationalDateLabel} disabled className="bg-muted" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Recebimento previsto da loja</Label>
                      <Input
                        value={`${deliveryDateLabel} (D+${snapshot.operationalSettings.expeditionLeadDays})`}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Início das vendas</Label>
                      <Input
                        value={`${saleDateLabel} (D+${snapshot.operationalSettings.expeditionLeadDays + (snapshot.operationalSettings.saleLeadDays ?? 1)})`}
                        disabled
                        className="border-success/40 bg-success/20 font-semibold text-success-foreground"
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
                  <OperationalSequenceCard
                    className="mt-4"
                    eyebrow="Leitura simples do cronograma"
                    title="O sistema liga pedido, entrega e previsão de venda"
                    description="Acompanhe a sequência abaixo para saber quando os produtos chegarão na loja e quando poderão ser vendidos."
                    steps={orderSequenceSteps}
                    footer="Se não existir disponibilidade na janela de entrega, o item fica bloqueado no catálogo."
                  />
                </div>

                <div className="rounded-lg border border-border/80 bg-panel/55 p-3">
                  <div className="grid gap-3 lg:grid-cols-[2fr_1fr_auto]">
                    <div className="grid gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground">Buscar Produto</Label>
                        <InfoHint
                          size="xs"
                          content={
                            <div className="space-y-2 text-xs text-muted-foreground">
                              <p>
                                Coluna ativa do pedido (início das vendas):{" "}
                                <strong className="text-foreground">{WEEK_LABEL[highlightedDay]}</strong> (sempre na primeira posição).
                              </p>
                              <p>
                                A disponibilidade considera o cronograma ativo da linha de produção e os dias
                                de fabricação da ficha do produto.
                              </p>
                            </div>
                          }
                        />
                      </div>
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
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className="text-xs text-muted-foreground">
                      {filteredOrderProducts.length} de {orderProducts.length} itens no catálogo. Elegíveis:{" "}
                      <strong>{availableCatalogCount}</strong>. Bloqueados nesta janela: <strong>{blockedCatalogCount}</strong>.
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={hideUnavailable}
                        onCheckedChange={(checked) => setHideUnavailable(checked === true)}
                      />
                      Ocultar indisponíveis
                    </label>
                  </div>
                </div>

                <PaginatedSection items={filteredOrderProducts} label="itens do catálogo" initialPageSize={8}>
                  {(paginatedProducts) => (
                    <div className="max-h-[640px] overflow-auto rounded-lg border border-border/80">
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
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground">{product.name}</span>
                                    <InfoHint
                                      size="xs"
                                      tone={!product.available ? "danger" : "muted"}
                                      label="Cronograma e calendário do produto"
                                      content={
                                        <div className="space-y-2.5 text-xs">
                                          <p className="text-muted-foreground">
                                            {product.scheduleName}
                                            {product.productionDays.length > 0
                                              ? ` · Produz em ${formatOperationalDays(product.productionDays)}`
                                              : ""}
                                          </p>
                                          <div className="flex flex-wrap gap-1.5 text-[11px]">
                                            <span className="rounded-full border border-border/70 bg-panel/35 px-2 py-1 text-foreground">
                                              Pedido: {orderDateLabel}
                                            </span>
                                            <span className="rounded-full border border-warning/35 bg-warning/10 px-2 py-1 text-warning-foreground">
                                              Entregar: {formatDateKeyWithWeekday(product.deliveryDate)}
                                            </span>
                                            <span className="rounded-full border border-success/35 bg-success/10 px-2 py-1 text-success-foreground">
                                              Vender: {formatDateKeyWithWeekday(product.saleDate)}
                                            </span>
                                          </div>
                                          {!product.available && product.blockedReason ? (
                                            <p className="font-medium text-danger-foreground">
                                              Indisponível: {product.blockedReason}
                                            </p>
                                          ) : null}
                                        </div>
                                      }
                                    />
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-sm">{product.category}</td>
                                <td className="px-2 py-2 text-sm">
                                  <div>{product.unit}</div>
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
                <Button
                  type="button"
                  onClick={handleOpenOrderConfirmation}
                  disabled={isSubmitting || !selectedStore}
                >
                  Revisar Pedido
                </Button>
              </DialogFooter>
              </>
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={isOrderConfirmationOpen} onOpenChange={setIsOrderConfirmationOpen}>
            <DialogContent size="3xl">
              <DialogHeader>
                <DialogTitle>{editingOrderId ? "Confirmar alterações" : "Confirmar pedido"}</DialogTitle>
                <DialogDescription>
                  Revise todos os itens e quantidades antes de enviar o pedido para a operação.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="grid gap-3 rounded-lg border border-border/80 bg-panel/35 p-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Loja</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedStore?.name ?? "Loja não selecionada"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Entrega prevista
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{deliveryDateLabel}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Itens selecionados
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedOrderItems.length} {selectedOrderItems.length === 1 ? "item" : "itens"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/80 bg-card">
                  <div className="flex items-center gap-1.5 border-b border-border/70 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">Resumo do pedido</p>
                    <InfoHint
                      size="sm"
                      content="Confira a lista completa abaixo para evitar divergências antes da confirmação."
                    />
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full min-w-[760px] border-collapse">
                      <thead className="sticky top-0 z-10 bg-secondary/85">
                        <tr>
                          <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">
                            Código
                          </th>
                          <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">
                            Produto
                          </th>
                          <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">
                            Categoria
                          </th>
                          <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em]">
                            Quantidade
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrderItems.map((item) => (
                          <tr key={item.productId} className="border-t border-border/70 align-top">
                            <td className="px-4 py-3 font-mono text-sm text-foreground">{item.code}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium text-foreground">{item.name}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.category}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                              {formatRequestedQuantity(item.quantity, item.unitKind)} {item.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Observacoes
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {orderNote.trim() || "Nenhuma observacao informada."}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOrderConfirmationOpen(false)}
                  disabled={isSubmitting}
                >
                  Voltar e ajustar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirmOrderSubmission()}
                  disabled={isSubmitting || !selectedStore || selectedOrderItems.length === 0}
                >
                  {isSubmitting ? "Salvando..." : editingOrderId ? "Salvar alterações" : "Confirmar pedido"}
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
            isLoading={isLoadingOrders}
            emptyMessage={isLoadingOrders ? "Carregando pedidos…" : "Nenhum pedido encontrado"}
            stickyHeader
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
