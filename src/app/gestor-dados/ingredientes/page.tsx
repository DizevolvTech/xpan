"use client";

import { useState } from "react";
import { Plus, Package, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
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

interface Ingredient {
  id: string;
  code: string;
  name: string;
  type: string;
  unit: string;
}

const mockIngredients: Ingredient[] = [
  { id: "1", code: "IN-572015", name: "Farinha", type: "Puro", unit: "Kg" },
  { id: "2", code: "IN-572016", name: "Açúcar", type: "Puro", unit: "Kg" },
  { id: "3", code: "IN-572017", name: "Fermento", type: "Puro", unit: "Kg" },
  { id: "4", code: "IN-572018", name: "Mistura Pão", type: "Misturado", unit: "Kg" },
  { id: "5", code: "IN-572019", name: "Leite", type: "Puro", unit: "Litros" },
];

export default function IngredientesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  const filteredIngredients = mockIngredients.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Nome" },
    { key: "type", header: "Tipo" },
    { key: "unit", header: "Un. Medida" },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: Ingredient) => console.log("View", item),
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: Ingredient) => {
        setEditingIngredient(item);
        setIsDialogOpen(true);
      },
    },
    {
      icon: "delete" as const,
      label: "Excluir",
      variant: "destructive" as const,
      onClick: (item: Ingredient) => console.log("Delete", item),
    },
  ];

  return (
    <PageLayout
      title="Gestão de Ingredientes"
      description="Gerencie os ingredientes do sistema"
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Ingredientes" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard title="Registros Ativos" value="29 ingredientes" icon={Package} tone="success" />
        <KPICard title="Última Atualização" value="Há 11 dias" icon={Clock3} tone="neutral" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Ingredientes</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={() => setEditingIngredient(null)}>
                <Plus className="size-4" />
                Novo Ingrediente
              </Button>
            </DialogTrigger>
            <DialogContent size="xl">
              <DialogHeader>
                <DialogTitle>
                  {editingIngredient ? "Editar Ingrediente" : "Cadastrar Novo Ingrediente"}
                </DialogTitle>
                <DialogDescription>
                  {editingIngredient
                    ? "Edite os dados do ingrediente"
                    : "Preencha os dados do novo ingrediente"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome do Ingrediente *</Label>
                  <Input id="name" placeholder="Ex: Farinha" defaultValue={editingIngredient?.name} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Tipo *</Label>
                  <Select defaultValue={editingIngredient?.type || "puro"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="puro">Puro</SelectItem>
                      <SelectItem value="misturado">Misturado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unit">Unidade de Medida *</Label>
                  <Select defaultValue={editingIngredient?.unit || "kg"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="litros">Litros</SelectItem>
                      <SelectItem value="g">Gramas</SelectItem>
                      <SelectItem value="un">Unidades</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingIngredient && (
                  <div className="grid gap-2">
                    <Label>Código</Label>
                    <Input value={editingIngredient.code} disabled className="bg-muted" />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => setIsDialogOpen(false)}>
                  {editingIngredient ? "Salvar Alterações" : "Cadastrar Ingrediente"}
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
          <DataTable
            data={filteredIngredients}
            columns={columns}
            actions={actions}
            keyField="id"
            emptyMessage="Nenhum ingrediente encontrado"
            stickyHeader
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
