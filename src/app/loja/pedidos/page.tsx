"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, Package, Plus, ShoppingCart, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
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
import { cn } from "@/lib/utils";
import {
  getBaseDateByCutoff,
  getDeliveryDateByStoreRule,
  moveToNextAllowedWeekday,
} from "@/lib/order-planning";
import {
  getStoreCanOrderSunday,
  getStoreReceivesSunday,
  productionWeekDays,
  type ProductionWeekDay,
} from "@/lib/production-planning";
import type { StoreOrderCatalogProduct, StoreOrderSummary } from "@/lib/store-order-types";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
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
const PRODUCTION_DAY_BY_FIELD: Record<EditableDayField, ProductionWeekDay> = {
  seg: "segunda",
  ter: "terca",
  qua: "quarta",
  qui: "quinta",
  sex: "sexta",
  sab: "sabado",
  dom: "domingo",
};
const productionDayLabels = new Map(productionWeekDays.map((day) => [day.key, day.shortLabel]));

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

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

function hasProductionDayBetween(days: ProductionWeekDay[], fromDate: Date, toDate: Date): boolean {
  const start = startOfDay(fromDate);
  const end = startOfDay(toDate);

  if (end.getTime() < start.getTime()) {
    return false;
  }

  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const field = getDayFieldByDate(cursor);
    if (days.includes(PRODUCTION_DAY_BY_FIELD[field])) {
      return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return false;
}

function canDeliverOnDate(product: StoreOrderCatalogProduct, baseDate: Date, deliveryDate: Date): boolean {
  return hasProductionDayBetween(product.productionDays, startOfDay(baseDate), startOfDay(deliveryDate));
}

function formatOperationalDays(days: ProductionWeekDay[]) {
  return days.map((day) => productionDayLabels.get(day) ?? day).join(" · ");
}

export default function PedidosLojaPage() {
  const router = useRouter();
  const { snapshot } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [orderProducts, setOrderProducts] = useState<StoreOrderCatalogProduct[]>([]);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  const referenceDate = useMemo(() => new Date(), []);
  const referenceDateKey = useMemo(() => referenceDate.toISOString().slice(0, 10), [referenceDate]);
  const { orders: storeOrderSummaries, refresh: refreshStoreOrders } = useStoreOrderSummaries(referenceDateKey);
  const { catalog } = useStoreOrderCatalog();
  const activeStores = useMemo(
    () => snapshot.stores.filter((store) => store.status === "ativo"),
    [snapshot.stores],
  );
  const { createOrder, isSubmitting } = useCreateStoreOrder(() => {
    void refreshStoreOrders();
    setIsNewOrderOpen(false);
  });

  useEffect(() => {
    const currentStoreStillAvailable = activeStores.some((store) => store.id === selectedStoreId);

    if ((!selectedStoreId || !currentStoreStillAvailable) && activeStores[0]) {
      setSelectedStoreId(activeStores[0].id);
      return;
    }

    if (activeStores.length === 0 && selectedStoreId) {
      setSelectedStoreId("");
    }
  }, [activeStores, selectedStoreId]);

  useEffect(() => {
    setOrderProducts(catalog);
  }, [catalog]);
  const selectedStore = useMemo(
    () => activeStores.find((store) => store.id === selectedStoreId) ?? null,
    [activeStores, selectedStoreId],
  );
  const effectiveBaseDateKey = useMemo(() => {
    const baseDateKey = getBaseDateByCutoff(referenceDate.toISOString(), snapshot.operationalSettings.orderCutoffTime);
    return selectedStore
      ? moveToNextAllowedWeekday(baseDateKey, selectedStore.orderingDays)
      : baseDateKey;
  }, [referenceDate, selectedStore, snapshot.operationalSettings.orderCutoffTime]);
  const deliveryDateKey = useMemo(
    () =>
      selectedStore
        ? getDeliveryDateByStoreRule(effectiveBaseDateKey, selectedStore, snapshot.operationalSettings)
        : effectiveBaseDateKey,
    [effectiveBaseDateKey, selectedStore, snapshot.operationalSettings],
  );
  const baseDate = useMemo(() => new Date(`${effectiveBaseDateKey}T00:00:00`), [effectiveBaseDateKey]);
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
  const productsWithAvailability = useMemo(
    () =>
      orderProducts.map((product) => ({
        ...product,
        available: canDeliverOnDate(product, baseDate, deliveryDate),
      })),
    [baseDate, deliveryDate, orderProducts],
  );

  const filteredPedidos = useMemo(
    () =>
      storeOrderSummaries.filter(
        (item) =>
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.store.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, storeOrderSummaries],
  );

  const orderKpis = useMemo(
    () => ({
      total: storeOrderSummaries.length,
      agendado: storeOrderSummaries.filter((item) => item.status === "agendado").length,
      emProducao: storeOrderSummaries.filter((item) => item.status === "em_producao").length,
      rotaEntrega: storeOrderSummaries.filter((item) => item.status === "aguardando_expedicao").length,
    }),
    [storeOrderSummaries],
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(productsWithAvailability.map((item) => item.category)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    [productsWithAvailability],
  );

  const filteredOrderProducts = useMemo(() => {
    const term = catalogSearchTerm.trim().toLowerCase();

    return productsWithAvailability.filter((item) => {
      const matchesSearch =
        term.length === 0 ||
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" ? item.available : !item.available);

      return matchesSearch && matchesCategory && matchesAvailability;
    });
  }, [availabilityFilter, catalogSearchTerm, categoryFilter, productsWithAvailability]);

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
    { icon: "view" as const, label: "Visualizar", onClick: (item: StoreOrderSummary) => router.push(`/loja/pedidos/${item.id}`) },
    { icon: "print" as const, label: "Imprimir", onClick: (item: StoreOrderSummary) => window.open(`/impressao/pedido-loja/${item.id}`, "_blank", "noopener,noreferrer") },
  ];

  const handleQuantityChange = (productId: string, field: EditableDayField, value: number) => {
    if (field !== highlightedDay) {
      return;
    }

    const sanitizedValue = Number.isFinite(value) && value > 0 ? value : 0;

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
    setAvailabilityFilter("all");
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
      return;
    }

    await createOrder({
      storeId: selectedStore.id,
      orderedAt: referenceDate.toISOString(),
      items,
    });
    setOrderProducts(catalog);
  }

  return (
    <PageLayout
      title="Meus Pedidos"
      description="Gerencie seus pedidos"
      badge="Loja"
      breadcrumbs={[{ label: "Loja", href: "/loja" }, { label: "Pedidos" }]}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Total de Pedidos" value={orderKpis.total} icon={ShoppingCart} tone="info" />
        <KPICard title="Agendado" value={orderKpis.agendado} icon={Clock3} tone="warning" />
        <KPICard title="Em Produção" value={orderKpis.emProducao} icon={Package} tone="neutral" />
        <KPICard title="Entregas" value={orderKpis.rotaEntrega} icon={Truck} tone="success" />
        <KPICard title="Ocorrências" value="12" icon={AlertCircle} tone="danger" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Pedidos</CardTitle>
          <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
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
                {activeStores.length === 0 ? (
                  <div className="rounded-lg border border-danger/35 bg-danger/15 px-4 py-3 text-sm text-danger-foreground">
                    Nenhuma loja ativa está vinculada ao seu perfil. Revise os vínculos de loja antes de criar pedidos.
                  </div>
                ) : null}

                <div className="rounded-lg border border-border/80 bg-panel p-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Nome da Loja</Label>
                      <Select value={selectedStore?.id ?? ""} onValueChange={setSelectedStoreId} disabled={activeStores.length === 0}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma loja" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeStores.map((store) => (
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
                </div>

                <div className="rounded-lg border border-border/80 bg-panel/55 p-3">
                  <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">
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
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Disponibilidade</Label>
                      <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="available">Disponível</SelectItem>
                          <SelectItem value="unavailable">Indisponível</SelectItem>
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
                    {filteredOrderProducts.length} de {orderProducts.length} produtos visíveis.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Coluna ativa do pedido: <strong>{WEEK_LABEL[highlightedDay]}</strong> (sempre na primeira posição).
                  </p>
                </div>

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
                        filteredOrderProducts.map((product) => (
                          <tr key={product.id} className="border-t border-border/70">
                            <td className="px-2 py-2 font-mono text-sm">{product.code}</td>
                            <td className="px-2 py-2 text-sm">
                              {product.name}
                            </td>
                            <td className="px-2 py-2 text-sm">{product.category}</td>
                            <td className="px-2 py-2 text-sm">{product.unit}</td>
                            {dayColumns.map((dayField, index) => {
                              const isActiveColumn = index === 0;
                              const canEdit = isActiveColumn && product.available;

                              return (
                                <td
                                  key={`${product.id}-${dayField}`}
                                  className={cn("px-1 py-1", isActiveColumn && "bg-success/25")}
                                >
                                  <Input
                                    type="number"
                                    className="h-8 w-16 text-center"
                                    value={product[dayField]}
                                    onChange={(e) => handleQuantityChange(product.id, dayField, Number(e.target.value))}
                                    disabled={!canEdit}
                                  />
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-sm font-semibold">
                              {product[highlightedDay]} {product.unit}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-sm text-muted-foreground">
                  <span className="mr-4 inline-flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-sm bg-success/50" />
                    Disponível
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-sm bg-secondary" />
                    Indisponível
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsNewOrderOpen(false)}>
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
            emptyMessage="Nenhum pedido encontrado"
            stickyHeader
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
