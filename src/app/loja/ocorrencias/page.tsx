"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { PageLayout } from "@/components/shared/page-layout";
import { SearchFilter } from "@/components/shared/search-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getTodayDateKey } from "@/lib/order-planning";
import { useCurrentProfile } from "@/lib/use-current-profile";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useStoreOccurrences, type StoreOccurrence } from "@/lib/use-store-occurrences";
import { useStoreOrderDetail, useStoreOrderSummaries } from "@/lib/use-store-orders";
import { useStoreScope } from "@/lib/use-store-scope";

type QuantityType = "percentual" | "kg" | "operacional";

const problemTypes = [
  "Produto extraviado",
  "Produto danificado",
  "Quantidade incorreta",
  "Produto errado",
  "Produto vencido",
  "Qualidade insatisfatoria",
  "Atraso na entrega",
  "Outro",
];

const quantityTypeOptions: Array<{ value: QuantityType; label: string }> = [
  { value: "percentual", label: "%" },
  { value: "kg", label: "Kg" },
  { value: "operacional", label: "Unidades/Pacotes" },
];

function formatDateTimeBr(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateIso));
}

export default function OcorrenciasLojaPage() {
  const { profile } = useCurrentProfile();
  const { snapshot } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<StoreOccurrence | null>(null);
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
  const { occurrences, createOccurrence, error, isLoading } = useStoreOccurrences(selectedStoreId);
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
  const effectiveOrderId = useMemo(
    () =>
      scopedOrderSummaries.some((order) => order.id === orderId)
        ? orderId
        : "",
    [orderId, scopedOrderSummaries],
  );
  const { order: selectedOrder } = useStoreOrderDetail(effectiveOrderId, getTodayDateKey());
  const effectiveProductId = useMemo(
    () =>
      selectedOrder?.items.some((item) => item.id === productId)
        ? productId
        : "",
    [productId, selectedOrder],
  );
  const selectedProduct = useMemo(
    () => selectedOrder?.items.find((item) => item.id === effectiveProductId) ?? null,
    [effectiveProductId, selectedOrder],
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
    { key: "code", header: "Codigo" },
    ...(shouldShowStoreSelector
      ? [
          {
            key: "storeName",
            header: "Loja",
            render: (item: StoreOccurrence) => storeNameById.get(item.storeId) ?? item.storeId,
          },
        ]
      : []),
    { key: "orderCode", header: "Pedido" },
    { key: "productName", header: "Produto" },
    { key: "problemType", header: "Tipo" },
    {
      key: "quantitySummary",
      header: "Qtd afetada",
      render: (item: StoreOccurrence) =>
        item.quantityType === "percentual"
          ? `${item.quantity}%`
          : `${item.quantity} ${item.quantityUnit}`,
    },
    {
      key: "createdAt",
      header: "Data Abertura",
      render: (item: StoreOccurrence) => formatDateTimeBr(item.createdAt),
    },
    {
      key: "status",
      header: "Status",
      render: (item: StoreOccurrence) => <StatusBadge status={item.status} />,
    },
  ];
  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: StoreOccurrence) => setSelectedOccurrence(item),
    },
  ];

  function resetForm() {
    setOrderId("");
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
      return "Selecione o pedido relacionado.";
    }
    if (!selectedProduct) {
      return "Selecione o produto afetado.";
    }
    if (!problemType) {
      return "Selecione o tipo de problema.";
    }

    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      return "Informe uma quantidade afetada valida.";
    }
    if (quantityType === "percentual" && quantityValue > 100) {
      return "Para % afetado, o valor deve ficar entre 0 e 100.";
    }
    if (description.trim().length < 20) {
      return "Descreva o problema com no minimo 20 caracteres.";
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
      productNameSnapshot: selectedProduct!.name,
      problemType,
      quantityType,
      quantity: Number(quantity),
      quantityUnitSnapshot: quantityUnit,
      description,
    });

    handleDialogChange(false);
    setSelectedOccurrence(createdOccurrence);
  }

  return (
    <PageLayout
      title="Ocorrencias"
      description="Registre perdas, divergencias e problemas de entrega com unidade operacional preenchida automaticamente."
      badge="Loja"
      breadcrumbs={[{ label: "Loja", href: "/loja" }, { label: "Ocorrencias" }]}
    >
      <Card className="border-border/80">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Escopo da loja
            </p>
            <p className="text-sm text-muted-foreground">
              As ocorrências listadas e os pedidos disponíveis respeitam somente as lojas autorizadas do usuário.
            </p>
          </div>
          {shouldShowStoreSelector ? (
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[260px] bg-card">
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
          ) : selectedStore ? (
            <span className="rounded-md border border-border/70 bg-panel px-3 py-2 text-sm text-foreground">
              {selectedStore.name}
            </span>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <KPICard title="Ocorrencias abertas" value={occurrences.filter((item) => item.status === "aberta").length} icon={AlertCircle} tone="danger" />
        <KPICard title="Em analise" value={occurrences.filter((item) => item.status === "em_analise").length} icon={AlertCircle} tone="warning" />
        <KPICard title="Resolvidas" value={occurrences.filter((item) => item.status === "resolvida").length} icon={AlertCircle} tone="success" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Ocorrencias</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="size-4" />
                Nova Ocorrencia
              </Button>
            </DialogTrigger>
            <DialogContent size="xl">
              <DialogHeader>
                <DialogTitle>Nova Ocorrencia</DialogTitle>
                <DialogDescription>
                  Selecione o pedido, o produto e o tipo de quantidade afetada. A unidade operacional do produto e preenchida automaticamente.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Pedido Relacionado *</Label>
                  <Select value={effectiveOrderId} onValueChange={handleOrderChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o pedido" />
                    </SelectTrigger>
                    <SelectContent>
                      {scopedOrderSummaries.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.code} - {order.deliveryDate} - {order.store}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Produto Afetado *</Label>
                  <Select value={effectiveProductId} onValueChange={setProductId} disabled={!selectedOrder}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedOrder ? "Selecione o produto" : "Selecione um pedido primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedOrder?.items ?? []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Tipo de Problema *</Label>
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

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Tipo de Quantidade Afetada *</Label>
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
                    <Label>Quantidade Afetada *</Label>
                    <Input
                      type="number"
                      min="0"
                      max={quantityType === "percentual" ? "100" : undefined}
                      step={quantityType === "operacional" ? "1" : "0.1"}
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder={quantityType === "percentual" ? "0 a 100" : "Informe a quantidade"}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Unidade Aplicada</Label>
                    <Input value={quantityUnit} readOnly className="bg-muted" />
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-panel/45 px-3 py-2 text-xs text-muted-foreground">
                  {quantityType === "percentual"
                    ? "Use % para perdas proporcionais da entrega inteira."
                    : quantityType === "kg"
                      ? "Use Kg quando o impacto for medido em peso."
                      : `A unidade operacional do produto selecionado e ${quantityUnit}.`}
                </div>

                <div className="grid gap-2">
                  <Label>Descricao do Problema *</Label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Descreva o problema com detalhes operacionais e impacto na loja."
                    className="min-h-[110px]"
                  />
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
                  Abrir Ocorrencia
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
              {error}
            </div>
          ) : null}

          <SearchFilter
            searchPlaceholder="Buscar por código, pedido ou produto..."
            searchValue={searchTerm}
            onSearch={setSearchTerm}
            filters={[
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "all", label: "Todos" },
                  { value: "aberta", label: "Aberta" },
                  { value: "em_analise", label: "Em análise" },
                  { value: "resolvida", label: "Resolvida" },
                  { value: "fechada", label: "Fechada" },
                ],
              },
            ]}
          />

          <DataTable
            data={filteredOccurrences}
            columns={columns}
            actions={actions}
            keyField="id"
            onRowClick={(item) => setSelectedOccurrence(item)}
            emptyMessage="Nenhuma ocorrência encontrada"
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedOccurrence)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOccurrence(null);
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{selectedOccurrence?.code ?? "Ocorrência"}</DialogTitle>
            <DialogDescription>
              Visualização imediata da ocorrência registrada, sem depender de recarga manual.
            </DialogDescription>
          </DialogHeader>

          {selectedOccurrence ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/80 bg-panel/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Loja
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {storeNameById.get(selectedOccurrence.storeId) ?? selectedOccurrence.storeId}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-panel/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Pedido
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedOccurrence.orderCode}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Produto afetado
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedOccurrence.productName}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Quantidade afetada
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedOccurrence.quantityType === "percentual"
                      ? `${selectedOccurrence.quantity}%`
                      : `${selectedOccurrence.quantity} ${selectedOccurrence.quantityUnit}`}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Tipo do problema
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedOccurrence.problemType}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={selectedOccurrence.status} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Descrição
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {selectedOccurrence.description}
                </p>
              </div>

              <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                <p>Abertura: {formatDateTimeBr(selectedOccurrence.createdAt)}</p>
                <p>Última atualização: {formatDateTimeBr(selectedOccurrence.updatedAt)}</p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedOccurrence(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
