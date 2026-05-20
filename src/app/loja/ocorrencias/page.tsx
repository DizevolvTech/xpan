"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, MessageSquarePlus, Plus, RotateCcw } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { InfoHint } from "@/components/shared/info-hint";
import { KPICard } from "@/components/shared/kpi-card";
import { PageLayout } from "@/components/shared/page-layout";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { SearchFilter } from "@/components/shared/search-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getTodayDateKey } from "@/lib/order-planning";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import {
  useStoreOccurrences,
  type StoreOccurrence,
  type StoreOccurrenceDetail,
} from "@/lib/use-store-occurrences";
import { useStoreOrderDetail, useStoreOrderSummaries } from "@/lib/use-store-orders";
import { useStoreScope } from "@/lib/use-store-scope";

type QuantityType = "percentual" | "kg" | "operacional";

const problemTypes = [
  "Produto extraviado",
  "Produto danificado",
  "Quantidade incorreta",
  "Produto errado",
  "Produto vencido",
  "Qualidade insatisfatória",
  "Atraso na entrega",
  "Outro",
];

const quantityTypeOptions: Array<{ value: QuantityType; label: string }> = [
  { value: "percentual", label: "%" },
  { value: "kg", label: "Kg" },
  { value: "operacional", label: "Unidades/Pacotes" },
];

const eligibleOccurrenceStatuses = new Set(["em_rota", "no_destino", "entregue"]);

function formatDateTimeBr(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateIso));
}

function buildStoreTransitionActions(status: StoreOccurrence["status"]) {
  if (status === "resolvida") {
    return [
      { label: "Confirmar fechamento", status: "fechada" as const, icon: CheckCircle2 },
      { label: "Reabrir", status: "aberta" as const, icon: RotateCcw },
    ];
  }

  if (status === "fechada") {
    return [{ label: "Reabrir", status: "aberta" as const, icon: RotateCcw }];
  }

  return [];
}

