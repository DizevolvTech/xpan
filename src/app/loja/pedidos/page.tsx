"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  CalendarRange,
  ChevronRight,
  Clock3,
  Package,
  Pencil,
  Plus,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/layout/page-container";
import { InfoHint } from "@/components/shared/info-hint";
import { DataTable } from "@/components/shared/data-table";
import { OperationalSequenceCard } from "@/components/shared/operational-sequence-card";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchFilter } from "@/components/shared/search-filter";
import { useToast } from "@/components/shared/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
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
import { cn, formatLocaleNumber } from "@/lib/utils";
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

// AJ-0027: teto razoável por célula de pedido — evita números absurdos que
// estouram a largura da célula e "duplicam dígito" visualmente.
const MAX_ORDER_QUANTITY = 99999;

/** Converte o texto digitado (pt-BR: "1.234,5") em número, tolerando formatos mistos. */
function parseQuantityInput(raw: string): number {
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove pontos de milhar
    .replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/**
 * AJ-0027 — célula de quantidade do pedido (só visual).
 * Alinhada à direita, `tabular-nums`, largura maior; ao desfocar formata o milhar
 * em pt-BR; ao focar mostra o valor cru para edição natural. Teto = MAX_ORDER_QUANTITY.
 */
function OrderQuantityCell({
  value,
  unitKind,
  disabled,
  onChange,
}: {
  value: number;
  unitKind: StoreOrderCatalogProduct["unitKind"];
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [rawValue, setRawValue] = useState("");
  const isDiscrete = unitKind === "discrete";

  const formattedValue =
    value > 0
      ? formatLocaleNumber(value, {
          maximumFractionDigits: isDiscrete ? 0 : 3,
        })
      : "";

  return (
    <Input
      type="text"
      inputMode={isDiscrete ? "numeric" : "decimal"}
      className="h-8 min-w-[5.5rem] text-right tabular-nums"
      value={isFocused ? rawValue : formattedValue}
      placeholder="0"
      disabled={disabled}
      onFocus={() => {
        setIsFocused(true);
        setRawValue(value > 0 ? String(value) : "");
      }}
      onChange={(event) => {
        const next = event.target.value;
        setRawValue(next);
        const parsed = Math.min(parseQuantityInput(next), MAX_ORDER_QUANTITY);
        onChange(parsed);
      }}
      onBlur={() => setIsFocused(false)}
    />
  );
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

// AJ-0014: "dias de cobertura" — quantos dias um único pedido cobre, derivado
// da cadência de produção do produto na semana. Ex.: 1x/sem → 7; 3x/sem → ~2;
// 7x/sem → 1. Mínimo 1. Fórmula: round(7 / nº de dias produzidos na semana).
function getCoverageDays(productionDays: ProductionWeekDay[]): number {
  const cadence = productionDays.length;
  if (cadence <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(7 / cadence));
}

// AJ-0016: rótulo curto do quadradinho com a data real (ex.: "SÁB 17").
function formatCoverageColumnLabel(base: Date, offsetDays: number): string {
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  return `${weekday} ${date.getDate()}`;
}

function buildOrderPrintPath(orderId: string, referenceDate: string) {
  return `/impressao/pedido-loja/${orderId}?ref=${referenceDate}`;
}

function buildOrderDetailPath(orderId: string, referenceDate: string) {
  return `/loja/pedidos/${orderId}?ref=${referenceDate}`;
}

// Refino visual local (escopo só desta tela): KPI "flat" — sem borda dura,
// hierarquia por superfície sutil + sombra suave + número protagonista.
// Não altera o KPICard compartilhado (preserva as demais telas).
type FlatKpiTone = "neutral" | "info" | "success" | "warning" | "danger";
const flatKpiToneStyles: Record<FlatKpiTone, { rail: string; icon: string }> = {
  neutral: { rail: "bg-border-strong", icon: "bg-secondary text-secondary-foreground" },
  info: { rail: "bg-info", icon: "bg-info/[var(--opacity-subtle)] text-info" },
  success: { rail: "bg-success", icon: "bg-success/[var(--opacity-subtle)] text-success" },
  warning: { rail: "bg-warning", icon: "bg-warning/[var(--opacity-subtle)] text-warning" },
  danger: { rail: "bg-danger", icon: "bg-danger/[var(--opacity-subtle)] text-danger" },
};

function FlatKpi({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  tone: FlatKpiTone;
}) {
  const styles = flatKpiToneStyles[tone];
  return (
    <article className="group relative flex items-center gap-3.5 overflow-hidden rounded-lg bg-card/60 px-4 py-3.5 transition-colors duration-200 hover:bg-card">
      <span
        className={cn(
          "pointer-events-none absolute inset-y-2.5 left-0 w-[3px] rounded-r-full opacity-70 transition-opacity duration-200 group-hover:opacity-100",
          styles.rail,
        )}
        aria-hidden
      />
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-[1.04]",
          styles.icon,
        )}
        aria-hidden
      >
        <Icon className="size-[1.05rem]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-0.5 font-heading text-[1.45rem] font-bold leading-none tracking-[-0.022em] text-foreground tabular-nums">
          {value}
        </p>
      </div>
    </article>
  );
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
  const toast = useToast();
  const confirm = useConfirm();
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
  // Indisponíveis ocultos por padrão; usuário pode desmarcar para ver tudo.
  const [hideUnavailable, setHideUnavailable] = useState(true);

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
  // AJ-0007: avisa ANTES de digitar se já existe pedido ativo para a mesma
  // loja + mesma data de entrega. O server (store-orders.ts) ainda bloqueia no
  // submit; aqui é só o aviso proativo + atalho para editar o existente.
  const duplicateActiveOrder = useMemo(() => {
    if (editingOrderId || !selectedStoreId) {
      return null;
    }

    return (
      storeOrderSummaries.find(
        (order) =>
          order.storeId === selectedStoreId &&
          order.deliveryDateKey === deliveryDateKey &&
          order.status !== "cancelado",
      ) ?? null
    );
  }, [editingOrderId, selectedStoreId, storeOrderSummaries, deliveryDateKey]);
  // Pedido em andamento na loja ativa: status entre lançamento e entrega
  // (exclui cancelado/entregue/tentativa_falha). Usado para esconder o botão
  // "Novo Pedido" — ajustes vão pelo fluxo "Editar pedido". Se houver mais de
  // um (raro), pega o de entrega mais próxima.
  const activeOrderInScope = useMemo(() => {
    if (!selectedStoreId) {
      return null;
    }
    const inProgressStatuses = new Set([
      "em_espera",
      "agendado",
      "em_producao",
      "aguardando_expedicao",
      "pronto_coleta",
      "em_rota",
      "no_destino",
    ]);
    return (
      storeOrderSummaries
        .filter(
          (order) => order.storeId === selectedStoreId && inProgressStatuses.has(order.status),
        )
        .sort((a, b) => a.deliveryDateKey.localeCompare(b.deliveryDateKey))[0] ?? null
    );
  }, [selectedStoreId, storeOrderSummaries]);
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
    // Auditoria visível: "Total" removido por ser redundante com a tabela logo abaixo.
    () => ({
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

    const numericValue = Number.isFinite(value) && value > 0 ? Math.min(value, MAX_ORDER_QUANTITY) : 0;
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

  async function handleOpenOrderConfirmation() {
    if (!selectedStore) {
      return;
    }

    if (selectedOrderItems.length === 0) {
      toast.warning("Selecione ao menos um item disponível com quantidade positiva.");
      return;
    }

    // Warn when a filter is active and other categories have zero-quantity items
    if (categoryFilter !== "all" || catalogSearchTerm.trim().length > 0) {
      const filledCategories = new Set(selectedOrderItems.map((item) => item.category));
      const allCategories = new Set(orderProducts.filter((p) => p.available).map((p) => p.category));
      const emptyCategories = [...allCategories].filter((cat) => !filledCategories.has(cat));

      if (emptyCategories.length > 0) {
        const proceed = await confirm({
          title: "Filtro ativo",
          description: `As seguintes categorias não possuem itens no pedido:\n\n• ${emptyCategories.join("\n• ")}\n\nDeseja finalizar assim mesmo?`,
          tone: "default",
          confirmLabel: "Finalizar assim mesmo",
          cancelLabel: "Voltar e revisar",
        });

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
      toast.warning("Selecione ao menos um item disponível com quantidade positiva.");
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
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : editingOrderId ? "Falha ao atualizar pedido." : "Falha ao criar pedido. Tente novamente.",
      );
    }
  }

  return (
    <PageContainer>
      {/* Cabeçalho enxuto (refino local): título forte + breadcrumb + badge LOJA
          + ação primária, sem o hero-box pesado. PageHero/PageLayout não são
          tocados — outras telas seguem usando o shared. */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col gap-4 border-b border-border/[var(--opacity-divider)] pb-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/loja" className="transition hover:text-foreground">
              Loja
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-foreground/80">Pedidos</span>
          </nav>
          <div className="mt-2.5 flex items-center gap-2.5">
            <h1 className="font-heading text-balance text-[1.6rem] font-bold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[1.85rem]">
              Meus Pedidos
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/[var(--opacity-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
              <span className="size-1.5 rounded-full bg-accent" />
              Loja
            </span>
            <InfoHint content="Gerencie seus pedidos" size="md" />
          </div>
        </div>

        <Dialog open={isNewOrderOpen} onOpenChange={handleNewOrderDialogChange}>
          {activeOrderInScope ? (
            // Pedido em andamento existe: esconde "Novo Pedido" e oferece "Editar".
            // Ajustes (incluir/remover itens) acontecem no fluxo de edição.
            <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-xs text-muted-foreground">
                Pedido em andamento:{" "}
                <strong className="font-semibold text-foreground">
                  {activeOrderInScope.code}
                </strong>
              </p>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => handleOpenEditOrder(activeOrderInScope)}
              >
                <Pencil className="size-4" />
                Editar pedido
              </Button>
            </div>
          ) : (
            <DialogTrigger asChild>
              <Button type="button" className="shrink-0">
                <Plus className="size-4" />
                Novo Pedido
              </Button>
            </DialogTrigger>
          )}
          <DialogContent size="3xl">
            <DialogHeader>
              <DialogTitle>{editingOrderId ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
            </DialogHeader>

            {isEditOrderLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground" />
                <p className="text-sm text-muted-foreground">Carregando dados do pedido…</p>
              </div>
            ) : (
            <>
            <div className="space-y-4 py-2">
              {availableStores.length === 0 ? (
                <div className="rounded-lg border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground">
                  Nenhuma loja ativa está vinculada ao seu perfil. Revise os vínculos de loja antes de criar pedidos.
                </div>
              ) : null}

              {duplicateActiveOrder ? (
                <div className="flex flex-col gap-3 rounded-lg border border-danger/45 bg-danger/15 px-4 py-3 text-sm text-danger-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Já existe um pedido ativo (
                    <strong className="font-semibold">{duplicateActiveOrder.code}</strong>) para{" "}
                    <strong className="font-semibold">{selectedStore?.name}</strong> na entrega de{" "}
                    <strong className="font-semibold">{deliveryDateLabel}</strong>. Para não duplicar,
                    edite o pedido existente.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setEditingOrderId(duplicateActiveOrder.id)}
                  >
                    Abrir pedido existente
                  </Button>
                </div>
              ) : null}

              {/* Header de 1 linha (auditoria visível, P5): substitui o painel
                  de 7 inputs disabled + OperationalSequenceCard. Loja editável,
                  datas como texto, regra/cronograma atrás de "Como funciona". */}
              <div className="rounded-lg bg-panel/55 px-3.5 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex min-w-[220px] items-center gap-2">
                      <Label className="text-xs font-medium text-muted-foreground">Pedido para</Label>
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
                          className="h-9 min-w-[200px] bg-background/80"
                        />
                      ) : (
                        <Select
                          value={selectedStore?.id ?? ""}
                          onValueChange={setSelectedStoreId}
                          disabled={availableStores.length === 0}
                        >
                          <SelectTrigger className="h-9 min-w-[200px] bg-background/80">
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

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                      <span className="text-muted-foreground/80">·</span>
                      <span className="text-foreground">
                        entrega{" "}
                        <strong className="font-semibold tabular-nums">{deliveryDateLabel}</strong>{" "}
                        <span className="text-muted-foreground">(D+{snapshot.operationalSettings.expeditionLeadDays})</span>
                      </span>
                      <span className="text-muted-foreground/80">·</span>
                      <span className="text-success-foreground">
                        venda{" "}
                        <strong className="font-semibold tabular-nums">{saleDateLabel}</strong>
                      </span>
                      <span className="text-muted-foreground/80">·</span>
                      <span className="text-foreground">
                        prazo{" "}
                        <strong className="font-semibold tabular-nums">
                          {snapshot.operationalSettings.orderCutoffTime}
                        </strong>
                      </span>

                      {/* Chips de ajuste (cutoff / janela) — só quando aplicáveis */}
                      {cutoffAppliedMessage ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/[var(--opacity-subtle)] px-2 py-0.5 text-[11px] font-medium text-warning">
                          <AlertTriangle className="size-3" aria-hidden />
                          cutoff aplicado
                          <InfoHint
                            size="xs"
                            tone="warning"
                            content={<p className="text-xs text-muted-foreground">{cutoffAppliedMessage}</p>}
                          />
                        </span>
                      ) : null}
                      {orderingWindowAdjustmentMessage ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-info/[var(--opacity-subtle)] px-2 py-0.5 text-[11px] font-medium text-info">
                          janela ajustada
                          <InfoHint
                            size="xs"
                            tone="info"
                            content={<p className="text-xs text-muted-foreground">{orderingWindowAdjustmentMessage}</p>}
                          />
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* "Como funciona" — abre OperationalSequenceCard + regras da
                      loja em popover. Usuário novo abre; veterano não vê. */}
                  <InfoHint
                    size="sm"
                    label="Como funciona o pedido"
                    align="end"
                    side="bottom"
                    contentClassName="w-[600px] max-w-[calc(100vw-2rem)]"
                    content={
                      <div className="space-y-3 text-xs">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Janela operacional
                          </p>
                          <p className="mt-1 text-foreground">
                            Base operacional:{" "}
                            <strong className="font-semibold">{baseOperationalDateLabel}</strong>
                          </p>
                          <p className="text-foreground">
                            Janela de recebimento:{" "}
                            <strong className="font-semibold">
                              {selectedStore?.receiveWindow ?? "—"}
                            </strong>
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Regras da loja
                          </p>
                          <p className="mt-1 text-foreground">
                            Dias de pedido:{" "}
                            <strong className="font-semibold">{orderingDaysLabel}</strong> · Domingo:{" "}
                            <strong className="font-semibold">
                              {selectedStore ? (getStoreCanOrderSunday(selectedStore) ? "Sim" : "Não") : "—"}
                            </strong>
                          </p>
                          <p className="text-foreground">
                            Dias de recebimento:{" "}
                            <strong className="font-semibold">{receivingDaysLabel}</strong> · Domingo:{" "}
                            <strong className="font-semibold">
                              {selectedStore ? (getStoreReceivesSunday(selectedStore) ? "Sim" : "Não") : "—"}
                            </strong>
                          </p>
                        </div>
                        <OperationalSequenceCard
                          eyebrow="Sequência operacional"
                          title="Pedido → entrega → venda"
                          description="O sistema calcula automaticamente as datas conforme as regras da loja e o cronograma de produção."
                          steps={orderSequenceSteps}
                          footer="Se não houver produção na janela de entrega, o item fica bloqueado no catálogo."
                          className="!mt-0"
                        />
                      </div>
                    }
                  />
                </div>
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
                            <p>
                              <strong className="text-foreground">Dias de cobertura:</strong> os
                              quadradinhos verdes indicam quantos dias este pedido cobre, conforme a
                              cadência de produção do produto (produz 1x/semana → cobre ~7 dias;
                              3x/semana → ~2; todo dia → 1). Cada coluna mostra a data real.
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
                  // Tabela enxuta (auditoria visível): 13 col → 10 col.
                  // Código vira linha sub do Produto; Categoria já é filtro.
                  <div className="max-h-[640px] overflow-auto rounded-lg border border-border/80">
                    <table className="w-full min-w-[840px] border-collapse border-spacing-0">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-secondary/85">
                          <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">Produto</th>
                          <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">Un.</th>
                          {dayColumns.map((dayField, index) => (
                            <th
                              key={dayField}
                              className={cn(
                                "px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em]",
                                index === 0 && "bg-success/40",
                              )}
                            >
                              {formatCoverageColumnLabel(saleDate, index)}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em]">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrderProducts.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
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
                              <td className="px-3 py-2 text-sm">
                                <div className="flex items-start gap-1.5">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate font-medium text-foreground">{product.name}</span>
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
                                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                      <span className="font-mono">{product.code}</span>
                                      <span className="opacity-50">·</span>
                                      <span className="truncate">{product.category}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-sm">
                                <div>{product.unit}</div>
                              </td>
                              {(() => {
                                const coverageDays = getCoverageDays(product.productionDays);
                                return dayColumns.map((dayField, index) => {
                                const isActiveColumn = index === 0;
                                const canEdit = isActiveColumn;
                                const isCovered = product.available && index < coverageDays;

                                return (
                                  <td
                                    key={`${product.id}-${dayField}`}
                                    className={cn(
                                      "px-1 py-1",
                                      isCovered && "bg-success/25",
                                      isActiveColumn && isCovered && "bg-success/40",
                                    )}
                                  >
                                    <OrderQuantityCell
                                      value={product[dayField]}
                                      unitKind={product.unitKind}
                                      disabled={!canEdit || !product.available}
                                      onChange={(next) => handleQuantityChange(product.id, dayField, next)}
                                    />
                                  </td>
                                );
                                });
                              })()}
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
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: "easeOut" }}
        className="mt-6 space-y-7"
      >
        {/* Filtro: barra leve (sem cartão pesado). Mesmos controles e callbacks
            do OperationalDateScopeCard, replicados localmente — o componente
            shared permanece inalterado para as demais telas. */}
        <section
          aria-label="Janela da loja"
          className="flex flex-col gap-x-6 gap-y-4 rounded-xl bg-panel/40 px-4 py-4 sm:px-5 xl:flex-row xl:items-end xl:justify-between"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <CalendarRange className="size-4" />
              Janela da loja
            </div>
            <div className="flex items-center gap-1.5">
              <p className="font-heading text-[1.05rem] font-semibold leading-tight tracking-[-0.012em] text-foreground">
                Filtro temporal global
              </p>
              <InfoHint
                content="Pedidos e catálogo respeitam as lojas autorizadas e o mesmo recorte temporal do restante da operação."
                size="sm"
              />
            </div>
            <p className="text-xs font-medium text-foreground">{summary}</p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {shouldShowStoreSelector ? (
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
                <span className="flex min-h-10 items-center rounded-md bg-card px-3 text-sm text-foreground shadow-[var(--shadow-card)]">
                  {selectedStore.name}
                </span>
              </div>
            ) : null}

            <div className="min-w-[180px] space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Modo</p>
              <Select value={scope.mode} onValueChange={(value) => setMode(value as typeof scope.mode)}>
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
              <div className="min-w-[180px] space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Data</p>
                <Input type="date" value={scope.date} onChange={(event) => setDate(event.target.value)} />
              </div>
            ) : null}

            {scope.mode === "range" ? (
              <>
                <div className="min-w-[180px] space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">De</p>
                  <Input
                    type="date"
                    value={scope.startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="min-w-[180px] space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Até</p>
                  <Input
                    type="date"
                    value={scope.endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </>
            ) : null}
          </div>
        </section>

        {/* KPIs: fita de métricas flat — número protagonista, ícone discreto.
            "Total" removido (redundante com a tabela). 5 → 4. */}
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <FlatKpi title="Agendado" value={orderKpis.agendado} icon={Clock3} tone="warning" />
          <FlatKpi title="Em Produção" value={orderKpis.emProducao} icon={Package} tone="neutral" />
          <FlatKpi title="Entregas" value={orderKpis.entregas} icon={Truck} tone="success" />
          <FlatKpi title="Ocorrências" value={orderKpis.ocorrenciasAbertas} icon={AlertCircle} tone="danger" />
        </div>

        {/* Lista: sem moldura dura. Hierarquia por título + espaço; a tabela
            (responsiva UX-0001, skeleton UX-0003, empty UX-0007) é a protagonista. */}
        <section className="space-y-4">
          <div className="flex flex-col gap-1 border-b border-border/[var(--opacity-divider)] pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-heading text-[1.15rem] font-semibold leading-tight tracking-[-0.012em] text-foreground">
              Lista de Pedidos
            </h2>
          </div>
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
        </section>
      </motion.div>
    </PageContainer>
  );
}
