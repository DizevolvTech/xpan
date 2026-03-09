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
  productionIngredients,
  productionProducts,
  type IngredientCompositionItem,
  type ProductionIngredient,
} from "@/lib/production-planning";

type IngredientRow = ProductionIngredient;

type IngredientFormState = {
  code: string;
  name: string;
  type: ProductionIngredient["type"];
  unit: ProductionIngredient["unit"];
  metadata: string;
  observation: string;
  composition: IngredientCompositionItem[];
};

function buildFormState(ingredient?: IngredientRow | null): IngredientFormState {
  return {
    code: ingredient?.code ?? `IN-${String(Date.now()).slice(-6)}`,
    name: ingredient?.name ?? "",
    type: ingredient?.type ?? "puro",
    unit: ingredient?.unit ?? "Kg",
    metadata: ingredient?.metadata ?? "",
    observation: ingredient?.observation ?? "",
    composition: ingredient?.composition ?? [],
  };
}

export default function IngredientesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientRow | null>(null);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(productionIngredients);
  const [formState, setFormState] = useState<IngredientFormState>(() => buildFormState());
  const [draftComponentId, setDraftComponentId] = useState(productionIngredients[0]?.id ?? "");
  const [draftComponentQty, setDraftComponentQty] = useState("");
  const [draftComponentUnit, setDraftComponentUnit] = useState<ProductionIngredient["unit"]>("Kg");
  const [draftComponentObservation, setDraftComponentObservation] = useState("");

  const filteredIngredients = useMemo(
    () =>
      ingredients.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [ingredients, searchTerm],
  );

  const columns = [
    { key: "code", header: "Código" },
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
        setEditingIngredient(item);
        setFormState(buildFormState(item));
        setIsDialogOpen(true);
      },
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: IngredientRow) => {
        setEditingIngredient(item);
        setFormState(buildFormState(item));
        setIsDialogOpen(true);
      },
    },
  ];

  const productOptions = productionProducts
    .filter((product) => product.canBeIngredient)
    .map((product) => ({ id: product.id, label: `${product.code} · ${product.name}`, type: "produto" as const }));

  const ingredientOptions = ingredients
    .filter((ingredient) => ingredient.status === "ativo")
    .map((ingredient) => ({ id: ingredient.id, label: `${ingredient.code} · ${ingredient.name}`, type: "ingrediente" as const }));

  const compositionOptions = [...ingredientOptions, ...productOptions];

  function openNewIngredient() {
    setEditingIngredient(null);
    setFormState(buildFormState());
    setDraftComponentId(compositionOptions[0]?.id ?? "");
    setDraftComponentQty("");
    setDraftComponentUnit("Kg");
    setDraftComponentObservation("");
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
    setDraftComponentQty("");
    setDraftComponentObservation("");
  }

  function removeCompositionItem(itemId: string) {
    setFormState((current) => ({
      ...current,
      composition: current.composition.filter((item) => item.id !== itemId),
    }));
  }

  function handleSave() {
    const nextIngredient: IngredientRow = {
      id: editingIngredient?.id ?? `ingredient-${Date.now()}`,
      code: editingIngredient?.code ?? formState.code,
      name: formState.name,
      type: formState.type,
      unit: formState.unit,
      metadata: formState.metadata,
      observation: formState.observation,
      composition: formState.type === "misturado" ? formState.composition : [],
      status: "ativo",
    };

    setIngredients((current) => {
      if (!editingIngredient) {
        return [nextIngredient, ...current];
      }

      return current.map((item) => (item.id === editingIngredient.id ? nextIngredient : item));
    });
    setIsDialogOpen(false);
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
        <KPICard title="Última Atualização" value="Há 11 dias" icon={Clock3} tone="neutral" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Ingredientes</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={openNewIngredient}>
                <Plus className="size-4" />
                Novo Ingrediente
              </Button>
            </DialogTrigger>
            <DialogContent size="2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingIngredient ? "Editar Ingrediente" : "Cadastrar Novo Ingrediente"}
                </DialogTitle>
                <DialogDescription>
                  O código permanece imutável após o cadastro. Ingredientes misturados devem detalhar a composição.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-2">
                <div className="grid gap-4 md:grid-cols-2">
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
                    <Label>Código</Label>
                    <Input value={formState.code} disabled className="bg-muted" />
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
                        <SelectItem value="Kg">Kg</SelectItem>
                        <SelectItem value="L">Litros</SelectItem>
                        <SelectItem value="g">Gramas</SelectItem>
                        <SelectItem value="Un">Unidades</SelectItem>
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
                  unitOptions={["Kg", "L", "g", "Un"]}
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
                    onRemove={removeCompositionItem}
                  />
                ) : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSave}>
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
