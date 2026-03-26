"use client";

import { useMemo, useState } from "react";
import { Clock3, Package, Plus } from "lucide-react";

import { IngredientCompositionEditor } from "@/components/production/ingredient-composition-editor";
import { IngredientProfileFields } from "@/components/production/ingredient-profile-fields";
import { ProductFormDialog } from "@/components/production/product-form-dialog";
import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { PageLayout } from "@/components/shared/page-layout";
import { SearchFilter } from "@/components/shared/search-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type IngredientCompositionItem,
  type ProductionIngredient,
  type ProductionProduct,
} from "@/lib/production-planning";
import {
  getOperationalUnitLabel,
  getOperationalUnitOptions,
} from "@/lib/operational-units";
import { validateIngredientFormState } from "@/lib/ingredient-form-logic";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";

type IngredientRow = ProductionIngredient;

type IngredientFormState = {
  code: string;
  externalCode: string;
  name: string;
  shortName: string;
  type: ProductionIngredient["type"];
  unit: ProductionIngredient["unit"];
  purchaseUnit: ProductionIngredient["purchaseUnit"];
  purchaseToConsumptionFactor: number;
  metadata: string;
  observation: string;
  composition: IngredientCompositionItem[];
};

type IngredientDialogMode = "view" | "edit";

type IngredientListRow = {
  rowKey: string;
  rowKind: "ingredient" | "mpiProduct";
  code: string;
  externalCode: string;
  name: string;
  shortName: string;
  typeLabel: string;
  unitLabel: string;
  compositionLabel: string;
  ingredient?: ProductionIngredient;
  product?: ProductionProduct;
};

function buildFormState(ingredient?: IngredientRow | null): IngredientFormState {
  return {
    code: ingredient?.code ?? `IN-${String(Date.now()).slice(-6)}`,
    externalCode: ingredient?.externalCode ?? "",
    name: ingredient?.name ?? "",
    shortName: ingredient?.shortName ?? "",
    type: ingredient?.type ?? "puro",
    unit: ingredient?.unit ?? "Kg",
    purchaseUnit: ingredient?.purchaseUnit ?? ingredient?.unit ?? "Kg",
    purchaseToConsumptionFactor:
      ingredient?.purchaseToConsumptionFactor && ingredient.purchaseToConsumptionFactor > 0
        ? ingredient.purchaseToConsumptionFactor
        : 1,
    metadata: ingredient?.metadata ?? "",
    observation: ingredient?.observation ?? "",
    composition: ingredient?.composition ?? [],
  };
}

function renderTypeBadge(row: IngredientListRow) {
  const toneClass =
    row.rowKind === "mpiProduct"
      ? "border-info/40 bg-info/10 text-info-foreground"
      : row.ingredient?.type === "misturado"
        ? "border-warning/40 bg-warning/20 text-warning-foreground"
        : "border-border/70 bg-panel/40 text-foreground";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {row.typeLabel}
    </span>
  );
}

