"use client";

import { useMemo, useState } from "react";
import { Clock3, Package, Plus } from "lucide-react";

import { IngredientCompositionEditor } from "@/components/production/ingredient-composition-editor";
import { IngredientProfileFields } from "@/components/production/ingredient-profile-fields";
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
import {
  type IngredientCompositionItem,
  type ProductionIngredient,
} from "@/lib/production-planning";
import {
  getOperationalUnitLabel,
  getOperationalUnitOptions,
} from "@/lib/operational-units";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";

type IngredientRow = ProductionIngredient;

type IngredientFormState = {
  code: string;
  externalCode: string;
  name: string;
  type: ProductionIngredient["type"];
  unit: ProductionIngredient["unit"];
  metadata: string;
  observation: string;
  composition: IngredientCompositionItem[];
};
type IngredientDialogMode = "view" | "edit";

function buildFormState(ingredient?: IngredientRow | null): IngredientFormState {
  return {
    code: ingredient?.code ?? `IN-${String(Date.now()).slice(-6)}`,
    externalCode: ingredient?.externalCode ?? "",
    name: ingredient?.name ?? "",
    type: ingredient?.type ?? "puro",
    unit: ingredient?.unit ?? "Kg",
    metadata: ingredient?.metadata ?? "",
    observation: ingredient?.observation ?? "",
    composition: ingredient?.composition ?? [],
  };
}

