"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Ocorrencia {
  id: string;
  code: string;
  orderCode: string;
  product: string;
  type: string;
  openDate: string;
  status: "aberta" | "em_analise" | "resolvida" | "fechada";
}

const mockOcorrencias: Ocorrencia[] = [
  {
    id: "1",
    code: "OC-0001",
    orderCode: "PD-1443",
    product: "Pão Francês",
    type: "Quantidade incorreta",
    openDate: "08/11/2025",
    status: "aberta",
  },
  {
    id: "2",
    code: "OC-0002",
    orderCode: "PD-1440",
    product: "Bolo Tapioca",
    type: "Produto danificado",
    openDate: "07/11/2025",
    status: "em_analise",
  },
  {
    id: "3",
    code: "OC-0003",
    orderCode: "PD-1435",
    product: "Sonho",
    type: "Atraso na entrega",
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

export default function OcorrenciasLojaPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredOcorrencias = mockOcorrencias.filter((item) => {
    const matchesSearch =
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.orderCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    { key: "code", header: "Código" },
    { key: "orderCode", header: "Pedido" },
    { key: "product", header: "Produto" },
    { key: "type", header: "Tipo" },
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

  return (
    <PageLayout
      title="Ocorrências"
      description="Gerencie ocorrências de problemas"
      badge="Loja"
      breadcrumbs={[{ label: "Loja", href: "/loja" }, { label: "Ocorrências" }]}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <KPICard title="Ocorrências Abertas" value="12" icon={AlertCircle} tone="danger" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Ocorrências</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  Abra uma ocorrência para reportar um problema.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Pedido Relacionado *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o pedido" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pd1443">PD-1443 - 10/11/2025</SelectItem>
                      <SelectItem value="pd1440">PD-1440 - 09/11/2025</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Produto Afetado *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pao">Pão Francês</SelectItem>
                      <SelectItem value="bolo">Bolo Tapioca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Tipo de Problema *</Label>
                  <Select>
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
                <div className="grid gap-2">
                  <Label>Quantidade Afetada *</Label>
                  <Input type="number" placeholder="Quantidade" />
                </div>
                <div className="grid gap-2">
                  <Label>Descrição do Problema *</Label>
                  <Textarea
                    placeholder="Descreva o problema (mínimo 20 caracteres)"
                    className="min-h-[110px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => setIsDialogOpen(false)}>
                  Abrir Ocorrência
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código do pedido ou ocorrência..."
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
