"use client";

import { useMemo, useState } from "react";
import { Box, ChevronDown, ChevronUp, Clock3, Plus, Trash2 } from "lucide-react";

import { IngredientCompositionEditor } from "@/components/production/ingredient-composition-editor";
import { IngredientProfileFields } from "@/components/production/ingredient-profile-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchFilter } from "@/components/shared/search-filter";
import { PageLayout } from "@/components/shared/page-layout";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  hierarchyLabels,
  productionWeekDays,
  type BreakStage,
  type IngredientCompositionItem,
  type PackagingProfile,
  type ProductUnitProfile,
  type ProductionLine,
  type ProductionProduct,
  type RecipeIngredientReference,
} from "@/lib/production-planning";
import {
  getOperationalUnitLabel,
  getOperationalUnitOptions,
  preferredOperationalUnits,
} from "@/lib/operational-units";
import { getProductRecipeTotalsFromData } from "@/lib/production-data-utils";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";

type ProductRow = ProductionProduct & {
  lineName: string;
  operationalLineName: string;
  sectorName: string;
  validityLabel: string;
  productionDaysLabel: string;
};

type ProductFormState = ProductionProduct;
type ProductDialogMode = "view" | "edit";

type LineDraftState = {
  name: string;
  sectorId: string;
  capacityPerDayKg: string;
  operatingHours: string;
  type: ProductionLine["type"];
};

type RecipeSourceOption = {
  id: string;
  label: string;
  sourceType: RecipeIngredientReference["sourceType"];
};

const breakStageLabels: Record<BreakStage, string> = {
  antes_divisao: "Antes da divisão",
  depois_divisao: "Depois da divisão",
  antes_forno: "Antes do forno",
  depois_forno: "Depois do forno",
};

function createUnitProfile(unit: ProductUnitProfile["unit"], description: string, weightKg: number): ProductUnitProfile {
  return {
    unit,
    description,
    weightKg: unit === "Kg" ? 1 : weightKg,
  };
}

function buildProductFormState(lines: ProductionLine[], product?: ProductRow | null): ProductFormState {
  if (product) {
    return {
      ...product,
      recipe: product.recipe.map((item) => ({ ...item })),
      unitProfiles: {
        sales: { ...product.unitProfiles.sales },
        production: { ...product.unitProfiles.production },
        expedition: { ...product.unitProfiles.expedition },
      },
      packagingProfile: product.packagingProfile ? { ...product.packagingProfile } : undefined,
      ingredientProfile: product.ingredientProfile ? { ...product.ingredientProfile } : undefined,
      productionDays: [...product.productionDays],
      saleLeadDays: product.saleLeadDays ?? 0,
    };
  }

  const defaultLine = lines[0];
  return {
    id: `product-${Date.now()}`,
    code: `PR-${String(Date.now()).slice(-5)}`,
    externalCode: "",
    name: "",
    description: "",
    lineId: defaultLine?.id ?? "",
    active: true,
    availableForOrdering: true,
    validityDays: 5,
    minimumProductionKg: 100,
    economicProductionKg: 140,
    allowsStorage: false,
    productionDays: ["segunda", "quarta", "sexta"],
    saleLeadDays: 0,
    unitProfiles: {
      sales: createUnitProfile("Kg", "Unidade de venda", 1),
      production: createUnitProfile("Kg", "Unidade de produção", 1),
      expedition: createUnitProfile("Kg", "Unidade de expedição", 1),
    },
    packagingProfile: {
      unit: "Un",
      description: "Embalagem individual",
      weightKg: 0.2,
      quantityPerPackage: 1,
    },
    isSoldLoose: false,
    recipe: [],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "depois_divisao",
    breakComment: "",
    canBeIngredient: false,
    ingredientProfile: {
      unit: "Kg",
      weightKg: 1,
      metadata: "",
      observation: "",
    },
    weight: "1.000 Kg",
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    isMpiIngredient: false,
  };
}

function buildLineDraft(sectorId: string): LineDraftState {
  return {
    name: "",
    sectorId,
    capacityPerDayKg: "900",
    operatingHours: "05:00 - 14:00",
    type: "Seco",
  };
}

function getPackagingUnitsForSalesUnit(
  unit: ProductUnitProfile["unit"],
  currentPackagingUnit?: ProductUnitProfile["unit"],
): ProductUnitProfile["unit"][] {
  const baseUnits: ProductUnitProfile["unit"][] =
    unit === "Kg" ? ["Kg", "Un"] : [...preferredOperationalUnits];
  const options = [...baseUnits];

  if (currentPackagingUnit && !options.includes(currentPackagingUnit)) {
    options.push(currentPackagingUnit);
  }

  return options;
}

function calculateQuantityPerPackage(unitWeightKg: number, packagingWeightKg: number) {
  if (
    !Number.isFinite(unitWeightKg) ||
    unitWeightKg <= 0 ||
    !Number.isFinite(packagingWeightKg) ||
    packagingWeightKg <= 0
  ) {
    return 0;
  }

  return Number((packagingWeightKg / unitWeightKg).toFixed(3));
}