export default function IngredientesPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientRow | null>(null);
  const [dialogMode, setDialogMode] = useState<IngredientDialogMode>("edit");
  const [formState, setFormState] = useState<IngredientFormState>(() => buildFormState());
  const [formBaseline, setFormBaseline] = useState("");
  const [draftComponentId, setDraftComponentId] = useState("");
  const [draftComponentQty, setDraftComponentQty] = useState("");
  const [draftComponentUnit, setDraftComponentUnit] = useState<ProductionIngredient["unit"]>("Kg");
  const [draftComponentObservation, setDraftComponentObservation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isReadOnly = dialogMode === "view";
  const formDirty =
    isDialogOpen &&
    !isReadOnly &&
    JSON.stringify({
      formState,
      draftComponentId,
      draftComponentQty,
      draftComponentUnit,
      draftComponentObservation,
    }) !== formBaseline;
  const formGuard = useUnsavedChangesGuard({
    enabled: isDialogOpen && !isReadOnly,
    isDirty: formDirty,
  });

  const ingredients = snapshot.ingredients;

  const filteredIngredients = useMemo(
    () =>
      ingredients.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.externalCode ?? "").toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [ingredients, searchTerm],
  );

  const columns = [
    { key: "code", header: "Código XPAN" },
    {
      key: "externalCode",
      header: "Código ERP",
      render: (item: IngredientRow) => item.externalCode || "-",
    },
    { key: "name", header: "Nome" },
    { key: "type", header: "Tipo" },
    { key: "unit", header: "Un. Medida" },
    {
      key: "components",
      header: "Composição",
      render: (item: IngredientRow) =>
        item.type === "misturado" ? `${item.composition.length} componentes` : "N/A",
    },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: IngredientRow) => {
        setDialogMode("view");
        setEditingIngredient(item);
        setFormState(buildFormState(item));
        setFormBaseline(
          JSON.stringify({
            formState: buildFormState(item),
            draftComponentId: "",
            draftComponentQty: "",
            draftComponentUnit: "Kg",
            draftComponentObservation: "",
          }),
        );
        setFormError(null);
        setIsDialogOpen(true);
      },
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: IngredientRow) => {
        setDialogMode("edit");
        setEditingIngredient(item);
        setFormState(buildFormState(item));
        setFormBaseline(
          JSON.stringify({
            formState: buildFormState(item),
            draftComponentId: "",
            draftComponentQty: "",
            draftComponentUnit: "Kg",
            draftComponentObservation: "",
          }),
        );
        setFormError(null);
        setIsDialogOpen(true);
      },
    },
  ];

  const productOptions = snapshot.products
    .filter((product) => product.canBeIngredient)
    .map((product) => ({ id: product.id, label: `${product.code} · ${product.name}`, type: "produto" as const }));

  const ingredientOptions = ingredients
    .filter((ingredient) => ingredient.status === "ativo")
    .map((ingredient) => ({ id: ingredient.id, label: `${ingredient.code} · ${ingredient.name}`, type: "ingrediente" as const }));

  const compositionOptions = [...ingredientOptions, ...productOptions];
  const ingredientUnitOptions = useMemo(
    () =>
      getOperationalUnitOptions(
        formState.unit,
        draftComponentUnit,
        ...formState.composition.map((item) => item.unit),
      ),
    [draftComponentUnit, formState.composition, formState.unit],
  );

  function openNewIngredient() {
    setDialogMode("edit");
    setEditingIngredient(null);
    const nextFormState = buildFormState();
    setFormState(nextFormState);
    setDraftComponentId("");
    setDraftComponentQty("");
    setDraftComponentUnit("Kg");
    setDraftComponentObservation("");
    setFormBaseline(
      JSON.stringify({
        formState: nextFormState,
        draftComponentId: "",
        draftComponentQty: "",
        draftComponentUnit: "Kg",
        draftComponentObservation: "",
      }),
    );
    setFormError(null);
  }

  function addCompositionItem() {
    if (!draftComponentId || !draftComponentQty) {
      return;
    }

    const selectedIngredient = ingredientOptions.find((item) => item.id === draftComponentId);
    const selectedProduct = productOptions.find((item) => item.id === draftComponentId);
    const quantity = Number(draftComponentQty);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    setFormState((current) => ({
      ...current,
      composition: [
        ...current.composition,
        {
          id: `component-${Date.now()}`,
          ingredientId: selectedIngredient?.id,
          productId: selectedProduct?.id,
          name: selectedIngredient?.label ?? selectedProduct?.label ?? draftComponentId,
          quantity,
          unit: draftComponentUnit,
          observation: draftComponentObservation.trim(),
        },
      ],
    }));
    setDraftComponentId("");
    setDraftComponentQty("");
    setDraftComponentObservation("");
  }

  function removeCompositionItem(itemId: string) {
    setFormState((current) => ({
      ...current,
      composition: current.composition.filter((item) => item.id !== itemId),
    }));
  }

  function updateCompositionItem(
    itemId: string,
    patch: Partial<Pick<IngredientCompositionItem, "quantity" | "unit" | "observation">>,
  ) {
    setFormState((current) => ({
      ...current,
      composition: current.composition.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: patch.quantity ?? item.quantity,
              unit: patch.unit ?? item.unit,
              observation: patch.observation ?? item.observation,
            }
          : item,
      ),
    }));
  }

  function moveCompositionItem(itemId: string, direction: "up" | "down") {
    setFormState((current) => {
      const currentIndex = current.composition.findIndex((item) => item.id === itemId);
      if (currentIndex === -1) {
        return current;
      }

      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= current.composition.length) {
        return current;
      }

      const nextComposition = [...current.composition];
      const [movedItem] = nextComposition.splice(currentIndex, 1);
      nextComposition.splice(nextIndex, 0, movedItem);

      return {
        ...current,
        composition: nextComposition,
      };
    });
  }

  async function handleSave() {
    if (!formState.name.trim()) {
      setFormError("Informe o nome do ingrediente.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(
        editingIngredient
          ? `/api/master-data/ingredients/${editingIngredient.id}`
          : "/api/master-data/ingredients",
        {
          method: editingIngredient ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formState,
            status: editingIngredient?.status ?? "ativo",
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao salvar ingrediente");
      }

      await refresh();
      setIsDialogOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Falha ao salvar ingrediente");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageLayout
      title="Gestão de Ingredientes"
      description="Cadastre ingredientes puros, misturados e suas composições com rastreabilidade."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Ingredientes" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard title="Registros Ativos" value={`${ingredients.length} ingredientes`} icon={Package} tone="success" />
        <KPICard
          title="Última Atualização"
          value={isLoading ? "Carregando..." : `${ingredients.filter((item) => item.status === "ativo").length} ativos`}
          icon={Clock3}
          tone="neutral"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Ingredientes</CardTitle>
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
            <DialogTrigger asChild>
              <Button type="button" onClick={openNewIngredient}>
                <Plus className="size-4" />
                Novo Ingrediente
              </Button>
            </DialogTrigger>
            <DialogContent size="2xl">
              <DialogHeader>
                <DialogTitle>
                  {!editingIngredient
                    ? "Cadastrar Novo Ingrediente"
                    : isReadOnly
                      ? "Visualizar Ingrediente"
                      : "Editar Ingrediente"}
                </DialogTitle>
                <DialogDescription>
                  {isReadOnly
                    ? "Consulte o cadastro técnico, a composição e o código ERP sem alterar o ingrediente."
                    : "O código XPAN permanece imutável após o cadastro. Use o Código ERP para integrar com sistemas externos e detalhe a composição quando o ingrediente for misturado."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-2">
                {formError ? (
                  <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
                    {formError}
                  </div>
                ) : null}
                {isReadOnly ? (
                  <div className="rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm text-info-foreground">
                    Modo visualização: use o lápis para editar este ingrediente.
                  </div>
                ) : null}
                {formDirty ? (
                  <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                    Existem alterações pendentes neste ingrediente.
                  </div>
                ) : null}

                <fieldset disabled={isReadOnly} className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="ingredient-name">Nome do Ingrediente *</Label>
                    <Input
                      id="ingredient-name"
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Ex: Mistura Pão"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Código XPAN</Label>
                    <Input value={formState.code} disabled className="bg-muted" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ingredient-external-code">Código ERP</Label>
                    <Input
                      id="ingredient-external-code"
                      value={formState.externalCode}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, externalCode: event.target.value }))
                      }
                      placeholder="Código externo do ERP"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo *</Label>
                    <Select
                      value={formState.type}
                      onValueChange={(value) =>
                        setFormState((current) => ({
                          ...current,
                          type: value as IngredientRow["type"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="puro">Puro</SelectItem>
                        <SelectItem value="misturado">Misturado (MPI)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Unidade de Medida *</Label>
                    <Select
                      value={formState.unit}
                      onValueChange={(value) =>
                        setFormState((current) => ({
                          ...current,
                          unit: value as IngredientRow["unit"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ingredientUnitOptions.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {getOperationalUnitLabel(unit)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <IngredientProfileFields
                  profile={{
                    unit: formState.unit,
                    metadata: formState.metadata,
                    observation: formState.observation,
                  }}
                  unitOptions={ingredientUnitOptions}
                  showWeightKg={false}
                  metadataLabel="Metadados / Uso"
                  metadataPlaceholder="Ex: MPI de confeitaria usada como base"
                  observationPlaceholder="Explique o uso deste ingrediente na receita."
                  onChange={(patch) =>
                    setFormState((current) => ({
                      ...current,
                      unit: (patch.unit as IngredientRow["unit"] | undefined) ?? current.unit,
                      metadata: patch.metadata ?? current.metadata,
                      observation: patch.observation ?? current.observation,
                    }))
                  }
                />

                {formState.type === "misturado" ? (
                  <IngredientCompositionEditor
                    title="Composição do Misturado"
                    description="Informe os componentes da mistura em quantidade e observação operacional por item."
                    composition={formState.composition}
                    emptyMessage="Nenhum componente adicionado."
                    options={compositionOptions.map((option) => ({ id: option.id, label: option.label }))}
                    draft={{
                      componentId: draftComponentId,
                      quantity: draftComponentQty,
                      unit: draftComponentUnit,
                      observation: draftComponentObservation,
                    }}
                    unitOptions={ingredientUnitOptions}
                    onDraftChange={(patch) => {
                      if (patch.componentId !== undefined) {
                        setDraftComponentId(patch.componentId);
                      }
                      if (patch.quantity !== undefined) {
                        setDraftComponentQty(patch.quantity);
                      }
                      if (patch.unit !== undefined) {
                        setDraftComponentUnit(patch.unit as IngredientRow["unit"]);
                      }
                      if (patch.observation !== undefined) {
                        setDraftComponentObservation(patch.observation);
                      }
                    }}
                    onAdd={addCompositionItem}
                    onMove={moveCompositionItem}
                    onRemove={removeCompositionItem}
                    onUpdate={updateCompositionItem}
                  />
                ) : null}
                </fieldset>
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
                >
                  {isReadOnly ? "Fechar" : "Cancelar"}
                </Button>
                {!isReadOnly ? (
                  <Button type="button" onClick={() => void handleSave()} disabled={isSubmitting}>
                    {editingIngredient ? "Salvar Alterações" : "Cadastrar Ingrediente"}
                  </Button>
                ) : null}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código XPAN, ERP ou nome..."
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
            data={filteredIngredients}
            columns={columns}
            actions={actions}
            keyField="id"
            onRowClick={(item) => {
              setDialogMode("view");
              setEditingIngredient(item);
              const nextFormState = buildFormState(item);
              setFormState(nextFormState);
              setFormBaseline(
                JSON.stringify({
                  formState: nextFormState,
                  draftComponentId: "",
                  draftComponentQty: "",
                  draftComponentUnit: "Kg",
                  draftComponentObservation: "",
                }),
              );
              setFormError(null);
              setIsDialogOpen(true);
            }}
            emptyMessage={isLoading ? "Carregando ingredientes..." : "Nenhum ingrediente encontrado"}
            stickyHeader
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
