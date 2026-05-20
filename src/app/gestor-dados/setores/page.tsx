"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Building, Clock3, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ProductionSector } from "@/lib/production-planning";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";

type SetorRow = ProductionSector & {
  lines: number;
};

type CategoryFormState = {
  name: string;
  responsible: string;
  status: ProductionSector["status"];
};

function buildFormState(category?: ProductionSector | null): CategoryFormState {
  return {
    name: category?.name ?? "",
    responsible: category?.responsible ?? "",
    status: category?.status ?? "ativo",
  };
}

export default function SetoresPage() {
  const router = useRouter();
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSetor, setEditingSetor] = useState<SetorRow | null>(null);
  const [formState, setFormState] = useState<CategoryFormState>(() => buildFormState());
  const [formBaseline, setFormBaseline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formDirty = isDialogOpen && JSON.stringify(formState) !== formBaseline;
  const formGuard = useUnsavedChangesGuard({
    enabled: isDialogOpen,
    isDirty: formDirty,
  });

  const setorRows = useMemo<SetorRow[]>(
    () =>
      snapshot.sectors.map((sector) => ({
        ...sector,
        lines: snapshot.lines.filter((line) => line.sectorId === sector.id).length,
      })),
    [snapshot.lines, snapshot.sectors],
  );

  const filteredSetores = useMemo(
    () =>
      setorRows.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, setorRows],
  );

  const activeCount = setorRows.filter((item) => item.status === "ativo").length;

  const columns = [
    {
      key: "code",
      header: "Código",
      render: (item: SetorRow) => (
        <span className="text-sm font-medium tabular-nums text-foreground">{item.code}</span>
      ),
    },
    {
      key: "name",
      header: "Categoria",
      render: (item: SetorRow) => (
        <span className="text-sm font-semibold text-foreground">{item.name}</span>
      ),
    },
    {
      key: "lines",
      header: "Linhas",
      render: (item: SetorRow) => (
        <span className="text-sm tabular-nums text-foreground">{item.lines}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: SetorRow) => <StatusBadge status={item.status} />,
    },
    {
      key: "responsible",
      header: "Responsável",
      render: (item: SetorRow) => (
        <span className="text-sm text-foreground">{item.responsible?.trim() || "—"}</span>
      ),
    },
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
        const nextFormState = buildFormState(item);
        setFormState(nextFormState);
        setFormBaseline(JSON.stringify(nextFormState));
        setFormError(null);
        setIsDialogOpen(true);
      },
    },
  ];

  function openNewCategory() {
    setEditingSetor(null);
    const nextFormState = buildFormState();
    setFormState(nextFormState);
    setFormBaseline(JSON.stringify(nextFormState));
    setFormError(null);
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!formState.name.trim() || !formState.responsible.trim()) {
      setFormError("Informe nome e responsável da categoria.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(
        editingSetor
          ? `/api/master-data/categories/${editingSetor.id}`
          : "/api/master-data/categories",
        {
          method: editingSetor ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formState),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao salvar categoria");
      }

      await refresh();
      setIsDialogOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Falha ao salvar categoria");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageLayout
      title="Gestão de Categorias"
      description="Categorias macro da operação e seus responsáveis."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Categorias" },
      ]}
      actions={
        <Button type="button" onClick={openNewCategory} disabled={isSubmitting}>
          <Plus className="size-4" />
          Nova Categoria
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard title="Categorias Ativas" value={`${activeCount} categorias`} icon={Building} tone="success" />
        <KPICard
          title="Total Cadastradas"
          value={isLoading ? "Carregando..." : `${setorRows.length} categorias`}
          icon={Clock3}
          tone="neutral"
        />
      </div>

      <section className="space-y-3">
        <SearchFilter
          searchPlaceholder="Buscar por código ou nome..."
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
          data={filteredSetores}
          columns={columns}
          actions={actions}
          keyField="id"
          onRowClick={(item) => router.push(`/gestor-dados/setores/${item.id}`)}
          stickyHeader
          emptyMessage={isLoading ? "Carregando categorias..." : "Nenhuma categoria encontrada"}
        />
      </section>

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
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editingSetor ? "Editar Categoria" : "Cadastrar Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {formError ? (
              <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
                {formError}
              </div>
            ) : null}
            {formDirty ? (
              <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                Existem alterações pendentes nesta categoria.
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Nome completo da categoria *</Label>
              <Input
                placeholder="Ex: Confeitaria"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Responsável *</Label>
              <Input
                value={formState.responsible}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, responsible: event.target.value }))
                }
                placeholder="Nome do responsável"
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formState.status}
                onValueChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    status: value as ProductionSector["status"],
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
            {editingSetor ? (
              <div className="grid gap-2">
                <Label>Código</Label>
                <Input value={editingSetor.code} disabled className="bg-muted" />
              </div>
            ) : null}
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
              {editingSetor ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
