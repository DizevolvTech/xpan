"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Building, Clock3, Plus } from "lucide-react";

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
import {
  getLinesBySector,
  productionSectors,
  type ProductionSector,
} from "@/lib/production-planning";

type SetorRow = ProductionSector & {
  lines: number;
};

const setorRows: SetorRow[] = productionSectors.map((sector) => ({
  ...sector,
  lines: getLinesBySector(sector.id).length,
}));

const responsibleOptions = Array.from(new Set(productionSectors.map((sector) => sector.responsible)));

export default function SetoresPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSetor, setEditingSetor] = useState<SetorRow | null>(null);

  const filteredSetores = useMemo(
    () =>
      setorRows.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm],
  );

  const activeCount = setorRows.filter((item) => item.status === "ativo").length;

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Nome" },
    { key: "lines", header: "Nº Linhas" },
    {
      key: "status",
      header: "Status",
      render: (item: SetorRow) => <StatusBadge status={item.status} />,
    },
    { key: "responsible", header: "Responsável" },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: SetorRow) => router.push(`/gestor-dados/setores/${item.id}`),
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: SetorRow) => {
        setEditingSetor(item);
        setIsDialogOpen(true);
      },
    },
    {
      icon: "delete" as const,
      label: "Excluir",
      variant: "destructive" as const,
      onClick: (item: SetorRow) => console.log("Delete", item),
    },
  ];

  return (
    <PageLayout
      title="Gestão de Setores"
      description="Gerencie os setores do sistema"
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Setores" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard title="Registros Ativos" value={`${activeCount} setores`} icon={Building} tone="success" />
        <KPICard title="Última Atualização" value="Há 2 dias" icon={Clock3} tone="neutral" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Setores</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={() => setEditingSetor(null)}>
                <Plus className="size-4" />
                Novo Setor
              </Button>
            </DialogTrigger>
            <DialogContent size="lg">
              <DialogHeader>
                <DialogTitle>{editingSetor ? "Editar Setor" : "Cadastrar Novo Setor"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Nome do Setor *</Label>
                  <Input placeholder="Ex: Confeitaria" defaultValue={editingSetor?.name} />
                </div>
                <div className="grid gap-2">
                  <Label>Usuário Responsável *</Label>
                  <Select defaultValue={editingSetor?.responsible ?? responsibleOptions[0]}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {responsibleOptions.map((responsible) => (
                        <SelectItem key={responsible} value={responsible}>
                          {responsible}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Descrição do Setor</Label>
                  <Input placeholder="Descrição..." />
                </div>
                {editingSetor && (
                  <div className="grid gap-2">
                    <Label>Código</Label>
                    <Input value={editingSetor.code} disabled className="bg-muted" />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => setIsDialogOpen(false)}>
                  {editingSetor ? "Salvar" : "Cadastrar"}
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
          <DataTable data={filteredSetores} columns={columns} actions={actions} keyField="id" stickyHeader />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
