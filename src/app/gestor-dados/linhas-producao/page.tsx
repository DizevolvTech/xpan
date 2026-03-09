"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarDays, Clock3, Layers3, Plus } from "lucide-react";

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
  getProductsByLine,
  getSchedulesByLine,
  productionLines,
  productionSectors,
  sectorsById,
  weeklySchedules,
  type ProductionLine,
} from "@/lib/production-planning";

type LinhaRow = ProductionLine & {
  sectorName: string;
  productCount: number;
  pendingAudits: number;
};

export default function LinhasProducaoPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const lineRows = useMemo<LinhaRow[]>(
    () =>
      productionLines.map((line) => ({
        ...line,
        sectorName: sectorsById.get(line.sectorId)?.name ?? "-",
        productCount: getProductsByLine(line.id).length,
        pendingAudits: getSchedulesByLine(line.id, weeklySchedules).filter((item) => item.status === "pendente")
          .length,
      })),
    [],
  );

  const filteredLinhas = useMemo(
    () =>
      lineRows.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sectorName.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [lineRows, searchTerm],
  );

  const activeLines = lineRows.filter((item) => item.status === "ativo").length;
  const pendingAudits = weeklySchedules.filter((item) => item.status === "pendente").length;

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Subcategoria" },
    { key: "sectorName", header: "Categoria" },
    { key: "type", header: "Tipo" },
    { key: "productCount", header: "Produtos" },
    { key: "operatingHours", header: "Horário" },
    {
      key: "pendingAudits",
      header: "Pend. Auditoria",
      render: (item: LinhaRow) => (
        <span className="text-sm font-semibold text-foreground">{item.pendingAudits}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: LinhaRow) => <StatusBadge status={item.status} />,
    },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Abrir",
      onClick: (item: LinhaRow) => router.push(`/gestor-dados/linhas-producao/${item.id}`),
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: LinhaRow) => {
        console.log("Edit", item);
        setIsDialogOpen(true);
      },
    },
    {
      icon: "delete" as const,
      label: "Excluir",
      variant: "destructive" as const,
      onClick: (item: LinhaRow) => console.log("Delete", item),
    },
  ];

  return (
    <PageLayout
      title="Subcategorias"
      description="Cada subcategoria pertence a uma categoria e consolida os produtos que definem o cronograma."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Subcategorias" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <KPICard title="Subcategorias Ativas" value={`${activeLines} subcategorias`} icon={Layers3} tone="success" />
        <KPICard
          title="Linhas Derivadas"
          value={`${pendingAudits} revisões`}
          icon={CalendarDays}
          tone="warning"
        />
        <KPICard title="Última Atualização" value="Há 1 dia" icon={Clock3} tone="neutral" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Subcategorias</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="size-4" />
                Nova Subcategoria
              </Button>
            </DialogTrigger>
            <DialogContent size="xl">
              <DialogHeader>
                <DialogTitle>Nova Subcategoria</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Nome da Subcategoria *</Label>
                  <Input placeholder="Ex: Linha de Pães" />
                </div>
                <div className="grid gap-2">
                  <Label>Capacidade - Dia (Kg) *</Label>
                  <Input type="number" placeholder="Ex: 900" />
                </div>
                <div className="grid gap-2">
                  <Label>Categoria *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {productionSectors.map((sector) => (
                        <SelectItem key={sector.id} value={sector.id}>
                          {sector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Tipo *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seco">Seco</SelectItem>
                      <SelectItem value="umido">Úmido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Horário de Funcionamento</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input type="time" placeholder="Início" />
                    <Input type="time" placeholder="Fim" />
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
            searchPlaceholder="Buscar por código, subcategoria ou categoria..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            showFilters={false}
          />
          <DataTable data={filteredLinhas} columns={columns} actions={actions} keyField="id" stickyHeader />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
