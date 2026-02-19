"use client";

import { useState } from "react";
import { Building2, Clock3, Plus } from "lucide-react";

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

interface Loja {
  id: string;
  code: string;
  name: string;
  responsible: string;
  limitTime: string;
  receivesSunday: boolean;
  status: "ativo" | "inativo";
}

const mockLojas: Loja[] = [
  {
    id: "1",
    code: "LJ-001",
    name: "Empório do Pão",
    responsible: "Rommel Filho",
    limitTime: "18:00",
    receivesSunday: false,
    status: "ativo",
  },
  {
    id: "2",
    code: "LJ-002",
    name: "Padaria Central",
    responsible: "Carlos Silva",
    limitTime: "17:00",
    receivesSunday: true,
    status: "ativo",
  },
];

const weekDays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function LojasPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredLojas = mockLojas.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Nome" },
    { key: "responsible", header: "Responsável" },
    { key: "limitTime", header: "Horário Limite" },
    {
      key: "receivesSunday",
      header: "Recebe Domingo",
      render: (item: Loja) => (item.receivesSunday ? "Sim" : "Não"),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Loja) => <StatusBadge status={item.status} />,
    },
  ];

  const actions = [
    { icon: "view" as const, label: "Visualizar", onClick: (item: Loja) => console.log("View", item) },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: Loja) => {
        console.log("Edit", item);
        setIsDialogOpen(true);
      },
    },
    {
      icon: "delete" as const,
      label: "Excluir",
      variant: "destructive" as const,
      onClick: (item: Loja) => console.log("Delete", item),
    },
  ];

  return (
    <PageLayout
      title="Gestão de Lojas"
      description="Gerencie as lojas do sistema"
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Lojas" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard title="Registros Ativos" value="2 lojas" icon={Building2} tone="success" />
        <KPICard title="Última Atualização" value="Há 4 dias" icon={Clock3} tone="neutral" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Lojas</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="size-4" />
                Nova Loja
              </Button>
            </DialogTrigger>
            <DialogContent size="3xl">
              <DialogHeader>
                <DialogTitle>Cadastrar Loja</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-2">
                <div>
                  <h3 className="mb-4 text-sm font-semibold">Informações Básicas</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Nome da Loja *</Label>
                      <Input placeholder="Ex: Empório do Pão" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Endereço *</Label>
                      <Input placeholder="Rua X, 123" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Usuário Responsável *</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rommel">Rommel Filho</SelectItem>
                          <SelectItem value="carlos">Carlos Silva</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="loja@email.com" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Telefone</Label>
                      <Input placeholder="(99) 99999-9999" />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="mb-4 text-sm font-semibold">Configurações Operacionais</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>Horário Limite Pedido</Label>
                      <Input type="time" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Expedição (D+X) *</Label>
                      <Select defaultValue="d3">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="d0">D+0</SelectItem>
                          <SelectItem value="d1">D+1</SelectItem>
                          <SelectItem value="d2">D+2</SelectItem>
                          <SelectItem value="d3">D+3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Recebe aos domingos? *</Label>
                      <Select defaultValue="nao">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao">Não</SelectItem>
                          <SelectItem value="sim">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="mb-4 text-sm font-semibold">Horários para Recebimento</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {weekDays.map((day) => (
                      <div key={day} className="flex items-center gap-2">
                        <Label className="w-20">{day}</Label>
                        <Input type="time" className="flex-1" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => setIsDialogOpen(false)}>
                  Cadastrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código ou nome..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            showFilters={false}
          />
          <DataTable data={filteredLojas} columns={columns} actions={actions} keyField="id" stickyHeader />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