export default function IngredientesPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");

  const [isIngredientDialogOpen, setIsIngredientDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientRow | null>(null);
  const [ingredientDialogMode, setIngredientDialogMode] = useState<IngredientDialogMode>("edit");
  const [formState, setFormState] = useState<IngredientFormState>(() => buildFormState());
  const [formBaseline, setFormBaseline] = useState("");
  const [draftComponentId, setDraftComponentId] = useState("");
  const [draftComponentQty, setDraftComponentQty] = useState("");
  const [draftComponentUnit, setDraftComponentUnit] = useState<ProductionIngredient["unit"]>("Kg");
  const [draftComponentObservation, setDraftComponentObservation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductionProduct | null>(null);
  const [productDialogMode, setProductDialogMode] = useState<"view" | "edit">("view");

  const isReadOnly = ingredientDialogMode === "view";
  const formDirty =
    isIngredientDialogOpen &&
    !isReadOnly &&
    JSON.stringify({
      formState,
      draftComponentId,
      draftComponentQty,
      draftComponentUnit,
      draftComponentObservation,
    }) !== formBaseline;
  const formGuard = useUnsavedChangesGuard({
    enabled: isIngredientDialogOpen && !isReadOnly,
    isDirty: formDirty,
  });

  const ingredients = snapshot.ingredients;
  const mpiProducts = useMemo(
    () => snapshot.products.filter((product) => product.canBeIngredient),
    [snapshot.products],
  );

  const ingredientRows = useMemo<IngredientListRow[]>(
    () =>
      ingredients.map((ingredient) => ({
        rowKey: `ingredient-${ingredient.id}`,
        rowKind: "ingredient",
        code: ingredient.code,
        externalCode: ingredient.externalCode ?? "",
        name: ingredient.name,
        shortName: ingredient.shortName ?? "",
        typeLabel: ingredient.type === "misturado" ? "Ingrediente misturado" : "Ingrediente puro",
        unitLabel: getOperationalUnitLabel(ingredient.unit),
        compositionLabel:
          ingredient.type === "misturado"
            ? `${ingredient.composition.length} componentes`
            : "N/A",
        ingredient,
      })),
    [ingredients],
  );

  const mpiRows = useMemo<IngredientListRow[]>(
    () =>
      mpiProducts.map((product) => ({
        rowKey: `mpi-product-${product.id}`,
        rowKind: "mpiProduct",
        code: product.code,
        externalCode: product.externalCode ?? "",
        name: product.name,
        shortName: product.shortName ?? "",
        typeLabel: "Produto MPI",
        unitLabel: getOperationalUnitLabel(
          product.ingredientProfile?.unit ?? product.unitProfiles.sales.unit,
        ),
        compositionLabel: `${product.recipe.length} itens da receita`,
        product,
      })),
    [mpiProducts],
  );

  const filteredRows = useMemo(
    () =>
      [...ingredientRows, ...mpiRows].filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.externalCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.typeLabel.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [ingredientRows, mpiRows, searchTerm],
  );

  const columns = [
    { key: "code", header: "Código XPAN" },
    {
      key: "externalCode",
      header: "Código ERP",
      render: (item: IngredientListRow) => item.externalCode || "-",
    },
    { key: "name", header: "Nome completo" },
    {
      key: "shortName",
      header: "Nome reduzido",
      render: (item: IngredientListRow) => item.shortName || "-",
    },
    {
      key: "typeLabel",
      header: "Tipo",
      render: (item: IngredientListRow) => renderTypeBadge(item),
    },
    { key: "unitLabel", header: "Un. Medida" },
    { key: "compositionLabel", header: "Composição" },
  ];

  const productOptions = mpiProducts.map((product) => ({
    id: product.id,
    label: `${product.code} · ${product.name}`,
    description: product.shortName?.trim() ? `Nome reduzido: ${product.shortName}` : undefined,
    keywords: [product.code, product.shortName].filter((keyword): keyword is string =>
      Boolean(keyword?.trim()),
    ),
    type: "produto" as const,
  }));
  const ingredientOptions = ingredients
    .filter((ingredient) => ingredient.status === "ativo")
    .map((ingredient) => ({
      id: ingredient.id,
      label: `${ingredient.code} · ${ingredient.name}`,
      description: ingredient.shortName?.trim()
        ? `Nome reduzido: ${ingredient.shortName}`
        : undefined,
      keywords: [ingredient.code, ingredient.shortName].filter((keyword): keyword is string =>
        Boolean(keyword?.trim()),
      ),
      type: "ingrediente" as const,
    }));
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

  function openIngredientDialog(ingredient: IngredientRow | null, mode: IngredientDialogMode) {
    setIngredientDialogMode(mode);
    setEditingIngredient(ingredient);
    const nextFormState = buildFormState(ingredient);
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
    setInvalidFields([]);
    setIsIngredientDialogOpen(true);
  }

  function openProductDialog(product: ProductionProduct, mode: "view" | "edit") {
    setSelectedProduct(product);
    setProductDialogMode(mode);
    setIsProductDialogOpen(true);
  }

  function openNewIngredient() {
    openIngredientDialog(null, "edit");
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
    const validation = validateIngredientFormState({ name: formState.name });
    if (validation.error) {
      setInvalidFields(validation.invalidFields);
      setFormError(validation.error);
      setTimeout(() => {
        document.getElementById("ingredient-name")?.focus();
      }, 0);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setInvalidFields([]);

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
      setIsIngredientDialogOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Falha ao salvar ingrediente");
    } finally {
      setIsSubmitting(false);
    }
  }

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: IngredientListRow) => {
        if (item.rowKind === "mpiProduct" && item.product) {
          openProductDialog(item.product, "view");
          return;
        }

        if (item.ingredient) {
          openIngredientDialog(item.ingredient, "view");
        }
      },
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: IngredientListRow) => {
        if (item.rowKind === "mpiProduct" && item.product) {
          openProductDialog(item.product, "edit");
          return;
        }

        if (item.ingredient) {
          openIngredientDialog(item.ingredient, "edit");
        }
      },
    },
  ];

  return (
    <PageLayout
      title="Gestão de Ingredientes"
      description="Cadastre ingredientes puros, misturados e acompanhe os produtos MPI reutilizáveis na mesma listagem."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Ingredientes" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard
          title="Ingredientes Cadastrados"
          value={`${ingredients.length} ingredientes`}
          icon={Package}
          tone="success"
        />
        <KPICard
          title="Produtos MPI"
          value={isLoading ? "Carregando..." : `${mpiProducts.length} produtos`}
          icon={Clock3}
          tone="neutral"
          subtitle={isLoading ? undefined : `${filteredRows.length} linhas visíveis na busca atual`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Ingredientes e MPI</CardTitle>
          <Button type="button" onClick={openNewIngredient}>
            <Plus className="size-4" />
            Novo Ingrediente
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código XPAN, ERP, nome completo, nome reduzido ou tipo..."
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
            data={filteredRows}
            columns={columns}
            actions={actions}
            keyField="rowKey"
            onRowClick={(item) => {
              if (item.rowKind === "mpiProduct" && item.product) {
                openProductDialog(item.product, "view");
                return;
              }

              if (item.ingredient) {
                openIngredientDialog(item.ingredient, "view");
              }
            }}
            emptyMessage={isLoading ? "Carregando ingredientes..." : "Nenhuma referência encontrada"}
            stickyHeader
          />
        </CardContent>
      </Card>

      <Dialog
        open={isIngredientDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (!formGuard.confirmIfNeeded()) {
              return;
            }
            setFormError(null);
            setInvalidFields([]);
          }

          setIsIngredientDialogOpen(open);
        }}
      >
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
                  <Label htmlFor="ingredient-name">Nome completo do ingrediente *</Label>
                  <Input
                    id="ingredient-name"
                    aria-invalid={invalidFields.includes("name")}
                    className={cn(invalidFields.includes("name") && "border-danger/60 ring-1 ring-danger/30")}
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Ex: Mistura Pão"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ingredient-short-name">Nome reduzido</Label>
                  <Input
                    id="ingredient-short-name"
                    value={formState.shortName}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, shortName: event.target.value }))
                    }
                    placeholder="Ex: Mistura base"
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
                      setFormState((current) => ({
                        ...current,
                        externalCode: event.target.value,
                      }))
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
                    purchaseUnit: formState.purchaseUnit,
                    purchaseToConsumptionFactor: formState.purchaseToConsumptionFactor,
                    metadata: formState.metadata,
                    observation: formState.observation,
                  }}
                  unitOptions={ingredientUnitOptions}
                  showPurchaseFields
                  showWeightKg={false}
                  metadataLabel="Metadados / Uso"
                  metadataPlaceholder="Ex: MPI de confeitaria usada como base"
                  observationPlaceholder="Explique o uso deste ingrediente na receita."
                  purchaseHelperText={`1 ${getOperationalUnitLabel(formState.purchaseUnit ?? formState.unit)} = ${formState.purchaseToConsumptionFactor || 1} ${getOperationalUnitLabel(formState.unit)}`}
                  onChange={(patch) =>
                    setFormState((current) => ({
                      ...current,
                      unit: (patch.unit as IngredientRow["unit"] | undefined) ?? current.unit,
                      purchaseUnit:
                        (patch.purchaseUnit as IngredientRow["purchaseUnit"] | undefined) ??
                        current.purchaseUnit ??
                        current.unit,
                      purchaseToConsumptionFactor:
                        patch.purchaseToConsumptionFactor ?? current.purchaseToConsumptionFactor,
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
                  options={compositionOptions.map((option) => ({
                    id: option.id,
                    label: option.label,
                    description: option.description,
                    keywords: option.keywords,
                  }))}
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
          {formError && !isReadOnly ? (
            <div className="rounded-lg border border-danger/40 bg-danger/15 px-3 py-2 text-sm text-danger-foreground">
              {formError}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!formGuard.confirmIfNeeded()) {
                  return;
                }
                setIsIngredientDialogOpen(false);
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

      <ProductFormDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
        product={selectedProduct}
        mode={productDialogMode}
        snapshot={snapshot}
        refresh={refresh}
      />
    </PageLayout>
  );
}