export default function ProdutosPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLineDialogOpen, setIsLineDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [dialogMode, setDialogMode] = useState<ProductDialogMode>("edit");
  const [formState, setFormState] = useState<ProductFormState>(() => buildProductFormState([]));
  const [formBaseline, setFormBaseline] = useState("");
  const [lineDraft, setLineDraft] = useState<LineDraftState>(() => buildLineDraft(""));
  const [draftRecipeSourceId, setDraftRecipeSourceId] = useState("");
  const [draftRecipeQuantity, setDraftRecipeQuantity] = useState("");
  const [draftRecipeUnit, setDraftRecipeUnit] = useState<RecipeIngredientReference["unit"]>("Kg");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isReadOnly = dialogMode === "view";
  const formDirty =
    isDialogOpen &&
    !isReadOnly &&
    JSON.stringify({
      formState,
      draftRecipeSourceId,
      draftRecipeQuantity,
      draftRecipeUnit,
    }) !== formBaseline;
  const formGuard = useUnsavedChangesGuard({
    enabled: isDialogOpen && !isReadOnly,
    isDirty: formDirty,
  });

  const sectorNameById = useMemo(
    () => new Map(snapshot.sectors.map((sector) => [sector.id, sector.name])),
    [snapshot.sectors],
  );

  const productRows = useMemo(
    () =>
      snapshot.products.map((product) => {
        const line = snapshot.lines.find((item) => item.id === product.lineId);
        const operationalLine = snapshot.lines.find((item) => item.id === product.operationalLineId);
        return {
          ...product,
          lineName: line?.name ?? "-",
          operationalLineName: operationalLine?.name ?? (product.operationalLineId ? "-" : "Fora da carteira operacional"),
          sectorName: line ? sectorNameById.get(line.sectorId) ?? "-" : "-",
          validityLabel: `${product.validityDays} dias`,
          productionDaysLabel: `${product.productionDays.map((day) => day.slice(0, 3)).join(" · ")} · ${
            (product.saleLeadDays ?? 0) === 0
              ? "venda no receb."
              : `venda +${product.saleLeadDays}d`
          }`,
        };
      }),
    [sectorNameById, snapshot.lines, snapshot.products],
  );

  const filteredProducts = useMemo(
    () =>
      productRows.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.externalCode ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.lineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.operationalLineName.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [productRows, searchTerm],
  );

  const activeProductsCount = productRows.filter((item) => item.active).length;
  const lineOptions = snapshot.lines.map((line) => ({
    value: line.id,
    label: `${line.name} · ${sectorNameById.get(line.sectorId) ?? "-"}`,
  }));

  const recipeSourceOptions: RecipeSourceOption[] = [
    ...snapshot.ingredients.map((ingredient) => ({
      id: ingredient.id,
      label: `${ingredient.code} · ${ingredient.name}`,
      sourceType: "ingrediente" as const,
    })),
    ...snapshot.products
      .filter((product) => product.canBeIngredient)
      .map((product) => ({
        id: product.id,
        label: `${product.code} · ${product.name}`,
        sourceType: "produto" as const,
      })),
  ];

  const recipeTotals = useMemo(
    () => getProductRecipeTotalsFromData(formState, snapshot.ingredients, snapshot.products),
    [formState, snapshot.ingredients, snapshot.products],
  );
  const availablePackagingUnits = useMemo(
    () => getPackagingUnitsForSalesUnit(formState.unitProfiles.sales.unit, formState.packagingProfile?.unit),
    [formState.packagingProfile?.unit, formState.unitProfiles.sales.unit],
  );
  const productUnitOptions = useMemo(
    () =>
      getOperationalUnitOptions(
        formState.unitProfiles.sales.unit,
        formState.unitProfiles.production.unit,
        formState.unitProfiles.expedition.unit,
        formState.ingredientProfile?.unit,
        draftRecipeUnit,
        ...formState.recipe.map((item) => item.unit),
      ),
    [
      draftRecipeUnit,
      formState.ingredientProfile?.unit,
      formState.recipe,
      formState.unitProfiles.expedition.unit,
      formState.unitProfiles.production.unit,
      formState.unitProfiles.sales.unit,
    ],
  );
  const currentPackagingUnit = useMemo(
    () =>
      availablePackagingUnits.includes(formState.packagingProfile?.unit ?? availablePackagingUnits[0])
        ? (formState.packagingProfile?.unit ?? availablePackagingUnits[0])
        : availablePackagingUnits[0],
    [availablePackagingUnits, formState.packagingProfile?.unit],
  );
  const packagingWeightLockedToKg = currentPackagingUnit === "Kg";
  const calculatedQuantityPerPackage = useMemo(() => {
    if (formState.isSoldLoose || !formState.packagingProfile) {
      return 0;
    }

    const salesWeightKg =
      formState.unitProfiles.sales.unit === "Kg" ? 1 : formState.unitProfiles.sales.weightKg;
    const packagingWeightKg =
      currentPackagingUnit === "Kg" ? 1 : formState.packagingProfile.weightKg;

    return calculateQuantityPerPackage(salesWeightKg, packagingWeightKg);
  }, [
    currentPackagingUnit,
    formState.isSoldLoose,
    formState.packagingProfile,
    formState.unitProfiles.sales.unit,
    formState.unitProfiles.sales.weightKg,
  ]);
  const mpiCompositionPreview = useMemo<IngredientCompositionItem[]>(
    () =>
      formState.recipe.map((item) => ({
        id: item.id,
        ingredientId: item.sourceType === "ingrediente" ? item.sourceId : undefined,
        productId: item.sourceType === "produto" ? item.sourceId : undefined,
        name: item.label,
        quantity: item.quantity,
        unit: item.unit,
        observation: "",
      })),
    [formState.recipe],
  );
  const yieldPercent = useMemo(() => Math.max(0, Number((100 - formState.breakPercent).toFixed(2))), [formState.breakPercent]);

  const columns = [
    { key: "code", header: "Código XPAN" },
    {
      key: "externalCode",
      header: "Código ERP",
      render: (item: ProductRow) => item.externalCode || "-",
    },
    { key: "name", header: "Nome" },
    { key: "lineName", header: `${hierarchyLabels.line} Cadastral` },
    { key: "operationalLineName", header: `${hierarchyLabels.line} Operacional` },
    { key: "sectorName", header: hierarchyLabels.sector },
    {
      key: "active",
      header: "Ativo?",
      render: (item: ProductRow) =>
        item.active ? <StatusBadge status="ativo" /> : <StatusBadge status="inativo" />,
    },
    {
      key: "unitProfiles",
      header: "Venda / Produção / Expedição",
      render: (item: ProductRow) =>
        `${item.unitProfiles.sales.unit} / ${item.unitProfiles.production.unit} / ${item.unitProfiles.expedition.unit}`,
    },
    { key: "productionDaysLabel", header: "Cronograma" },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: ProductRow) => {
        const nextFormState = buildProductFormState(snapshot.lines, item);
        setDialogMode("view");
        setEditingProduct(item);
        setFormState(nextFormState);
        setFormBaseline(
          JSON.stringify({
            formState: nextFormState,
            draftRecipeSourceId: "",
            draftRecipeQuantity: "",
            draftRecipeUnit: "Kg",
          }),
        );
        setFormError(null);
        setIsDialogOpen(true);
      },
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: ProductRow) => {
        const nextFormState = buildProductFormState(snapshot.lines, item);
        setDialogMode("edit");
        setEditingProduct(item);
        setFormState(nextFormState);
        setFormBaseline(
          JSON.stringify({
            formState: nextFormState,
            draftRecipeSourceId: "",
            draftRecipeQuantity: "",
            draftRecipeUnit: "Kg",
          }),
        );
        setFormError(null);
        setIsDialogOpen(true);
      },
    },
  ];

  function openNewProduct() {
    setDialogMode("edit");
    setEditingProduct(null);
    const nextFormState = buildProductFormState(snapshot.lines);
    setFormState(nextFormState);
    setLineDraft(buildLineDraft(snapshot.sectors[0]?.id ?? ""));
    setDraftRecipeSourceId("");
    setDraftRecipeQuantity("");
    setDraftRecipeUnit("Kg");
    setFormBaseline(
      JSON.stringify({
        formState: nextFormState,
        draftRecipeSourceId: "",
        draftRecipeQuantity: "",
        draftRecipeUnit: "Kg",
      }),
    );
    setFormError(null);
  }

  function updateUnitProfile(scope: keyof ProductFormState["unitProfiles"], patch: Partial<ProductUnitProfile>) {
    setFormState((current) => {
      const nextUnit = patch.unit ?? current.unitProfiles[scope].unit;
      const nextWeight =
        patch.weightKg ?? (nextUnit === "Kg" ? 1 : current.unitProfiles[scope].weightKg);
      const nextPackagingUnits =
        scope === "sales" ? getPackagingUnitsForSalesUnit(nextUnit) : getPackagingUnitsForSalesUnit(current.unitProfiles.sales.unit);
      const nextPackagingProfile =
        scope === "sales" && current.packagingProfile
          ? {
              ...current.packagingProfile,
              unit: nextPackagingUnits.includes(current.packagingProfile.unit)
                ? current.packagingProfile.unit
                : nextPackagingUnits[0],
              weightKg:
                (nextPackagingUnits.includes(current.packagingProfile.unit)
                  ? current.packagingProfile.unit
                  : nextPackagingUnits[0]) === "Kg"
                  ? 1
                  : current.packagingProfile.weightKg,
            }
          : current.packagingProfile;

      return {
        ...current,
        unitProfiles: {
          ...current.unitProfiles,
          [scope]: {
            ...current.unitProfiles[scope],
            ...patch,
            unit: nextUnit,
            weightKg: nextUnit === "Kg" ? 1 : nextWeight,
          },
        },
        packagingProfile: nextPackagingProfile,
      };
    });
  }

  function updatePackagingProfile(patch: Partial<PackagingProfile>) {
    setFormState((current) => {
      const currentPackaging = current.packagingProfile ?? {
        unit: "Un" as const,
        description: "",
        weightKg: 0.2,
        quantityPerPackage: 1,
      };
      const nextUnit = patch.unit ?? currentPackaging.unit;

      return {
        ...current,
        packagingProfile: {
          ...currentPackaging,
          ...patch,
          unit: nextUnit,
          weightKg: nextUnit === "Kg" ? 1 : patch.weightKg ?? currentPackaging.weightKg,
        },
      };
    });
  }

  function toggleProductionDay(day: (typeof productionWeekDays)[number]["key"]) {
    setFormState((current) => ({
      ...current,
      productionDays: current.productionDays.includes(day)
        ? current.productionDays.filter((item) => item !== day)
        : [...current.productionDays, day],
    }));
  }

  function addRecipeItem() {
    if (!draftRecipeSourceId || !draftRecipeQuantity) {
      return;
    }

    const quantity = Number(draftRecipeQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    const sourceOption = recipeSourceOptions.find((option) => option.id === draftRecipeSourceId);
    if (!sourceOption) {
      return;
    }

    setFormState((current) => ({
      ...current,
      recipe: [
        ...current.recipe,
        {
          id: `recipe-${Date.now()}`,
          sourceId: sourceOption.id,
          sourceType: sourceOption.sourceType,
          label: sourceOption.label,
          quantity,
          unit: draftRecipeUnit,
        },
      ],
    }));
    setDraftRecipeSourceId("");
    setDraftRecipeQuantity("");
  }

  function removeRecipeItem(recipeId: string) {
    setFormState((current) => ({
      ...current,
      recipe: current.recipe.filter((item) => item.id !== recipeId),
    }));
  }

  function updateRecipeItem(
    recipeId: string,
    patch: Partial<Pick<RecipeIngredientReference, "quantity" | "unit">>,
  ) {
    setFormState((current) => ({
      ...current,
      recipe: current.recipe.map((item) =>
        item.id === recipeId
          ? {
              ...item,
              quantity: patch.quantity ?? item.quantity,
              unit: patch.unit ?? item.unit,
            }
          : item,
      ),
    }));
  }

  function moveRecipeItem(recipeId: string, direction: "up" | "down") {
    setFormState((current) => {
      const currentIndex = current.recipe.findIndex((item) => item.id === recipeId);
      if (currentIndex === -1) {
        return current;
      }

      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= current.recipe.length) {
        return current;
      }

      const nextRecipe = [...current.recipe];
      const [movedItem] = nextRecipe.splice(currentIndex, 1);
      nextRecipe.splice(nextIndex, 0, movedItem);

      return {
        ...current,
        recipe: nextRecipe,
      };
    });
  }

  async function handleSaveProduct() {
    if (!formState.name.trim() || !formState.lineId) {
      setFormError("Informe nome e subcategoria do produto.");
      return;
    }

    const normalizedPackagingProfile = formState.isSoldLoose
      ? undefined
      : {
          ...(formState.packagingProfile ?? {
            unit: availablePackagingUnits[0],
            description: "",
            weightKg: availablePackagingUnits[0] === "Kg" ? 1 : 0,
            quantityPerPackage: 1,
          }),
          unit: availablePackagingUnits.includes(formState.packagingProfile?.unit ?? availablePackagingUnits[0])
            ? (formState.packagingProfile?.unit ?? availablePackagingUnits[0])
            : availablePackagingUnits[0],
        };

    if (!formState.isSoldLoose && formState.unitProfiles.sales.unit === "Kg") {
      if (!normalizedPackagingProfile?.description.trim()) {
        setFormError("Informe a descrição da embalagem para itens vendidos em Kg e embalados individualmente.");
        return;
      }

      if (!Number.isFinite(normalizedPackagingProfile.weightKg) || normalizedPackagingProfile.weightKg <= 0) {
        setFormError("Informe o peso padrão da embalagem para itens vendidos em Kg.");
        return;
      }
    }

    const salesWeight = formState.unitProfiles.sales.unit === "Kg" ? 1 : formState.unitProfiles.sales.weightKg;
    const expeditionWeight =
      formState.unitProfiles.expedition.unit === "Kg" ? 1 : formState.unitProfiles.expedition.weightKg;
    const normalizedQuantityPerPackage = formState.isSoldLoose
      ? 0
      : calculateQuantityPerPackage(
          salesWeight,
          normalizedPackagingProfile?.unit === "Kg" ? 1 : normalizedPackagingProfile?.weightKg ?? 0,
        );

    if (!formState.isSoldLoose && normalizedPackagingProfile && normalizedQuantityPerPackage <= 0) {
      setFormError("Informe pesos válidos para calcular o conteúdo por embalagem.");
      return;
    }

    const nextProduct: ProductFormState = {
      ...formState,
      saleLeadDays: Math.max(0, Math.round(formState.saleLeadDays ?? 0)),
      salesUnit: formState.unitProfiles.sales.unit,
      productionUnit: formState.unitProfiles.production.unit,
      expeditionUnit: formState.unitProfiles.expedition.unit,
      salesToKgFactor: salesWeight,
      expeditionToKgFactor: expeditionWeight,
      weight: `${salesWeight.toFixed(3)} Kg`,
      isMpiIngredient: formState.canBeIngredient,
      packagingProfile: normalizedPackagingProfile
        ? {
            ...normalizedPackagingProfile,
            weightKg: normalizedPackagingProfile.unit === "Kg" ? 1 : normalizedPackagingProfile.weightKg,
            quantityPerPackage: normalizedQuantityPerPackage,
          }
        : undefined,
    };

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(
        editingProduct
          ? `/api/master-data/products/${editingProduct.id}`
          : "/api/master-data/products",
        {
          method: editingProduct ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nextProduct),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao salvar produto");
      }

      await refresh();
      setIsDialogOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Falha ao salvar produto");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateLine() {
    if (!lineDraft.name.trim() || !lineDraft.sectorId) {
      setFormError(`Informe nome e ${hierarchyLabels.sector.toLowerCase()} da nova ${hierarchyLabels.line.toLowerCase()}.`);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/master-data/subcategories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: lineDraft.name,
          sectorId: lineDraft.sectorId,
          type: lineDraft.type,
          operatingHours: lineDraft.operatingHours,
          capacityPerDayKg: Number(lineDraft.capacityPerDayKg),
          status: "ativo",
        }),
      });

      const body = (await response.json().catch(() => null)) as { message?: string; id?: string } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "Falha ao criar subcategoria");
      }

      const createdLineId = body?.id ?? null;
      await refresh();
      if (createdLineId) {
        setFormState((current) => ({ ...current, lineId: createdLineId }));
      }
      setIsLineDialogOpen(false);
      setLineDraft(buildLineDraft(lineDraft.sectorId));
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Falha ao criar subcategoria");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageLayout
      title="Gestão de Produtos"
      description="Modele a engenharia em kg, o cronograma por produto e o espelho MPI no mesmo cadastro."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Produtos" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard
          title="Registros Ativos"
          value={`${activeProductsCount} produtos`}
          icon={Box}
          tone="success"
        />
        <KPICard
          title="Última Atualização"
          value={isLoading ? "Carregando..." : `${productRows.length} cadastrados`}
          icon={Clock3}
          tone="neutral"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Produtos</CardTitle>
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
              <Button type="button" onClick={openNewProduct} disabled={isSubmitting}>
                <Plus className="size-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent size="3xl" className="max-h-[92vh] overflow-y-auto rounded-[28px] bg-white p-5 sm:max-w-[1080px]">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {!editingProduct
                    ? "Cadastrar Novo Produto"
                    : isReadOnly
                      ? "Visualizar Produto"
                      : "Editar Produto"}
                </DialogTitle>
                <DialogDescription>
                  {isReadOnly
                    ? "Consulte dados, engenharia, receita, cronograma e reaproveitamento MPI sem alterar o cadastro."
                    : "Preencha dados, engenharia, receita, cronograma e reaproveitamento MPI no mesmo cadastro."}
                </DialogDescription>
              </DialogHeader>

              {formError ? (
                <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
                  {formError}
                </div>
              ) : null}
              {isReadOnly ? (
                <div className="rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm text-info-foreground">
                  Modo visualização: use o lápis para editar este produto.
                </div>
              ) : null}
              {formDirty ? (
                <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                  Existem alterações pendentes neste produto.
                </div>
              ) : null}

              <Tabs defaultValue="cadastro" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 rounded-xl bg-panel/60 p-1">
                  <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                  <TabsTrigger value="receita">Receita</TabsTrigger>
                  <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
                  <TabsTrigger value="mpi">Produto como MPI</TabsTrigger>
                </TabsList>

                <TabsContent value="cadastro">
                  <fieldset disabled={isReadOnly} className="space-y-5">
                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Dados do Produto</h3>
                      <p className="text-xs text-muted-foreground">
                        Nome, código XPAN, código ERP, descrição e vínculo com a linha principal de produção.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="product-name">Nome do Produto *</Label>
                        <Input
                          id="product-name"
                          placeholder="Ex: Pão Francês"
                          value={formState.name}
                          onChange={(event) =>
                            setFormState((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Código XPAN</Label>
                        <Input value={formState.code} disabled className="bg-muted" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="product-external-code">Código ERP</Label>
                        <Input
                          id="product-external-code"
                          value={formState.externalCode ?? ""}
                          onChange={(event) =>
                            setFormState((current) => ({ ...current, externalCode: event.target.value }))
                          }
                          placeholder="Código externo do ERP"
                        />
                      </div>
                      <div className="grid gap-2 md:col-span-3">
                        <Label>Descrição</Label>
                        <Input
                          value={formState.description}
                          onChange={(event) =>
                            setFormState((current) => ({ ...current, description: event.target.value }))
                          }
                          placeholder="Descrição do produto"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                      <div className="grid gap-2">
                        <Label>{hierarchyLabels.line} Cadastral *</Label>
                        <Select
                          value={formState.lineId}
                          onValueChange={(value) =>
                            setFormState((current) => ({ ...current, lineId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Selecione a ${hierarchyLabels.line.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {lineOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          A carteira operacional do cronograma passa a ser gerenciada dentro da tela da subcategoria.
                        </p>
                      </div>
                      <div className="flex items-end">
                        <Dialog
                          open={isLineDialogOpen}
                          onOpenChange={(open) => {
                            setIsLineDialogOpen(open);
                            if (open) {
                              setLineDraft((current) =>
                                current.sectorId ? current : buildLineDraft(snapshot.sectors[0]?.id ?? ""),
                              );
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button type="button" variant="outline">
                              <Plus className="size-4" />
                              Nova {hierarchyLabels.line}
                            </Button>
                          </DialogTrigger>
                          <DialogContent size="lg">
                            <DialogHeader>
                              <DialogTitle>Nova {hierarchyLabels.line}</DialogTitle>
                              <DialogDescription>
                                Cadastre a nova {hierarchyLabels.line.toLowerCase()} sem sair do produto.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-2">
                              <div className="grid gap-2">
                                <Label>Nome *</Label>
                                <Input
                                  value={lineDraft.name}
                                  onChange={(event) =>
                                    setLineDraft((current) => ({ ...current, name: event.target.value }))
                                  }
                                  placeholder="Ex: Linha Ovos de Páscoa"
                                />
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                <div className="grid gap-2">
                                  <Label>{hierarchyLabels.sector} *</Label>
                                  <Select
                                    value={lineDraft.sectorId}
                                    onValueChange={(value) =>
                                      setLineDraft((current) => ({ ...current, sectorId: value }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
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
                                  <Label>Capacidade / dia (Kg)</Label>
                                  <Input
                                    type="number"
                                    value={lineDraft.capacityPerDayKg}
                                    onChange={(event) =>
                                      setLineDraft((current) => ({ ...current, capacityPerDayKg: event.target.value }))
                                    }
                                  />
                                </div>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                <div className="grid gap-2">
                                  <Label>Tipo</Label>
                                  <Select
                                    value={lineDraft.type}
                                    onValueChange={(value) =>
                                      setLineDraft((current) => ({
                                        ...current,
                                        type: value as ProductionLine["type"],
                                      }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Seco">Seco</SelectItem>
                                      <SelectItem value="Úmido">Úmido</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Horário</Label>
                                  <Input
                                    value={lineDraft.operatingHours}
                                    onChange={(event) =>
                                      setLineDraft((current) => ({ ...current, operatingHours: event.target.value }))
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setIsLineDialogOpen(false)} disabled={isSubmitting}>
                                Cancelar
                              </Button>
                              <Button type="button" onClick={() => void handleCreateLine()} disabled={isSubmitting}>
                                Criar {hierarchyLabels.line}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                  </section>

                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Resumo Operacional</h3>
                      <p className="text-xs text-muted-foreground">
                        Conversões principais usadas no planejamento e na expedição deste produto.
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Peso final de venda
                        </p>
                        <div className="rounded-lg border border-border/70 bg-panel/25 px-3 py-3 text-sm text-foreground">
                          {formState.unitProfiles.sales.unit} · {formState.salesToKgFactor.toFixed(3)} Kg
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Produção
                        </p>
                        <div className="rounded-lg border border-border/70 bg-panel/25 px-3 py-3 text-sm text-foreground">
                          {formState.unitProfiles.production.unit} · {formState.unitProfiles.production.weightKg.toFixed(3)} Kg
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Expedição
                        </p>
                        <div className="rounded-lg border border-border/70 bg-panel/25 px-3 py-3 text-sm text-foreground">
                          {formState.unitProfiles.expedition.unit} · {formState.expeditionToKgFactor.toFixed(3)} Kg
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Unidades de Medida e Conversões</h3>
                      <p className="text-xs text-muted-foreground">
                        Kg é a base universal da engenharia. Defina embalagem, venda, produção e expedição no mesmo
                        quadro, com tipo, descrição e peso padrão próprios.
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-border/80">
                      <div className="grid grid-cols-[112px_repeat(4,minmax(0,1fr))] border-b border-border/80 bg-panel/70">
                        <div className="border-r border-border/70 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Campo
                        </div>
                        {["Embalagem", "Venda", "Produção", "Expedição"].map((title) => (
                          <div
                            key={title}
                            className="border-r border-border/70 px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground last:border-r-0"
                          >
                            {title}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-[112px_repeat(4,minmax(0,1fr))] border-b border-border/80">
                        <div className="border-r border-border/70 bg-panel/30 px-3 py-3 text-xs font-semibold text-foreground">
                          Tipo
                        </div>
                        <div className="border-r border-border/70 px-3 py-3">
                          <Select
                            value={currentPackagingUnit}
                            onValueChange={(value) =>
                              updatePackagingProfile({ unit: value as PackagingProfile["unit"] })
                            }
                            disabled={formState.isSoldLoose}
                          >
                            <SelectTrigger aria-label="Tipo da embalagem">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                  {availablePackagingUnits.map((unit) => (
                                    <SelectItem key={unit} value={unit}>
                                      {getOperationalUnitLabel(unit)}
                                    </SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {(
                          [
                            ["sales", "Venda"],
                            ["production", "Produção"],
                            ["expedition", "Expedição"],
                          ] as const
                        ).map(([scope, title]) => {
                          const profile = formState.unitProfiles[scope];
                          return (
                            <div key={`${scope}-type`} className="border-r border-border/70 px-3 py-3 last:border-r-0">
                              <Select
                                value={profile.unit}
                                onValueChange={(value) =>
                                  updateUnitProfile(scope, {
                                    unit: value as ProductUnitProfile["unit"],
                                  })
                                }
                              >
                                <SelectTrigger aria-label={`Tipo de ${title}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {productUnitOptions.map((unit) => (
                                    <SelectItem key={unit} value={unit}>
                                      {getOperationalUnitLabel(unit)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-[112px_repeat(4,minmax(0,1fr))] border-b border-border/80">
                        <div className="border-r border-border/70 bg-panel/30 px-3 py-3 text-xs font-semibold text-foreground">
                          Descrição
                        </div>
                        <div className="border-r border-border/70 px-3 py-3">
                          <Input
                            aria-label="Descrição da embalagem"
                            value={formState.packagingProfile?.description ?? ""}
                            disabled={formState.isSoldLoose}
                            onChange={(event) => updatePackagingProfile({ description: event.target.value })}
                            placeholder="Ex: embalagem individual"
                          />
                        </div>
                        {(
                          [
                            ["sales", "Venda"],
                            ["production", "Produção"],
                            ["expedition", "Expedição"],
                          ] as const
                        ).map(([scope, title]) => (
                          <div key={`${scope}-description`} className="border-r border-border/70 px-3 py-3 last:border-r-0">
                            <Input
                              aria-label={`Descrição de ${title}`}
                              value={formState.unitProfiles[scope].description}
                              onChange={(event) =>
                                updateUnitProfile(scope, { description: event.target.value })
                              }
                              placeholder={`Descrição de ${title.toLowerCase()}`}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-[112px_repeat(4,minmax(0,1fr))]">
                        <div className="border-r border-border/70 bg-panel/30 px-3 py-3 text-xs font-semibold text-foreground">
                          Peso
                        </div>
                        <div className="border-r border-border/70 px-3 py-3">
                          <Input
                            aria-label="Peso padrão da embalagem"
                            type="number"
                            step="0.001"
                            value={formState.isSoldLoose ? "" : packagingWeightLockedToKg ? 1 : formState.packagingProfile?.weightKg ?? ""}
                            disabled={formState.isSoldLoose || packagingWeightLockedToKg}
                            onChange={(event) =>
                              updatePackagingProfile({ weightKg: Number(event.target.value) })
                            }
                          />
                        </div>
                        {(
                          [
                            ["sales", "Venda"],
                            ["production", "Produção"],
                            ["expedition", "Expedição"],
                          ] as const
                        ).map(([scope, title]) => {
                          const profile = formState.unitProfiles[scope];
                          const lockedToKg = profile.unit === "Kg";
                          return (
                            <div key={`${scope}-weight`} className="border-r border-border/70 px-3 py-3 last:border-r-0">
                              <Input
                                aria-label={`Peso padrão de ${title}`}
                                type="number"
                                step="0.001"
                                value={lockedToKg ? 1 : profile.weightKg}
                                disabled={lockedToKg}
                                onChange={(event) =>
                                  updateUnitProfile(scope, {
                                    weightKg: Number(event.target.value),
                                  })
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 lg:grid-cols-[1.2fr_220px]">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="sold-loose"
                            checked={formState.isSoldLoose}
                            onCheckedChange={(checked) =>
                              setFormState((current) => ({
                                ...current,
                                isSoldLoose: checked === true,
                              }))
                            }
                          />
                          <Label htmlFor="sold-loose">Item vendido a granel</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Quando marcado como granel, a embalagem fica fora do cálculo operacional e de auditoria.
                        </p>
                        {formState.unitProfiles.sales.unit === "Kg" ? (
                          <div className="rounded-lg border border-border/70 bg-panel/30 px-3 py-2 text-xs text-muted-foreground">
                            Produto vendido em Kg: a venda permanece fixa em 1 Kg. A embalagem vira a referência para
                            porcionamento, conferência e exposição individual.
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-2">
                        <Label>Conteúdo por embalagem</Label>
                        <Input
                          type="number"
                          value={formState.isSoldLoose ? "" : calculatedQuantityPerPackage || ""}
                          disabled={formState.isSoldLoose}
                          readOnly
                        />
                        <p className="text-xs text-muted-foreground">
                          Calculado automaticamente a partir do peso unitário de venda e do peso total da embalagem.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Bases de Produção e Quebra</h3>
                      <p className="text-xs text-muted-foreground">
                        Defina a base mínima, a base econômica e a perda principal para chegar ao peso final vendido.
                      </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.2fr_320px]">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="grid gap-2">
                          <Label>Perda principal (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formState.breakPercent}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                breakPercent: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Validade após produção (dias)</Label>
                          <Input
                            type="number"
                            value={formState.validityDays}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                validityDays: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Base mínima de produção (Kg)</Label>
                          <Input
                            type="number"
                            value={formState.minimumProductionKg}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                minimumProductionKg: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Base econômica de produção (Kg)</Label>
                          <Input
                            type="number"
                            value={formState.economicProductionKg}
                            onChange={(event) =>
                              setFormState((current) => ({
                                ...current,
                                economicProductionKg: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="flex items-center gap-2 pb-2">
                            <Checkbox
                              id="storage"
                              checked={formState.allowsStorage}
                              onCheckedChange={(checked) =>
                                setFormState((current) => ({
                                  ...current,
                                  allowsStorage: checked === true,
                                }))
                              }
                            />
                            <Label htmlFor="storage">Permite armazenar após produzir?</Label>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                          Peso final / rendimento
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-emerald-900">{yieldPercent.toFixed(2)}%</p>
                        <p className="mt-2 text-xs text-emerald-800">
                          Percentual líquido estimado depois da perda principal informada.
                        </p>
                      </div>
                    </div>
                  </section>
                  </fieldset>
                </TabsContent>

                <TabsContent value="receita">
                  <fieldset disabled={isReadOnly} className="space-y-5">
                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Ingredientes da Receita</h3>
                      <p className="text-xs text-muted-foreground">
                        Monte a receita técnica do produto com ingredientes comuns ou produtos MPI.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="grid gap-2 md:col-span-2">
                        <Label>Ingrediente / Produto MPI</Label>
                        <Select value={draftRecipeSourceId} onValueChange={setDraftRecipeSourceId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a referência" />
                          </SelectTrigger>
                          <SelectContent>
                            {recipeSourceOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={draftRecipeQuantity}
                          onChange={(event) => setDraftRecipeQuantity(event.target.value)}
                          placeholder="1,500"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Unidade da receita</Label>
                        <Select value={draftRecipeUnit} onValueChange={(value) => setDraftRecipeUnit(value as RecipeIngredientReference["unit"])}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {productUnitOptions.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {getOperationalUnitLabel(unit)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" onClick={addRecipeItem}>
                        <Plus className="size-4" />
                        Adicionar item
                      </Button>
                    </div>

                    <PaginatedSection items={formState.recipe} label="itens da receita" initialPageSize={6}>
                      {(paginatedRecipe) => (
                        <div className="overflow-x-auto rounded-xl border border-border/70">
                          <table className="w-full min-w-[640px] border-collapse">
                            <thead className="bg-card">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Referência</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Qtd</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Unidade</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {formState.recipe.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="border-t border-border/70 bg-card px-3 py-3 text-sm text-muted-foreground">
                                    Nenhum item na receita.
                                  </td>
                                </tr>
                              ) : (
                                paginatedRecipe.map((item) => (
                                  <tr key={item.id}>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.label}</td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={item.quantity}
                                    onChange={(event) =>
                                      updateRecipeItem(item.id, { quantity: Number(event.target.value) })
                                    }
                                  />
                                </td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                  <Select
                                    value={item.unit}
                                    onValueChange={(value) =>
                                      updateRecipeItem(item.id, { unit: value as RecipeIngredientReference["unit"] })
                                    }
                                  >
                                    <SelectTrigger className="h-9 bg-background">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {productUnitOptions.map((unit) => (
                                        <SelectItem key={unit} value={unit}>
                                          {getOperationalUnitLabel(unit)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => moveRecipeItem(item.id, "up")}
                                      disabled={formState.recipe.findIndex((entry) => entry.id === item.id) === 0}
                                      title="Mover para cima"
                                    >
                                      <ChevronUp className="size-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => moveRecipeItem(item.id, "down")}
                                      disabled={formState.recipe.findIndex((entry) => entry.id === item.id) === formState.recipe.length - 1}
                                      title="Mover para baixo"
                                    >
                                      <ChevronDown className="size-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-danger-foreground/80 hover:bg-danger/35 hover:text-danger-foreground"
                                      onClick={() => removeRecipeItem(item.id)}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </PaginatedSection>
                  </section>

                  <section className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-border/80 bg-panel/25 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Totais da Receita
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        Total de ingredientes: {recipeTotals.totalIngredientsKg.toFixed(3)} Kg
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Peso final após a perda principal: {recipeTotals.outputAfterBreakKg.toFixed(3)} Kg
                      </p>
                    </div>
                    <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
                      <div className="grid gap-2">
                        <Label>Em qual etapa a perda acontece</Label>
                        <Select
                          value={formState.breakStage}
                          onValueChange={(value) =>
                            setFormState((current) => ({
                              ...current,
                              breakStage: value as BreakStage,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(breakStageLabels) as BreakStage[]).map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {breakStageLabels[stage]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Comentário operacional da perda</Label>
                        <Input
                          value={formState.breakComment}
                          onChange={(event) =>
                            setFormState((current) => ({ ...current, breakComment: event.target.value }))
                          }
                          placeholder="Ex: perda antes do forno por divisão"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-2">
                    <Label>Modo de preparo</Label>
                    <Textarea
                      value={formState.preparationMode}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, preparationMode: event.target.value }))
                      }
                      className="min-h-[140px]"
                      placeholder="Descreva o modo de preparo passo a passo..."
                    />
                  </section>
                  </fieldset>
                </TabsContent>

                <TabsContent value="cronograma">
                  <fieldset disabled={isReadOnly} className="space-y-5">
                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Cronograma definido pelo produto</h3>
                      <p className="text-xs text-muted-foreground">
                        Defina quando a fábrica produz e quantos dias a loja leva para vender depois do recebimento.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-panel/25 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Produção
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          O produto só entra em OP nos dias marcados abaixo.
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-panel/25 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Recebimento
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          A loja recebe em D+{snapshot.operationalSettings.expeditionLeadDays}, respeitando os dias operacionais da loja.
                        </p>
                      </div>
                      <div className="grid gap-2 rounded-xl border border-border/70 bg-card p-4">
                        <Label htmlFor="sale-lead-days">Dias entre recebimento e venda</Label>
                        <Input
                          id="sale-lead-days"
                          type="number"
                          min="0"
                          step="1"
                          value={formState.saleLeadDays ?? 0}
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              saleLeadDays: Math.max(0, Number(event.target.value)),
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Use 0 para vender no mesmo dia do recebimento, 1 para vender no dia seguinte e assim por diante.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      {productionWeekDays.map((day) => {
                        const checked = formState.productionDays.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            type="button"
                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                              checked
                                ? "border-info/60 bg-info/15 text-foreground"
                                : "border-border/70 bg-card text-muted-foreground"
                            }`}
                            onClick={() => toggleProductionDay(day.key)}
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.08em]">{day.shortLabel}</p>
                            <p className="mt-1 text-sm">{day.label}</p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="rounded-xl border border-border/70 bg-panel/25 p-4 text-sm text-muted-foreground">
                      Exemplo operacional: produzir hoje e vender hoje usa 0. Produzir hoje, entregar amanhã e vender depois usa o D+X global mais os dias informados acima para venda.
                    </div>
                  </section>
                  </fieldset>
                </TabsContent>

                <TabsContent value="mpi">
                  <fieldset disabled={isReadOnly} className="space-y-5">
                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="mpi-enabled"
                        checked={formState.canBeIngredient}
                        onCheckedChange={(checked) =>
                          setFormState((current) => ({
                            ...current,
                            canBeIngredient: checked === true,
                            isMpiIngredient: checked === true,
                          }))
                        }
                      />
                      <div>
                        <Label htmlFor="mpi-enabled" className="text-sm font-semibold">
                          Este produto pode ser usado como ingrediente (MPI)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Quando ativado, o produto aparece como insumo disponível nas receitas de outros produtos.
                        </p>
                      </div>
                    </div>

                    {formState.canBeIngredient ? (
                      <div className="space-y-4">
                        <IngredientProfileFields
                          title="Perfil espelhado do ingrediente"
                          description="Os mesmos campos do ingrediente ficam disponíveis aqui para o MPI reaproveitável."
                          profile={{
                            unit: formState.ingredientProfile?.unit ?? "Kg",
                            weightKg:
                              formState.ingredientProfile?.unit === "Kg"
                                ? 1
                                : formState.ingredientProfile?.weightKg ?? formState.unitProfiles.sales.weightKg,
                            metadata: formState.ingredientProfile?.metadata ?? "",
                            observation: formState.ingredientProfile?.observation ?? "",
                          }}
                          unitOptions={productUnitOptions}
                          metadataPlaceholder="Ex: usar como base de sanduíches"
                          observationPlaceholder="Ex: consumir após resfriar"
                          onChange={(patch) =>
                            setFormState((current) => ({
                              ...current,
                              ingredientProfile: {
                                unit: (patch.unit as ProductUnitProfile["unit"] | undefined) ?? current.ingredientProfile?.unit ?? "Kg",
                                weightKg:
                                  patch.unit === "Kg"
                                    ? 1
                                    : patch.weightKg ??
                                      current.ingredientProfile?.weightKg ??
                                      current.unitProfiles.sales.weightKg,
                                metadata: patch.metadata ?? current.ingredientProfile?.metadata ?? "",
                                observation: patch.observation ?? current.ingredientProfile?.observation ?? "",
                              },
                            }))
                          }
                        />

                        <IngredientCompositionEditor
                          title="Composição do MPI"
                          description="Espelho somente leitura da receita técnica que alimenta este ingrediente reutilizável."
                          composition={mpiCompositionPreview}
                          emptyMessage="Nenhum item na receita. Adicione componentes na aba Receita."
                          readOnly
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-panel/20 p-4 text-sm text-muted-foreground">
                        Ative a flag acima para espelhar os campos do cadastro de ingrediente dentro do produto.
                      </div>
                    )}
                  </section>
                  </fieldset>
                </TabsContent>
              </Tabs>

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
                  {isReadOnly ? "Fechar" : "Cancelar"}
                </Button>
                {!isReadOnly ? (
                  <Button type="button" onClick={() => void handleSaveProduct()} disabled={isSubmitting}>
                    {editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
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
            data={filteredProducts}
            columns={columns}
            actions={actions}
            keyField="id"
            onRowClick={(item) => {
              const nextFormState = buildProductFormState(snapshot.lines, item);
              setDialogMode("view");
              setEditingProduct(item);
              setFormState(nextFormState);
              setFormBaseline(
                JSON.stringify({
                  formState: nextFormState,
                  draftRecipeSourceId: "",
                  draftRecipeQuantity: "",
                  draftRecipeUnit: "Kg",
                }),
              );
              setFormError(null);
              setIsDialogOpen(true);
            }}
            emptyMessage={isLoading ? "Carregando produtos..." : "Nenhum produto encontrado"}
            stickyHeader
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
