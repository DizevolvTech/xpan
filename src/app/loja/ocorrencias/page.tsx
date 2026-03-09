"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getStoreOrderById, storeOrderSummaries, type StoreOrderDetail } from "@/lib/store-orders-mock";

type QuantityType = "percentual" | "kg" | "operacional";

interface Ocorrencia {
  id: string;
  code: string;
  orderCode: string;
  product: string;
  type: string;
  quantitySummary: string;
  openDate: string;
  status: "aberta" | "em_analise" | "resolvida" | "fechada";
}

const initialOcorrencias: Ocorrencia[] = [
  {
    id: "1",
    code: "OC-0001",
    orderCode: "PD-1443",
    product: "Pão Francês",
    type: "Quantidade incorreta",
    quantitySummary: "12 Un",
    openDate: "08/11/2025",
    status: "aberta",
  },
  {
    id: "2",
    code: "OC-0002",
    orderCode: "PD-1440",
    product: "Bolo Tapioca",
    type: "Produto danificado",
    quantitySummary: "1 Forma",
    openDate: "07/11/2025",
    status: "em_analise",
  },
  {
    id: "3",
    code: "OC-0003",
    orderCode: "PD-1435",
    product: "Sonho",
    type: "Atraso na entrega",
    quantitySummary: "100%",
    openDate: "05/11/2025",
    status: "resolvida",
  },
];

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

function getTodayBrDate() {
  return new Intl.DateTimeFormat("pt-BR").format(new Date());
}

function buildOrderDetailsList() {
  return storeOrderSummaries
    .map((summary) => getStoreOrderById(summary.id))
    .filter((order): order is StoreOrderDetail => Boolean(order));
}

export default function OcorrenciasLojaPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(initialOcorrencias);
  const [orderId, setOrderId] = useState("");
  const [productId, setProductId] = useState("");
  const [problemType, setProblemType] = useState("");
  const [quantityType, setQuantityType] = useState<QuantityType>("operacional");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");

  const orderDetails = useMemo(() => buildOrderDetailsList(), []);
  const selectedOrder = useMemo(
    () => orderDetails.find((item) => item.id === orderId) ?? null,
    [orderDetails, orderId],
  );
  const selectedProduct = useMemo(
    () => selectedOrder?.items.find((item) => item.id === productId) ?? null,
    [productId, selectedOrder],
  );

  const operationalUnit = selectedProduct?.operationalUnit ?? selectedProduct?.unit ?? "-";
  const quantityUnit = quantityType === "percentual" ? "%" : quantityType === "kg" ? "Kg" : operationalUnit;

  const filteredOcorrencias = ocorrencias.filter((item) => {
    const matchesSearch =
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    { key: "code", header: "Código" },
    { key: "orderCode", header: "Pedido" },
    { key: "product", header: "Produto" },
    { key: "type", header: "Tipo" },
    { key: "quantitySummary", header: "Qtd afetada" },
    { key: "openDate", header: "Data Abertura" },
    {
      key: "status",
      header: "Status",
      render: (item: Ocorrencia) => <StatusBadge status={item.status} />,
    },
  ];

  const actions = [
    { icon: "view" as const, label: "Visualizar", onClick: (item: Ocorrencia) => console.log("View", item) },
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
      return "Informe uma quantidade afetada válida.";
    }

    if (quantityType === "percentual" && quantityValue > 100) {
      return "Para % afetado, o valor deve ficar entre 0 e 100.";
    }

    if (description.trim().length < 20) {
      return "Descreva o problema com no mínimo 20 caracteres.";
    }

    return null;
  }

  function handleSubmit() {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    const quantityValue = Number(quantity);
    const quantitySummary =
      quantityType === "percentual"
        ? `${quantityValue}%`
        : `${quantityValue} ${quantityUnit}`;

    setOcorrencias((current) => [
      {
        id: String(current.length + 1),
        code: `OC-${String(current.length + 1).padStart(4, "0")}`,
        orderCode: selectedOrder!.code,
        product: selectedProduct!.name,
        type: problemType,
        quantitySummary,
        openDate: getTodayBrDate(),
        status: "aberta",
      },
      ...current,
    ]);

    handleDialogChange(false);
  }

  return (
    <PageLayout
      title="Ocorrências"
      description="Registre perdas, divergências e problemas de entrega com unidade operacional preenchida automaticamente."
      badge="Loja"
      breadcrumbs={[{ label: "Loja", href: "/loja" }, { label: "Ocorrências" }]}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <KPICard title="Ocorrências abertas" value={ocorrencias.filter((item) => item.status === "aberta").length} icon={AlertCircle} tone="danger" />
        <KPICard title="Em análise" value={ocorrencias.filter((item) => item.status === "em_analise").length} icon={AlertCircle} tone="warning" />
        <KPICard title="Resolvidas" value={ocorrencias.filter((item) => item.status === "resolvida").length} icon={AlertCircle} tone="success" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Ocorrências</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="size-4" />
                Nova Ocorrência
              </Button>
            </DialogTrigger>
            <DialogContent size="xl">
              <DialogHeader>
                <DialogTitle>Nova Ocorrência</DialogTitle>
                <DialogDescription>
                  Selecione o pedido, o produto e o tipo de quantidade afetada. A unidade operacional do produto é preenchida automaticamente.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Pedido Relacionado *</Label>
                  <Select value={orderId} onValueChange={handleOrderChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o pedido" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderDetails.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.code} - {order.deliveryDate} - {order.store}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Produto Afetado *</Label>
                  <Select value={productId} onValueChange={setProductId} disabled={!selectedOrder}>
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
                      : `A unidade operacional do produto selecionado é ${quantityUnit}.`}
                </div>

                <div className="grid gap-2">
                  <Label>Descrição do Problema *</Label>
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
                <Button type="button" onClick={handleSubmit}>
                  Abrir Ocorrência
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código, pedido ou produto..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            filters={[
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "aberta", label: "Aberta" },
                  { value: "em_analise", label: "Em análise" },
                  { value: "resolvida", label: "Resolvida" },
                  { value: "fechada", label: "Fechada" },
                ],
              },
            ]}
          />

          <DataTable
            data={filteredOcorrencias}
            columns={columns}
            actions={actions}
            keyField="id"
            emptyMessage="Nenhuma ocorrência encontrada"
            stickyHeader
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
