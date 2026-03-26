"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, Package, Plus, ShoppingCart, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn, formatKgLabel } from "@/lib/utils";
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
type SelectedOrderItemSummary = {
  productId: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  unit: StoreOrderCatalogProduct["unit"];
  unitKind: StoreOrderCatalogProduct["unitKind"];
  minimumProductionAlert: string | null;
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

function getMinimumProductionAlert(product: StoreOrderCatalogProduct, quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const totalKg = Number((quantity * product.salesToKgFactor).toFixed(3));
  if (totalKg >= product.minimumProductionKg) {
    return null;
  }

  return `Pedido abaixo do mínimo produtivo: ${formatKgLabel(totalKg)} informados para mínimo de ${formatKgLabel(product.minimumProductionKg)}.`;
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
          minimumProductionAlert: getMinimumProductionAlert(product, product[highlightedDay]),
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
        key: "production",
        label: "Produzir em",
        value: selectedProductionSummary.value,
        helper:
          selectedOrderItems.length > 0
            ? selectedProductionSummary.helper ??
              "A produção sempre precisa caber antes do dia prometido para expedir e entregar."
            : selectedProductionSummary.helper,
        tone: "warning" as const,
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
      selectedProductionSummary.helper,
      selectedProductionSummary.value,
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
      setIsOrderConfirmationOpen(false);
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

    await createOrder({
      storeId: selectedStore.id,
      note: orderNote.trim(),
      orderedAt: referenceDate.toISOString(),
      items: selectedOrderItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
      })),
    });
    setIsOrderConfirmationOpen(false);
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
                  <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Loja</Label>
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
                  <OperationalSequenceCard
                    className="mt-4"
                    eyebrow="Leitura simples do cronograma"
                    title="O sistema sempre liga pedido, produção, entrega e venda"
                    description="Quem lança o pedido não precisa pensar em engenharia de produção: acompanhe só a sequência abaixo."
                    steps={orderSequenceSteps}
                    footer="A produção sempre precisa acontecer até a data prometida para expedir e entregar. Se não existir um dia compatível nessa janela, o item fica bloqueado no catálogo."
                  />
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
                    A disponibilidade considera o cronograma ativo da linha de produção e os dias
                    de fabricação da ficha do produto. Avisos de mínimo produtivo não bloqueiam o pedido.
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
                                      ? ` · Produz em ${formatOperationalDays(product.productionDays)}`
                                      : ""}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                    <span className="rounded-full border border-border/70 bg-panel/35 px-2 py-1 text-foreground">
                                      Pedido: {orderDateLabel}
                                    </span>
                                    <span className="rounded-full border border-info/35 bg-info/10 px-2 py-1 text-info-foreground">
                                      Produzir:{" "}
                                      {product.productionDate
                                        ? formatDateKeyWithWeekday(product.productionDate)
                                        : "sem dia compatível"}
                                    </span>
                                    <span className="rounded-full border border-warning/35 bg-warning/10 px-2 py-1 text-warning-foreground">
                                      Entregar: {formatDateKeyWithWeekday(product.deliveryDate)}
                                    </span>
                                    <span className="rounded-full border border-success/35 bg-success/10 px-2 py-1 text-success-foreground">
                                      Vender: {formatDateKeyWithWeekday(product.saleDate)}
                                    </span>
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
                                    Min. {formatKgLabel(product.minimumProductionKg)}
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
                <Button
                  type="button"
                  onClick={handleOpenOrderConfirmation}
                  disabled={isSubmitting || !selectedStore}
                >
                  Revisar Pedido
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isOrderConfirmationOpen} onOpenChange={setIsOrderConfirmationOpen}>
            <DialogContent size="3xl">
              <DialogHeader>
                <DialogTitle>Confirmar pedido</DialogTitle>
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
                      {selectedOrderItems.length} item{selectedOrderItems.length === 1 ? "" : "ns"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/80 bg-card">
                  <div className="border-b border-border/70 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">Resumo do pedido</p>
                    <p className="text-xs text-muted-foreground">
                      Confira a lista completa abaixo para evitar divergencias antes da confirmacao.
                    </p>
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
                              {item.minimumProductionAlert ? (
                                <div className="mt-1 text-xs text-warning-foreground">
                                  {item.minimumProductionAlert}
                                </div>
                              ) : null}
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
                  {isSubmitting ? "Confirmando..." : "Confirmar pedido"}
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