export default function OcorrenciasLojaPage() {
  const searchParams = useSearchParams();
  const requestedOrderId = searchParams.get("orderId") ?? "";
  const { profile } = useCurrentProfile();
  const { snapshot } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<StoreOccurrenceDetail | null>(null);
  const [detailComment, setDetailComment] = useState("");
  const [detailError, setDetailError] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailSubmitting, setIsDetailSubmitting] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [productId, setProductId] = useState("");
  const [problemType, setProblemType] = useState("");
  const [quantityType, setQuantityType] = useState<QuantityType>("operacional");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");

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
  const {
    occurrences,
    createOccurrence,
    fetchOccurrenceDetail,
    updateOccurrenceStatus,
    addOccurrenceComment,
    error,
    isLoading,
  } = useStoreOccurrences(selectedStoreId);
  const { orders: orderSummaries } = useStoreOrderSummaries(getTodayDateKey());

  const storeNameById = useMemo(
    () => new Map(snapshot.stores.map((store) => [store.id, store.name])),
    [snapshot.stores],
  );

  const scopedOrderSummaries = useMemo(
    () =>
      selectedStoreId
        ? orderSummaries.filter((order) => order.storeId === selectedStoreId)
        : orderSummaries,
    [orderSummaries, selectedStoreId],
  );
  const eligibleOrderSummaries = useMemo(
    () => scopedOrderSummaries.filter((order) => eligibleOccurrenceStatuses.has(order.status)),
    [scopedOrderSummaries],
  );
  const storeOptionsForSearch = useMemo(
    () =>
      availableStores.map((store) => ({
        value: store.id,
        label: store.name,
        description: "Filtra as ocorrências e os pedidos elegíveis desta loja.",
        keywords: [store.id],
      })),
    [availableStores],
  );
  const eligibleOrderOptionsForSearch = useMemo(
    () =>
      eligibleOrderSummaries.map((order) => ({
        value: order.id,
        label: `${order.code} - ${order.deliveryDate}`,
        description: `${order.store} · ${order.status.replaceAll("_", " ")}`,
        keywords: [order.code, order.store, order.deliveryDate, order.status],
      })),
    [eligibleOrderSummaries],
  );

  useEffect(() => {
    if (!requestedOrderId) {
      return;
    }

    const matchedOrder = orderSummaries.find((order) => order.id === requestedOrderId);
    if (!matchedOrder) {
      return;
    }

    if (matchedOrder.storeId !== selectedStoreId) {
      setSelectedStoreId(matchedOrder.storeId);
    }
    setOrderId((current) => current || requestedOrderId);
  }, [orderSummaries, requestedOrderId, selectedStoreId, setSelectedStoreId]);

  const effectiveOrderId = useMemo(
    () => (eligibleOrderSummaries.some((order) => order.id === orderId) ? orderId : ""),
    [eligibleOrderSummaries, orderId],
  );
  const { order: selectedOrder } = useStoreOrderDetail(effectiveOrderId, getTodayDateKey());
  const effectiveProductId = useMemo(
    () => (selectedOrder?.items.some((item) => item.id === productId) ? productId : ""),
    [productId, selectedOrder],
  );
  const selectedProduct = useMemo(
    () => selectedOrder?.items.find((item) => item.id === effectiveProductId) ?? null,
    [effectiveProductId, selectedOrder],
  );
  const selectedOrderItemsForSearch = useMemo(
    () =>
      (selectedOrder?.items ?? []).map((item) => ({
        value: item.id,
        label: `${item.code} - ${item.name}`,
        description: `${item.category} · ${item.quantity} ${item.unit}`,
        keywords: [item.code, item.name, item.category, item.operationalUnit],
      })),
    [selectedOrder],
  );
  const operationalUnit = selectedProduct?.operationalUnit ?? selectedProduct?.unit ?? "-";
  const quantityUnit = quantityType === "percentual" ? "%" : quantityType === "kg" ? "Kg" : operationalUnit;

  const filteredOccurrences = useMemo(
    () =>
      occurrences.filter((item) => {
        const matchesSearch =
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.productName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || item.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [occurrences, searchTerm, statusFilter],
  );

  const columns = [
    {
      key: "code",
      header: "Código",
      render: (item: StoreOccurrence) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{item.code}</span>
      ),
    },
    ...(shouldShowStoreSelector
      ? [
          {
            key: "storeName",
            header: "Loja",
            render: (item: StoreOccurrence) => storeNameById.get(item.storeId) ?? item.storeId,
          },
        ]
      : []),
    {
      key: "orderCode",
      header: "Pedido",
      render: (item: StoreOccurrence) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{item.orderCode}</span>
      ),
    },
    {
      key: "productName",
      header: "Produto",
      render: (item: StoreOccurrence) => (
        <span className="font-medium text-foreground">{item.productName}</span>
      ),
    },
    { key: "problemType", header: "Tipo" },
    {
      key: "quantitySummary",
      header: "Qtd afetada",
      render: (item: StoreOccurrence) => (
        <span className="tabular-nums">
          {item.quantityType === "percentual"
            ? `${item.quantity}%`
            : `${item.quantity} ${item.quantityUnit}`}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Abertura",
      render: (item: StoreOccurrence) => (
        <span className="tabular-nums text-muted-foreground">{formatDateTimeBr(item.createdAt)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: StoreOccurrence) => <StatusBadge status={item.status} />,
    },
  ];

  async function openOccurrenceDetail(occurrenceId: string) {
    setSelectedOccurrenceId(occurrenceId);
    setSelectedOccurrence(null);
    setDetailComment("");
    setDetailError("");
    setIsDetailLoading(true);

    try {
      const detail = await fetchOccurrenceDetail(occurrenceId);
      setSelectedOccurrence(detail);
    } catch (fetchError) {
      setDetailError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar ocorrência.");
    } finally {
      setIsDetailLoading(false);
    }
  }

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: StoreOccurrence) => {
        void openOccurrenceDetail(item.id);
      },
    },
  ];

  function resetForm() {
    setOrderId(requestedOrderId);
    setProductId("");
    setProblemType("");
    setQuantityType("operacional");
    setQuantity("");
    setDescription("");
    setFormError("");
  }

  function handleDialogChange(open: boolean) {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  }

  function handleOrderChange(value: string) {
    setOrderId(value);
    setProductId("");
    setFormError("");
  }

  function validateForm() {
    if (!selectedOrder) {
      return "Selecione um pedido já em rota, no destino ou entregue.";
    }
    if (!selectedProduct) {
      return "Selecione o produto afetado.";
    }
    if (!problemType) {
      return "Selecione o tipo de problema.";
    }

    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      return "Informe uma quantidade afetada válida.";
    }
    if (quantityType === "percentual" && quantityValue > 100) {
      return "Para percentual afetado, o valor deve ficar entre 0 e 100.";
    }
    if (description.trim().length < 20) {
      return "Descreva o problema com no mínimo 20 caracteres.";
    }

    return null;
  }

  async function handleSubmit() {
    const errorMessage = validateForm();
    if (errorMessage) {
      setFormError(errorMessage);
      return;
    }

    const createdOccurrence = await createOccurrence({
      orderId: selectedOrder!.id,
      orderItemId: selectedProduct!.id,
      productId: selectedProduct!.productId,
      productNameSnapshot: selectedProduct!.name,
      problemType,
      quantityType,
      quantity: Number(quantity),
      quantityUnitSnapshot: quantityUnit,
      description,
    });

    handleDialogChange(false);
    setSelectedOccurrenceId(createdOccurrence.id);
    setSelectedOccurrence(createdOccurrence);
    setDetailComment("");
    setDetailError("");
  }

  async function handleStatusChange(status: StoreOccurrence["status"]) {
    if (!selectedOccurrence) {
      return;
    }

    setIsDetailSubmitting(true);
    setDetailError("");
    try {
      const updated = await updateOccurrenceStatus(selectedOccurrence.id, status);
      setSelectedOccurrence(updated);
    } catch (updateError) {
      setDetailError(updateError instanceof Error ? updateError.message : "Falha ao atualizar ocorrência.");
    } finally {
      setIsDetailSubmitting(false);
    }
  }

  async function handleAddComment() {
    if (!selectedOccurrence || detailComment.trim().length === 0) {
      return;
    }

    setIsDetailSubmitting(true);
    setDetailError("");
    try {
      const updated = await addOccurrenceComment(selectedOccurrence.id, detailComment.trim());
      setSelectedOccurrence(updated);
      setDetailComment("");
    } catch (commentError) {
      setDetailError(commentError instanceof Error ? commentError.message : "Falha ao registrar comentário.");
    } finally {
      setIsDetailSubmitting(false);
    }
  }

  const detailActions = selectedOccurrence ? buildStoreTransitionActions(selectedOccurrence.status) : [];

  const storeScopeControl = shouldShowStoreSelector ? (
    availableStores.length >= 8 ? (
      <SearchableSelect
        value={selectedStoreId}
        onValueChange={setSelectedStoreId}
        options={storeOptionsForSearch}
        placeholder="Filtrar por loja"
        searchPlaceholder="Buscar loja..."
        emptyMessage="Nenhuma loja encontrada."
        title="Selecionar loja"
        description="Busque a loja para restringir a lista de ocorrências e os pedidos elegíveis."
        className="w-[220px] bg-card"
      />
    ) : (
      <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
        <SelectTrigger className="w-[220px] bg-card">
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
    )
  ) : selectedStore ? (
    <span className="hidden h-9 items-center rounded-md border border-border/70 bg-panel/50 px-3 text-sm text-muted-foreground sm:inline-flex">
      <span className="mr-1.5 text-xs uppercase tracking-[0.08em] text-muted-foreground/80">Loja</span>
      <span className="font-medium text-foreground">{selectedStore.name}</span>
    </span>
  ) : null;

  const newOccurrenceTrigger = (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="size-4" />
          Nova ocorrência
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nova ocorrência</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <div className="flex items-center gap-1.5">
              <Label>Pedido relacionado *</Label>
              <InfoHint
                size="sm"
                content="Somente pedidos em rota, no destino ou já entregues podem abrir ocorrência."
              />
            </div>
            {eligibleOrderSummaries.length >= 8 ? (
              <SearchableSelect
                value={effectiveOrderId}
                onValueChange={handleOrderChange}
                options={eligibleOrderOptionsForSearch}
                placeholder="Selecione o pedido"
                searchPlaceholder="Buscar pedido..."
                emptyMessage="Nenhum pedido elegível encontrado."
                title="Selecionar pedido"
                description="Busque por código, loja, data de entrega ou status do pedido."
              />
            ) : (
              <Select value={effectiveOrderId} onValueChange={handleOrderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pedido" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleOrderSummaries.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.code} - {order.deliveryDate} - {order.store}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Produto afetado *</Label>
            {(selectedOrder?.items.length ?? 0) >= 8 ? (
              <SearchableSelect
                value={effectiveProductId}
                onValueChange={setProductId}
                options={selectedOrderItemsForSearch}
                placeholder={
                  selectedOrder ? "Selecione o produto" : "Selecione um pedido primeiro"
                }
                searchPlaceholder="Buscar produto..."
                emptyMessage="Nenhum produto encontrado neste pedido."
                title="Selecionar produto afetado"
                description="Busque pelo código, nome ou categoria do item entregue."
                disabled={!selectedOrder}
              />
            ) : (
              <Select
                value={effectiveProductId}
                onValueChange={setProductId}
                disabled={!selectedOrder}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedOrder ? "Selecione o produto" : "Selecione um pedido primeiro"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(selectedOrder?.items ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Tipo de problema *</Label>
            <Select value={problemType} onValueChange={setProblemType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {problemTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_140px]">
            <div className="grid gap-2">
              <Label>Tipo da quantidade *</Label>
              <Select value={quantityType} onValueChange={(value) => setQuantityType(value as QuantityType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {quantityTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Quantidade afetada *</Label>
              <Input
                type="number"
                min="0"
                max={quantityType === "percentual" ? "100" : undefined}
                step={quantityType === "operacional" ? "1" : "0.1"}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={
                  quantityType === "percentual" ? "0 – 100" : "Valor afetado"
                }
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                {quantityType === "percentual"
                  ? "Percentual da entrega impactado (sem o símbolo %)."
                  : quantityType === "kg"
                    ? "Peso afetado em quilogramas."
                    : `Quantidade afetada em ${quantityUnit}.`}
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Unidade</Label>
              <Input value={quantityUnit} readOnly className="bg-muted/60 tabular-nums" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Descrição do problema *</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descreva o problema com detalhes operacionais e impacto na loja."
              className="min-h-[110px]"
            />
            <p className="text-xs text-muted-foreground">Mínimo 20 caracteres.</p>
          </div>

          {formError ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
              {formError}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()}>
            Abrir ocorrência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <PageLayout
      title="Ocorrências"
      description="Registre divergências de entrega com timeline, comentários e rastreabilidade do tratamento."
      badge="Loja"
      breadcrumbs={[{ label: "Loja", href: "/loja" }, { label: "Ocorrências" }]}
      actions={
        <>
          {storeScopeControl}
          {newOccurrenceTrigger}
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <KPICard
          title="Ocorrências abertas"
          value={occurrences.filter((item) => item.status === "aberta").length}
          icon={AlertCircle}
          tone="danger"
        />
        <KPICard
          title="Em análise"
          value={occurrences.filter((item) => item.status === "em_analise").length}
          icon={Clock}
          tone="warning"
        />
        <KPICard
          title="Resolvidas"
          value={occurrences.filter((item) => item.status === "resolvida").length}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilter
            searchPlaceholder="Buscar por código, pedido ou produto..."
            searchValue={searchTerm}
            onSearch={setSearchTerm}
            showFilters={false}
            className="w-full lg:max-w-md"
          />
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="aberta">Aberta</TabsTrigger>
              <TabsTrigger value="em_analise">Em análise</TabsTrigger>
              <TabsTrigger value="resolvida">Resolvida</TabsTrigger>
              <TabsTrigger value="fechada">Fechada</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <DataTable
          data={filteredOccurrences}
          columns={columns}
          actions={actions}
          keyField="id"
          onRowClick={(item) => {
            void openOccurrenceDetail(item.id);
          }}
          emptyMessage="Nenhuma ocorrência encontrada"
          isLoading={isLoading}
        />
      </div>

      <Dialog
        open={Boolean(selectedOccurrenceId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOccurrenceId(null);
            setSelectedOccurrence(null);
            setDetailComment("");
            setDetailError("");
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="font-mono text-base tabular-nums">
                {selectedOccurrence?.code ?? "Ocorrência"}
              </DialogTitle>
              {selectedOccurrence ? <StatusBadge status={selectedOccurrence.status} /> : null}
            </div>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Carregando ocorrência...</div>
          ) : selectedOccurrence ? (
            <div className="grid gap-5 py-1">
              {detailActions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {detailActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.status}
                        type="button"
                        size="sm"
                        variant={action.status === "fechada" ? "default" : "outline"}
                        disabled={isDetailSubmitting}
                        onClick={() => void handleStatusChange(action.status)}
                      >
                        <Icon className="size-4" />
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              ) : null}

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Loja</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {storeNameById.get(selectedOccurrence.storeId) ?? selectedOccurrence.storeId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Pedido</dt>
                  <dd className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
                    {selectedOccurrence.orderCode}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Tipo</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{selectedOccurrence.problemType}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Qtd afetada</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-foreground">
                    {selectedOccurrence.quantityType === "percentual"
                      ? `${selectedOccurrence.quantity}%`
                      : `${selectedOccurrence.quantity} ${selectedOccurrence.quantityUnit}`}
                  </dd>
                </div>
                <div className="col-span-2 md:col-span-4">
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produto afetado</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{selectedOccurrence.productName}</dd>
                </div>
              </dl>

              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Descrição</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{selectedOccurrence.description}</p>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs tabular-nums text-muted-foreground">
                <span>Abertura: {formatDateTimeBr(selectedOccurrence.createdAt)}</span>
                <span>Última atualização: {formatDateTimeBr(selectedOccurrence.updatedAt)}</span>
              </div>

              <div className="border-t border-border/[var(--opacity-divider)] pt-4">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Comentários e timeline</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {selectedOccurrence.events.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-lg border border-border/70 bg-panel/35 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm text-foreground">{event.content}</p>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatDateTimeBr(event.createdAt)}
                        </span>
                      </div>
                      {event.actorName ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">Responsável: {event.actorName}</p>
                      ) : null}
                    </article>
                  ))}
                </div>

                <div className="mt-4 grid gap-2">
                  <Label htmlFor="occurrence-comment">Novo comentário</Label>
                  <Textarea
                    id="occurrence-comment"
                    value={detailComment}
                    onChange={(event) => setDetailComment(event.target.value)}
                    placeholder="Registre um complemento, validação da loja ou retorno sobre a tratativa."
                    className="min-h-[96px]"
                    disabled={!selectedOccurrence.canComment || isDetailSubmitting}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!selectedOccurrence.canComment || detailComment.trim().length === 0 || isDetailSubmitting}
                      onClick={() => void handleAddComment()}
                    >
                      <MessageSquarePlus className="size-4" />
                      Adicionar comentário
                    </Button>
                  </div>
                </div>
              </div>

              {detailError ? (
                <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                  {detailError}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="py-8 text-sm text-muted-foreground">
              Não foi possível carregar os dados da ocorrência.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedOccurrenceId(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
