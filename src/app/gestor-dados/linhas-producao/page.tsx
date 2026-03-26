"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import type { ProductionLine } from "@/lib/production-planning";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";

type LinhaRow = ProductionLine & {
  sectorName: string;
  productCount: number;
  masterProductCount: number;
  pendingAudits: number;
};

type SubcategoryFormState = {
  name: string;
  sectorId: string;
  type: ProductionLine["type"];
  operatingHours: string;
  capacityPerDayKg: number;
  status: ProductionLine["status"];
};

function buildFormState(
  sectors: Array<{ id: string }>,
  line?: ProductionLine | null,
): SubcategoryFormState {
  return {
    name: line?.name ?? "",
    sectorId: line?.sectorId ?? sectors[0]?.id ?? "",
    type: line?.type ?? "Seco",
    operatingHours: line?.operatingHours ?? "05:00 - 14:00",
    capacityPerDayKg: line?.capacityPerDayKg ?? 900,
    status: line?.status ?? "ativo",
  };
}

export default function LinhasProducaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<LinhaRow | null>(null);
  const [formState, setFormState] = useState<SubcategoryFormState>(() => buildFormState([]));
  const [formBaseline, setFormBaseline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formDirty = isDialogOpen && JSON.stringify(formState) !== formBaseline;
  const formGuard = useUnsavedChangesGuard({
    enabled: isDialogOpen,
    isDirty: formDirty,
  });

  const sectorNameById = useMemo(
    () => new Map(snapshot.sectors.map((sector) => [sector.id, sector.name])),
    [snapshot.sectors],
  );

  const lineRows = useMemo<LinhaRow[]>(
    () =>
      snapshot.lines.map((line) => ({
        ...line,
        sectorName: sectorNameById.get(line.sectorId) ?? "-",
        productCount: snapshot.products.filter(
          (product) => product.operationalLineId === line.id && product.active,
        ).length,
        masterProductCount: snapshot.products.filter(
          (product) => (product.masterLineId ?? product.lineId) === line.id,
        ).length,
        pendingAudits: snapshot.schedules.filter(
          (schedule) => schedule.lineId === line.id && schedule.status === "pendente",
        ).length,
      })),
    [sectorNameById, snapshot.lines, snapshot.products, snapshot.schedules],
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
  const pendingAudits = snapshot.schedules.filter((item) => item.status === "pendente").length;

  useEffect(() => {
    const shouldCreate = searchParams.get("new") === "1";
    const sectorIdFromQuery = searchParams.get("sectorId");

    if (!shouldCreate || snapshot.sectors.length === 0 || isDialogOpen) {
      return;
    }

    const nextFormState = buildFormState(snapshot.sectors);
    if (sectorIdFromQuery && snapshot.sectors.some((sector) => sector.id === sectorIdFromQuery)) {
      nextFormState.sectorId = sectorIdFromQuery;
    }

    setEditingLine(null);
    setFormState(nextFormState);
    setFormBaseline(JSON.stringify(nextFormState));
    setFormError(null);
    setIsDialogOpen(true);
    router.replace("/gestor-dados/linhas-producao");
  }, [isDialogOpen, router, searchParams, snapshot.sectors]);

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Linha de produção" },
    { key: "sectorName", header: "Categoria" },
    { key: "type", header: "Tipo" },
    {
      key: "productCount",
      header: "Produtos",
      render: (item: LinhaRow) => (
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">{item.productCount} operacionais</p>
          <p className="text-xs text-muted-foreground">{item.masterProductCount} no cadastro base</p>
        </div>
      ),
    },
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
        setEditingLine(item);
        const nextFormState = buildFormState(snapshot.sectors, item);
        setFormState(nextFormState);
        setFormBaseline(JSON.stringify(nextFormState));
        setFormError(null);
        setIsDialogOpen(true);
      },
    },
  ];

  function openNewLine() {
    setEditingLine(null);
    const nextFormState = buildFormState(snapshot.sectors);
    setFormState(nextFormState);
    setFormBaseline(JSON.stringify(nextFormState));
    setFormError(null);
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!formState.name.trim() || !formState.sectorId) {
      setFormError("Informe nome e categoria da linha de produção.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(
        editingLine
          ? `/api/master-data/subcategories/${editingLine.id}`
          : "/api/master-data/subcategories",
        {
          method: editingLine ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formState),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao salvar linha de produção");
      }

      await refresh();
      setIsDialogOpen(false);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error ? saveError.message : "Falha ao salvar linha de produção",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageLayout
      title="Linhas de produção"
      description="Cada linha de produção pertence a uma categoria e controla o cronograma ativo usado na operação e na auditoria."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Linhas de produção" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <KPICard title="Linhas ativas" value={`${activeLines} linhas`} icon={Layers3} tone="success" />
        <KPICard
          title="Auditorias pendentes"
          value={`${pendingAudits} revisões`}
          icon={CalendarDays}
          tone="warning"
        />
        <KPICard
          title="Última Atualização"
          value={isLoading ? "Carregando..." : `${lineRows.length} cadastradas`}
          icon={Clock3}
          tone="neutral"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de linhas de produção</CardTitle>
          <Button type="button" onClick={openNewLine} disabled={isSubmitting}>
            <Plus className="size-4" />
            Nova linha de produção
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código, linha de produção ou categoria..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            showFilters={false}
          />
          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
              {error}
            </div>
          ) : null}
          <DataTable
            data={filteredLinhas}
            columns={columns}
            actions={actions}
            keyField="id"
            onRowClick={(item) => router.push(`/gestor-dados/linhas-producao/${item.id}`)}
            stickyHeader
            emptyMessage={
              isLoading
                ? "Carregando linhas de produção..."
                : "Nenhuma linha de produção encontrada"
            }
          />
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (!formGuard.confirmIfNeeded()) {
              return;
            }
            setFormError(null);
          }
          setIsDialogOpen(open);
        }}
      >
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>
              {editingLine ? "Editar linha de produção" : "Nova linha de produção"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {formError ? (
              <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
                {formError}
              </div>
            ) : null}
            {formDirty ? (
              <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                Existem alterações pendentes nesta linha de produção.
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Nome completo da linha de produção *</Label>
              <Input
                placeholder="Ex: Linha de Pães"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Capacidade - Dia (Kg) *</Label>
              <Input
                type="number"
                value={formState.capacityPerDayKg}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    capacityPerDayKg: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Categoria *</Label>
              <Select
                value={formState.sectorId}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, sectorId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {snapshot.sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select
                value={formState.type}
                onValueChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    type: value as ProductionLine["type"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Seco">Seco</SelectItem>
                  <SelectItem value="Úmido">Úmido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Horário de Funcionamento</Label>
              <Input
                value={formState.operatingHours}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, operatingHours: event.target.value }))
                }
                placeholder="05:00 - 14:00"
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formState.status}
                onValueChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    status: value as ProductionLine["status"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!formGuard.confirmIfNeeded()) {
                  return;
                }
                setIsDialogOpen(false);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isSubmitting}>
              {editingLine ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
