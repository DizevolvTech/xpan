"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { IngredientCompositionEditor } from "@/components/production/ingredient-composition-editor";
import { IngredientFormDialog } from "@/components/production/ingredient-form-dialog";
import { IngredientProfileFields } from "@/components/production/ingredient-profile-fields";
import { ProductPreparationStagesEditor } from "@/components/production/product-preparation-stages-editor";
import { OperationalSequenceCard } from "@/components/shared/operational-sequence-card";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultRecipeStage,
  hierarchyLabels,
  productionWeekDays,
  recipeStageLabels,
  recipeStages,
  type BreakStage,
  type IngredientCompositionItem,
  type PackagingProfile,
  type ProductUnitProfile,
  type ProductionLine,
  type ProductionProduct,
  type RecipeIngredientReference,
  type RecipeStage,
} from "@/lib/production-planning";
import {
  getOperationalUnitLabel,
  getOperationalUnitOptions,
  preferredOperationalUnits,
} from "@/lib/operational-units";
import { getProductRecipeTotalsFromData } from "@/lib/production-data-utils";
import { normalizeSaleLeadDays } from "@/lib/order-planning";
import { deriveCapacityFromProductRecipe, planBatches } from "@/lib/production-batches";
import {
  buildProductFormState,
  calculateQuantityPerPackage,
  getInvalidFieldTarget,
  validateProductFormState,
  type ProductValidationField,
} from "@/lib/product-form-logic";
import { type MasterDataSnapshot } from "@/lib/supabase-data/master-data";
import { normalizeProductPreparationStages } from "@/lib/production-workflow";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { useToast } from "@/components/shared/toast";
import type { ScheduleRevisionRebuildImpact } from "@/lib/supabase-data/schedule-revision-plan";
import { cn, formatKgLabel, formatLocaleNumber } from "@/lib/utils";

export type ProductDialogMode = "view" | "edit";

type ProductFormState = ProductionProduct;

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

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductionProduct | null;
  mode: ProductDialogMode;
  snapshot: MasterDataSnapshot;
  refresh: (forceRefresh?: boolean) => Promise<MasterDataSnapshot>;
  onRequestEdit?: () => void;
};

const breakStageLabels: Record<BreakStage, string> = {
  antes_divisao: "Antes da divisão",
  depois_divisao: "Depois da divisão",
};

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

export function ProductFormDialog({
  open,
  onOpenChange,
  product = null,
  mode,
  snapshot,
  refresh,
  onRequestEdit,
}: ProductFormDialogProps) {
  const [isLineDialogOpen, setIsLineDialogOpen] = useState(false);
  // AJ-0026: criação inline de categoria sem sair do modal "Nova Linha".
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState({ name: "", responsible: "" });
  const [isIngredientDialogOpen, setIsIngredientDialogOpen] = useState(false);
  const [formState, setFormState] = useState<ProductFormState>(() =>
    buildProductFormState(snapshot.lines, product),
  );
  const [formBaseline, setFormBaseline] = useState("");
  const [lineDraft, setLineDraft] = useState<LineDraftState>(() =>
    buildLineDraft(snapshot.sectors[0]?.id ?? ""),
  );
  const [draftRecipeSourceId, setDraftRecipeSourceId] = useState("");
  const [draftRecipeQuantity, setDraftRecipeQuantity] = useState("");
  const [draftRecipeUnit, setDraftRecipeUnit] = useState<RecipeIngredientReference["unit"]>("Kg");
  const [draftRecipeStage, setDraftRecipeStage] = useState<RecipeStage>(defaultRecipeStage);
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<ProductValidationField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("cadastro");
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [commitDescription, setCommitDescription] = useState("");
  const [pendingProductPayload, setPendingProductPayload] = useState<ProductFormState | null>(null);
  const toast = useToast();
  // AJ-0025: produto em carteira operacional → editar reconstrói a revisão pendente
  // do cronograma; avisamos antes de salvar e orientamos a reauditoria depois.
  const isOperationalProduct = Boolean(product?.operationalLineId);
  const isReadOnly = mode === "view";
  const formDirty =
    open &&
    !isReadOnly &&
    JSON.stringify({
      formState,
      draftRecipeSourceId,
      draftRecipeQuantity,
      draftRecipeUnit,
      draftRecipeStage,
    }) !== formBaseline;
  const formGuard = useUnsavedChangesGuard({
    enabled: open && !isReadOnly,
    isDirty: formDirty,
  });

  // Refs to avoid resetting form state when snapshot refreshes (e.g. after
  // creating an ingredient inline). The effect below must only re-run when the
  // dialog opens or the product/mode genuinely changes.
  const snapshotLinesRef = useRef(snapshot.lines);
  snapshotLinesRef.current = snapshot.lines;
  const snapshotSectorsRef = useRef(snapshot.sectors);
  snapshotSectorsRef.current = snapshot.sectors;
  const productRef = useRef(product);
  productRef.current = product;

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextFormState = buildProductFormState(snapshotLinesRef.current, productRef.current);
    setFormState(nextFormState);
    setLineDraft(buildLineDraft(snapshotSectorsRef.current[0]?.id ?? ""));
    setDraftRecipeSourceId("");
    setDraftRecipeQuantity("");
    setDraftRecipeUnit("Kg");
    setDraftRecipeStage(defaultRecipeStage);
    setFormBaseline(
      JSON.stringify({
        formState: nextFormState,
        draftRecipeSourceId: "",
        draftRecipeQuantity: "",
        draftRecipeUnit: "Kg",
        draftRecipeStage: defaultRecipeStage,
      }),
    );
    setFormError(null);
    setInvalidFields([]);
    setActiveTab("cadastro");
    // Reset apenas quando o dialog abre, o modo muda, ou outro produto é selecionado.
    // Usamos `product?.id` (não o objeto `product`) de propósito: o pai reconstrói a
    // referência de `product` a cada refresh de snapshot, o que dispararia reset indevido.
  }, [mode, open, product?.id]);

  const sectorNameById = useMemo(
    () => new Map(snapshot.sectors.map((sector) => [sector.id, sector.name])),
    [snapshot.sectors],
  );
  const lineOptions = useMemo(
    () =>
      snapshot.lines.map((line) => ({
        value: line.id,
        label: `${line.name} · ${sectorNameById.get(line.sectorId) ?? "-"}`,
      })),
    [sectorNameById, snapshot.lines],
  );
  const lineOptionsForSearch = useMemo(
    () =>
      snapshot.lines.map((line) => ({
        value: line.id,
        label: line.name,
        description: sectorNameById.get(line.sectorId) ?? "Sem categoria",
        keywords: [line.code],
      })),
    [sectorNameById, snapshot.lines],
  );

  const recipeSourceOptions = useMemo<RecipeSourceOption[]>(
    () => [
      ...snapshot.ingredients.map((ingredient) => ({
        id: ingredient.id,
        label: `${ingredient.code} · ${ingredient.name}`,
        sourceType: "ingrediente" as const,
      })),
      ...snapshot.products
        .filter((candidate) => candidate.canBeIngredient)
        .map((candidate) => ({
          id: candidate.id,
          label: `${candidate.code} · ${candidate.name}`,
          sourceType: "produto" as const,
        })),
    ],
    [snapshot.ingredients, snapshot.products],
  );

  const recipeTotals = useMemo(
    () => getProductRecipeTotalsFromData(formState, snapshot.ingredients, snapshot.products),
    [formState, snapshot.ingredients, snapshot.products],
  );
  const availablePackagingUnits = useMemo(
    () =>
      getPackagingUnitsForSalesUnit(
        formState.unitProfiles.sales.unit,
        formState.packagingProfile?.unit,
      ),
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
  const currentPackagingUnit = useMemo(() => {
    const fallbackUnit = availablePackagingUnits[0] ?? "Un";
    const nextUnit = formState.packagingProfile?.unit ?? fallbackUnit;
    return availablePackagingUnits.includes(nextUnit) ? nextUnit : fallbackUnit;
  }, [availablePackagingUnits, formState.packagingProfile?.unit]);
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
  const yieldPercent = useMemo(
    () => Math.max(0, Number((100 - formState.breakPercent).toFixed(3))),
    [formState.breakPercent],
  );
  // 2.4-F: prévia de como o arredondamento por batida se comporta para a base
  // econômica informada. Reaproveita planBatches() (mesma matemática da OP).
  const salesUnit = formState.unitProfiles.sales.unit;
  const salesUnitLabel = getOperationalUnitLabel(salesUnit);
  const batchPreview = useMemo(() => {
    const capacity = formState.capacityPerBatch;
    if (!capacity || capacity <= 0) return null;
    const totalKg = Number(formState.economicProductionKg);
    if (!Number.isFinite(totalKg) || totalKg <= 0) return null;
    const salesToKgFactor =
      salesUnit === "Kg" ? 1 : formState.unitProfiles.sales.weightKg;
    return planBatches({ totalKg, capacityPerBatch: capacity, salesToKgFactor, salesUnit });
  }, [
    formState.capacityPerBatch,
    formState.economicProductionKg,
    formState.unitProfiles.sales.weightKg,
    salesUnit,
  ]);
  // AJ-0004 / AJ-0004.1: quantidade final precisa (sem arredondamento de unidade
  // discreta), agora consumida da fonte única em `getProductRecipeTotalsFromData`
  // (`finalFractionsQuantityPrecise`) — mesmo valor que propaga a jusante.
  const recipeFinalQuantityPrecise = recipeTotals.finalFractionsQuantityPrecise;
  // XPAN-8: capacidade por batida derivada do ingrediente principal (⭐) + limite físico.
  const hasMainIngredient = useMemo(
    () => formState.recipe.some((item) => item.isMain),
    [formState.recipe],
  );
  const derivedBatchCapacity = useMemo(
    () =>
      deriveCapacityFromProductRecipe({
        recipe: formState.recipe,
        recipeYieldUnits: recipeFinalQuantityPrecise,
        mainIngredientLimitKg: formState.mainIngredientLimitKg,
      }),
    [formState.recipe, recipeFinalQuantityPrecise, formState.mainIngredientLimitKg],
  );
  const recipeSourceOptionsForSearch = useMemo(
    () =>
      recipeSourceOptions.map((option) => ({
        value: option.id,
        label: option.label,
        description:
          option.sourceType === "ingrediente" ? "Ingrediente cadastrado" : "Produto MPI",
        keywords: [
          option.sourceType === "ingrediente"
            ? snapshot.ingredients.find((ingredient) => ingredient.id === option.id)?.shortName
            : snapshot.products.find((product) => product.id === option.id)?.shortName,
        ].filter((keyword): keyword is string => Boolean(keyword?.trim())),
      })),
    [recipeSourceOptions, snapshot.ingredients, snapshot.products],
  );

  function focusFirstInvalidField(fields: ProductValidationField[]) {
    const target = fields.map(getInvalidFieldTarget).find(Boolean);
    if (!target) {
      return;
    }

    setActiveTab(target.tab);
    window.setTimeout(() => {
      document.getElementById(target.id)?.focus();
    }, 0);
  }

  function updateUnitProfile(
    scope: keyof ProductFormState["unitProfiles"],
    patch: Partial<ProductUnitProfile>,
  ) {
    setFormState((current) => {
      const nextUnit = patch.unit ?? current.unitProfiles[scope].unit;
      const nextWeight =
        patch.weightKg ?? (nextUnit === "Kg" ? 1 : current.unitProfiles[scope].weightKg);
      const nextPackagingUnits =
        scope === "sales"
          ? getPackagingUnitsForSalesUnit(nextUnit)
          : getPackagingUnitsForSalesUnit(current.unitProfiles.sales.unit);
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
          // `recipe-${Date.now()}` colidia em dois cliques no mesmo milissegundo — com o
          // mesmo insumo repetido em etapas diferentes (incentivado agora), editar uma
          // linha editava as duas. UUID mata a colisão.
          id: crypto.randomUUID(),
          sourceId: sourceOption.id,
          sourceType: sourceOption.sourceType,
          label: sourceOption.label,
          quantity,
          unit: draftRecipeUnit,
          stage: draftRecipeStage,
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
    patch: Partial<Pick<RecipeIngredientReference, "quantity" | "unit" | "stage">>,
  ) {
    setFormState((current) => ({
      ...current,
      recipe: current.recipe.map((item) =>
        item.id === recipeId
          ? {
              ...item,
              quantity: patch.quantity ?? item.quantity,
              unit: patch.unit ?? item.unit,
              stage: patch.stage ?? item.stage ?? defaultRecipeStage,
            }
          : item,
      ),
    }));
  }

  // XPAN-8: marca o ingrediente principal da receita (radio com toggle-off): clicar
  // marca este e limpa os demais; clicar no já-principal desmarca. Garante ≤ 1 principal
  // (o índice parcial no banco reforça a invariante).
  function setMainRecipeItem(recipeId: string) {
    setFormState((current) => ({
      ...current,
      recipe: current.recipe.map((item) => ({
        ...item,
        isMain: item.id === recipeId ? !item.isMain : false,
      })),
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
    const normalizedPackagingProfile = formState.isSoldLoose
      ? undefined
      : {
          ...(formState.packagingProfile ?? {
            unit: availablePackagingUnits[0],
            description: "",
            weightKg: availablePackagingUnits[0] === "Kg" ? 1 : 0,
            quantityPerPackage: 1,
          }),
          unit: availablePackagingUnits.includes(
            formState.packagingProfile?.unit ?? availablePackagingUnits[0],
          )
            ? (formState.packagingProfile?.unit ?? availablePackagingUnits[0])
            : availablePackagingUnits[0],
        };

    const salesWeight =
      formState.unitProfiles.sales.unit === "Kg" ? 1 : formState.unitProfiles.sales.weightKg;
    const expeditionWeight =
      formState.unitProfiles.expedition.unit === "Kg"
        ? 1
        : formState.unitProfiles.expedition.weightKg;
    const normalizedQuantityPerPackage = formState.isSoldLoose
      ? 0
      : calculateQuantityPerPackage(
          salesWeight,
          normalizedPackagingProfile?.unit === "Kg"
            ? 1
            : (normalizedPackagingProfile?.weightKg ?? 0),
        );

    const nextProduct: ProductFormState = {
      ...formState,
      preparationStages: normalizeProductPreparationStages(formState.preparationStages),
      salesUnit: formState.unitProfiles.sales.unit,
      productionUnit: formState.unitProfiles.production.unit,
      expeditionUnit: formState.unitProfiles.expedition.unit,
      salesToKgFactor: salesWeight,
      expeditionToKgFactor: expeditionWeight,
      weight: formatKgLabel(salesWeight, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
      isMpiIngredient: formState.canBeIngredient,
      packagingProfile: normalizedPackagingProfile
        ? {
            ...normalizedPackagingProfile,
            weightKg:
              normalizedPackagingProfile.unit === "Kg"
                ? 1
                : normalizedPackagingProfile.weightKg,
            quantityPerPackage: normalizedQuantityPerPackage,
          }
        : undefined,
    };

    const validation = validateProductFormState({
      product: nextProduct,
      availablePackagingUnits,
    });
    if (validation.error) {
      setInvalidFields(validation.invalidFields);
      setFormError(validation.error);
      focusFirstInvalidField(validation.invalidFields);
      return;
    }

    // For existing products, require a commit description before saving
    if (product) {
      setPendingProductPayload(nextProduct);
      setCommitDescription("");
      setIsCommitDialogOpen(true);
      return;
    }

    await submitProduct(nextProduct, null);
  }

  async function submitProduct(payload: ProductFormState, changeDescription: string | null) {
    setIsSubmitting(true);
    setFormError(null);
    setInvalidFields([]);

    try {
      const body = changeDescription
        ? { ...payload, changeDescription }
        : payload;

      const response = await fetch(
        product ? `/api/master-data/products/${product.id}` : "/api/master-data/products",
        {
          method: product ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const respBody = (await response.json().catch(() => null)) as
        | { message?: string; scheduleRevisionImpact?: ScheduleRevisionRebuildImpact | null }
        | null;

      if (!response.ok) {
        throw new Error(respBody?.message ?? "Falha ao salvar produto");
      }

      await refresh();
      setIsCommitDialogOpen(false);
      onOpenChange(false);

      // AJ-0025: orienta a reauditoria quando o cronograma foi reconstruído pela edição.
      const impact = respBody?.scheduleRevisionImpact ?? null;
      if (impact) {
        toast.warning(
          impact.activeScheduleKept
            ? `Revisão pendente aberta (${impact.affectedProducts} produto(s)). O cronograma ativo foi MANTIDO porque há OPs liberadas/lançadas — reaudite a revisão para aplicar as mudanças.`
            : impact.recreated
              ? `Cronograma reconstruído (${impact.affectedProducts} produto(s) afetado(s)). Reaudite o cronograma antes de liberar os pedidos.`
              : `Revisão pendente do cronograma atualizada (${impact.affectedProducts} produto(s)). Reaudite antes de liberar.`,
        );
      }
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Falha ao salvar produto");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateLine() {
    if (!lineDraft.name.trim() || !lineDraft.sectorId) {
      setFormError(
        `Informe nome e ${hierarchyLabels.sector.toLowerCase()} da nova ${hierarchyLabels.line.toLowerCase()}.`,
      );
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

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        id?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? `Falha ao criar ${hierarchyLabels.line.toLowerCase()}`);
      }

      const createdLineId = body?.id ?? null;
      await refresh();
      if (createdLineId) {
        setFormState((current) => ({ ...current, lineId: createdLineId }));
      }
      setIsLineDialogOpen(false);
      setLineDraft(buildLineDraft(lineDraft.sectorId));
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : `Falha ao criar ${hierarchyLabels.line.toLowerCase()}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateCategory() {
    if (!categoryDraft.name.trim() || !categoryDraft.responsible.trim()) {
      setFormError(`Informe nome e responsável da nova ${hierarchyLabels.sector.toLowerCase()}.`);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/master-data/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: categoryDraft.name,
          responsible: categoryDraft.responsible,
          status: "ativo",
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        id?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? `Falha ao criar ${hierarchyLabels.sector.toLowerCase()}`);
      }

      const createdCategoryId = body?.id ?? null;
      await refresh();
      // Seleciona a categoria recém-criada no rascunho da linha (preserva o resto do form).
      if (createdCategoryId) {
        setLineDraft((current) => ({ ...current, sectorId: createdCategoryId }));
      }
      setIsCategoryDialogOpen(false);
      setCategoryDraft({ name: "", responsible: "" });
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : `Falha ao criar ${hierarchyLabels.sector.toLowerCase()}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            if (!formGuard.confirmIfNeeded()) {
              return;
            }
            setFormError(null);
            setInvalidFields([]);
          }

          onOpenChange(nextOpen);
        }}
      >
        <DialogContent
          size="3xl"
          className="flex max-h-[92vh] flex-col overflow-hidden rounded-[28px] bg-white p-0 sm:max-w-[1080px]"
        >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {!product
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
          <div className="flex flex-col gap-3 rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm text-info-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Modo visualização: revise os dados do produto sem alterar o cadastro.</span>
            {product && onRequestEdit ? (
              <Button type="button" variant="outline" size="sm" onClick={onRequestEdit}>
                <Pencil className="size-4" />
                Editar
              </Button>
            ) : null}
          </div>
        ) : null}
        {formDirty ? (
          <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
            Existem alterações pendentes neste produto.
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                    Nome completo, nome reduzido, código da fábrica, código da loja, descrição e vínculo com a linha principal de produção.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="grid gap-2">
                    <Label htmlFor="product-name">Nome completo do produto *</Label>
                    <Input
                      id="product-name"
                      placeholder="Ex: Pão Francês"
                      aria-invalid={invalidFields.includes("name")}
                      className={cn(
                        invalidFields.includes("name") &&
                          "border-danger/60 ring-1 ring-danger/40 focus-visible:ring-danger/50",
                      )}
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product-short-name">Nome reduzido</Label>
                    <Input
                      id="product-short-name"
                      placeholder="Ex: Pão Fr."
                      value={formState.shortName ?? ""}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          shortName: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Código da fábrica</Label>
                    <Input value={formState.code} disabled className="bg-muted" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product-external-code">Código da loja</Label>
                    <Input
                      id="product-external-code"
                      value={formState.externalCode ?? ""}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          externalCode: event.target.value,
                        }))
                      }
                      placeholder="Código da loja"
                    />
                  </div>
                  <div className="grid gap-2 md:col-span-4">
                    <Label>Descrição</Label>
                    <Input
                      value={formState.description}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Descrição do produto"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="grid gap-2">
                    <Label>{hierarchyLabels.line} *</Label>
                    {lineOptions.length >= 8 ? (
                      <SearchableSelect
                        id="product-line"
                        ariaInvalid={invalidFields.includes("lineId")}
                        value={formState.lineId}
                        onValueChange={(value) =>
                          setFormState((current) => ({ ...current, lineId: value }))
                        }
                        options={lineOptionsForSearch}
                        placeholder={`Selecione a ${hierarchyLabels.line.toLowerCase()}`}
                        searchPlaceholder="Buscar linha de produção..."
                        emptyMessage="Nenhuma linha encontrada."
                        title="Selecionar linha de produção"
                        description="Busque pela linha ou pelo código para vincular o produto ao cadastro mestre."
                        className={cn(
                          invalidFields.includes("lineId") &&
                            "border-danger/60 ring-1 ring-danger/40 focus-visible:ring-danger/50",
                        )}
                      />
                    ) : (
                      <Select
                        value={formState.lineId}
                        onValueChange={(value) =>
                          setFormState((current) => ({ ...current, lineId: value }))
                        }
                      >
                        <SelectTrigger
                          id="product-line"
                          aria-invalid={invalidFields.includes("lineId")}
                          className={cn(
                            invalidFields.includes("lineId") &&
                              "border-danger/60 ring-1 ring-danger/40 focus:ring-danger/50",
                          )}
                        >
                          <SelectValue
                            placeholder={`Selecione a ${hierarchyLabels.line.toLowerCase()}`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {lineOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">
                      O cronograma ativo usa esta linha de produção como referência cadastral. Se
                      precisar realocar o produto entre linhas de produção, faça a alteração aqui.
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Dialog
                      open={isLineDialogOpen}
                      onOpenChange={(nextOpen) => {
                        setIsLineDialogOpen(nextOpen);
                        if (nextOpen) {
                          setLineDraft((current) =>
                            current.sectorId
                              ? current
                              : buildLineDraft(snapshot.sectors[0]?.id ?? ""),
                          );
                        }
                      }}
                    >
                      <Button type="button" variant="outline" onClick={() => setIsLineDialogOpen(true)}>
                        <Plus className="size-4" />
                        Nova {hierarchyLabels.line}
                      </Button>
                      <DialogContent size="lg">
                        <DialogHeader>
                          <DialogTitle>Nova {hierarchyLabels.line}</DialogTitle>
                          <DialogDescription>
                            Cadastre a nova {hierarchyLabels.line.toLowerCase()} sem sair do produto.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                          <div className="grid gap-2">
                            <Label>Nome completo da linha de produção *</Label>
                            <Input
                              value={lineDraft.name}
                              onChange={(event) =>
                                setLineDraft((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                              placeholder="Ex: Linha Ovos de Páscoa"
                            />
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="grid gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <Label>{hierarchyLabels.sector} *</Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto px-1.5 py-0.5 text-xs"
                                  onClick={() => setIsCategoryDialogOpen(true)}
                                >
                                  <Plus className="size-3.5" />
                                  Nova {hierarchyLabels.sector.toLowerCase()}
                                </Button>
                              </div>
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
                                  setLineDraft((current) => ({
                                    ...current,
                                    capacityPerDayKg: event.target.value,
                                  }))
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
                                  setLineDraft((current) => ({
                                    ...current,
                                    operatingHours: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsLineDialogOpen(false)}
                            disabled={isSubmitting}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void handleCreateLine()}
                            disabled={isSubmitting}
                          >
                            Criar {hierarchyLabels.line}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* AJ-0026: criação inline de categoria — abre por cima do modal de
                        linha, preserva o rascunho da linha e auto-seleciona ao criar. */}
                    <Dialog
                      open={isCategoryDialogOpen}
                      onOpenChange={(nextOpen) => {
                        setIsCategoryDialogOpen(nextOpen);
                        if (!nextOpen) {
                          setCategoryDraft({ name: "", responsible: "" });
                        }
                      }}
                    >
                      <DialogContent size="lg">
                        <DialogHeader>
                          <DialogTitle>Nova {hierarchyLabels.sector.toLowerCase()}</DialogTitle>
                          <DialogDescription>
                            Cadastre a nova {hierarchyLabels.sector.toLowerCase()} sem sair da{" "}
                            {hierarchyLabels.line.toLowerCase()}.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                          <div className="grid gap-2">
                            <Label>Nome da {hierarchyLabels.sector.toLowerCase()} *</Label>
                            <Input
                              value={categoryDraft.name}
                              onChange={(event) =>
                                setCategoryDraft((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                              placeholder="Ex: Confeitaria"
                              autoFocus
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Responsável *</Label>
                            <Input
                              value={categoryDraft.responsible}
                              onChange={(event) =>
                                setCategoryDraft((current) => ({
                                  ...current,
                                  responsible: event.target.value,
                                }))
                              }
                              placeholder="Ex: Maria Silva"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCategoryDialogOpen(false)}
                            disabled={isSubmitting}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void handleCreateCategory()}
                            disabled={isSubmitting}
                          >
                            Criar {hierarchyLabels.sector.toLowerCase()}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </section>

            </fieldset>
          </TabsContent>

          <TabsContent value="receita">
            <fieldset disabled={isReadOnly} className="space-y-5">
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
                      {formState.unitProfiles.sales.unit} ·{" "}
                      {formatKgLabel(formState.salesToKgFactor, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Produção
                    </p>
                    <div className="rounded-lg border border-border/70 bg-panel/25 px-3 py-3 text-sm text-foreground">
                      {formState.unitProfiles.production.unit} ·{" "}
                      {formatKgLabel(formState.unitProfiles.production.weightKg, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Expedição
                    </p>
                    <div className="rounded-lg border border-border/70 bg-panel/25 px-3 py-3 text-sm text-foreground">
                      {formState.unitProfiles.expedition.unit} ·{" "}
                      {formatKgLabel(formState.expeditionToKgFactor, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-border/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Unidades de Medida e Conversões
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Kg é a base universal da engenharia. Defina embalagem, venda, produção e
                    expedição no mesmo quadro, com tipo, descrição e peso padrão próprios.
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
                        <div
                          key={`${scope}-type`}
                          className="border-r border-border/70 px-3 py-3 last:border-r-0"
                        >
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
                        id="product-packaging-description"
                        aria-label="Descrição da embalagem"
                        value={formState.packagingProfile?.description ?? ""}
                        disabled={formState.isSoldLoose}
                        aria-invalid={invalidFields.includes("packagingDescription")}
                        className={cn(
                          invalidFields.includes("packagingDescription") &&
                            "border-danger/60 ring-1 ring-danger/40 focus-visible:ring-danger/50",
                        )}
                        onChange={(event) =>
                          updatePackagingProfile({ description: event.target.value })
                        }
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
                      <div
                        key={`${scope}-description`}
                        className="border-r border-border/70 px-3 py-3 last:border-r-0"
                      >
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
                        id="product-packaging-weight"
                        aria-label="Peso padrão da embalagem"
                        type="number"
                        step="0.001"
                        value={
                          formState.isSoldLoose
                            ? ""
                            : packagingWeightLockedToKg
                              ? 1
                              : (formState.packagingProfile?.weightKg ?? "")
                        }
                        disabled={formState.isSoldLoose || packagingWeightLockedToKg}
                        aria-invalid={
                          invalidFields.includes("packagingWeight") ||
                          invalidFields.includes("packagingQuantity")
                        }
                        className={cn(
                          (invalidFields.includes("packagingWeight") ||
                            invalidFields.includes("packagingQuantity")) &&
                            "border-danger/60 ring-1 ring-danger/40 focus-visible:ring-danger/50",
                        )}
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
                        <div
                          key={`${scope}-weight`}
                          className="border-r border-border/70 px-3 py-3 last:border-r-0"
                        >
                          <Input
                            aria-label={`Peso padrão de ${title}`}
                            type="number"
                            step="0.001"
                            value={lockedToKg ? 1 : profile.weightKg}
                            disabled={lockedToKg}
                            onChange={(event) =>
                              updateUnitProfile(scope, { weightKg: Number(event.target.value) })
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-border/70 bg-panel/25 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Conteúdo por embalagem
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {formState.isSoldLoose ? "-" : calculatedQuantityPerPackage.toFixed(3)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Relação automática entre peso de venda e peso da embalagem.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-panel/25 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Venda
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formState.unitProfiles.sales.unit}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Peso convertido:{" "}
                      {formatKgLabel(formState.salesToKgFactor, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-panel/25 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Expedição
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formState.unitProfiles.expedition.unit}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Fator:{" "}
                      {formatKgLabel(formState.expeditionToKgFactor, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="sold-loose"
                        checked={formState.isSoldLoose}
                        onCheckedChange={(checked) =>
                          setFormState((current) => ({
                            ...current,
                            isSoldLoose: checked === true,
                            packagingProfile:
                              checked === true ? undefined : current.packagingProfile,
                          }))
                        }
                      />
                      <div>
                        <Label htmlFor="sold-loose" className="text-sm font-semibold">
                          Vendido solto
                        </Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Desative a embalagem individual quando o item não for fracionado.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-border/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Ingredientes da Receita</h3>
                  <p className="text-xs text-muted-foreground">
                    Monte a receita técnica do produto com ingredientes comuns ou produtos MPI. O
                    mesmo insumo pode entrar em mais de uma etapa (ex.: farinha na esponja e na
                    massa) com pesos próprios.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="grid gap-2 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>Ingrediente / Produto MPI</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsIngredientDialogOpen(true)}
                      >
                        <Plus className="size-4" />
                        Novo ingrediente
                      </Button>
                    </div>
                    {recipeSourceOptions.length >= 8 ? (
                      <SearchableSelect
                        value={draftRecipeSourceId}
                        onValueChange={(id) => {
                          setDraftRecipeSourceId(id);
                          const source = recipeSourceOptions.find((o) => o.id === id);
                          if (source?.sourceType === "ingrediente") {
                            const ingredient = snapshot.ingredients.find((i) => i.id === id);
                            if (ingredient) setDraftRecipeUnit(ingredient.unit);
                          } else if (source?.sourceType === "produto") {
                            const product = snapshot.products.find((p) => p.id === id);
                            if (product) setDraftRecipeUnit(product.salesUnit);
                          }
                        }}
                        options={recipeSourceOptionsForSearch}
                        placeholder="Selecione a referência"
                        searchPlaceholder="Buscar ingrediente ou produto MPI..."
                        emptyMessage="Nenhuma referência encontrada."
                        title="Selecionar referência da receita"
                        description="Busque pelo nome ou código do ingrediente ou produto MPI."
                      />
                    ) : (
                      <Select value={draftRecipeSourceId} onValueChange={(id) => {
                        setDraftRecipeSourceId(id);
                        const source = recipeSourceOptions.find((o) => o.id === id);
                        if (source?.sourceType === "ingrediente") {
                          const ingredient = snapshot.ingredients.find((i) => i.id === id);
                          if (ingredient) setDraftRecipeUnit(ingredient.unit);
                        } else if (source?.sourceType === "produto") {
                          const product = snapshot.products.find((p) => p.id === id);
                          if (product) setDraftRecipeUnit(product.salesUnit);
                        }
                      }}>
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
                    )}
                    <p className="text-xs text-muted-foreground">
                      Se o ingrediente ainda não existir, cadastre-o aqui sem sair do produto.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Etapa</Label>
                    <Select
                      value={draftRecipeStage}
                      onValueChange={(value) => setDraftRecipeStage(value as RecipeStage)}
                    >
                      <SelectTrigger aria-label="Etapa do ingrediente">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {recipeStages.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {recipeStageLabels[stage]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Função do insumo no produto — agrupa a pesagem na impressão.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={draftRecipeQuantity}
                      onChange={(event) => setDraftRecipeQuantity(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unidade</Label>
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground">
                      {getOperationalUnitLabel(draftRecipeUnit)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Definida no cadastro do ingrediente.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={addRecipeItem}>
                    <Plus className="size-4" />
                    Adicionar item
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[760px] border-collapse">
                    <thead className="bg-card">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Referência
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                              Etapa
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                              Qtd
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                              Unidade
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {formState.recipe.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="border-t border-border/70 bg-card px-3 py-3 text-sm text-muted-foreground"
                              >
                                Nenhum item na receita.
                              </td>
                            </tr>
                          ) : (
                            formState.recipe.map((item) => (
                              <tr key={item.id}>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                  {item.label}
                                </td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                  <Select
                                    value={item.stage ?? defaultRecipeStage}
                                    onValueChange={(value) =>
                                      updateRecipeItem(item.id, { stage: value as RecipeStage })
                                    }
                                  >
                                    <SelectTrigger aria-label={`Etapa de ${item.label}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {recipeStages.map((stage) => (
                                        <SelectItem key={stage} value={stage}>
                                          {recipeStageLabels[stage]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={item.quantity}
                                    onChange={(event) =>
                                      updateRecipeItem(item.id, {
                                        quantity: Number(event.target.value),
                                      })
                                    }
                                  />
                                </td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm text-muted-foreground">
                                  {getOperationalUnitLabel(item.unit)}
                                </td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className={cn(
                                        "hover:text-foreground",
                                        item.isMain ? "text-warning" : "text-muted-foreground/50",
                                      )}
                                      onClick={() => setMainRecipeItem(item.id)}
                                      aria-pressed={item.isMain ?? false}
                                      title={
                                        item.isMain
                                          ? "Ingrediente principal (clique para desmarcar)"
                                          : "Marcar como ingrediente principal — base da capacidade por batida (XPAN-8)"
                                      }
                                    >
                                      <Star className={cn("size-4", item.isMain ? "fill-current" : "")} />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => moveRecipeItem(item.id, "up")}
                                      disabled={
                                        formState.recipe.findIndex((entry) => entry.id === item.id) ===
                                        0
                                      }
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
                                      disabled={
                                        formState.recipe.findIndex((entry) => entry.id === item.id) ===
                                        formState.recipe.length - 1
                                      }
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
              </section>

              <section className="space-y-4 rounded-xl border border-border/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Parâmetros de Produção</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure perdas, validade, bases de produção e rendimento líquido esperado.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
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
                  <div className="grid gap-2">
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
                  <div className="grid gap-2">
                    <Label>Capacidade por batida (em {salesUnitLabel}; vazio = sem batida)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formState.capacityPerBatch ?? ""}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          capacityPerBatch:
                            event.target.value === "" ? null : Number(event.target.value),
                        }))
                      }
                    />
                    {batchPreview ? (
                      <p className="text-xs text-muted-foreground">
                        Base econômica ={" "}
                        {batchPreview.batchCount === 1
                          ? `1 batida de ${formatLocaleNumber(batchPreview.batchSizes[0])} ${batchPreview.unitLabel}.`
                          : `${batchPreview.batchCount} batidas de ${formatLocaleNumber(
                              batchPreview.batchSizes[0],
                            )} ${batchPreview.unitLabel}; última com ${formatLocaleNumber(
                              batchPreview.batchSizes[batchPreview.batchSizes.length - 1],
                            )} ${batchPreview.unitLabel}.`}
                      </p>
                    ) : null}
                  </div>
                  {/* XPAN-8: derivar a capacidade por batida do limite físico do ingrediente principal. */}
                  <div className="grid gap-2">
                    <Label>Limite do ingrediente principal por batida (Kg)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        placeholder="ex.: 50 (kg de trigo que a masseira comporta)"
                        value={formState.mainIngredientLimitKg ?? ""}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            mainIngredientLimitKg:
                              event.target.value === "" ? null : Number(event.target.value),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={derivedBatchCapacity === null}
                        onClick={() =>
                          setFormState((current) => ({ ...current, capacityPerBatch: derivedBatchCapacity }))
                        }
                        title="Calcular a capacidade por batida a partir do limite do ingrediente principal"
                      >
                        Derivar capacidade
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {!hasMainIngredient
                        ? "Marque um ingrediente como principal (⭐) na lista de ingredientes da receita e informe o limite físico da masseira para derivar a capacidade por batida automaticamente."
                        : formState.mainIngredientLimitKg == null
                          ? "Informe o limite físico (kg) do ingrediente principal que a masseira comporta por batida."
                          : derivedBatchCapacity === null
                            ? "Não foi possível derivar: o ingrediente principal precisa estar em Kg e a receita precisa ter rendimento e quantidade válidos."
                            : `Rende ~${formatLocaleNumber(derivedBatchCapacity)} ${salesUnitLabel} por batida (limite de ${formatLocaleNumber(
                                formState.mainIngredientLimitKg,
                              )} kg do ingrediente principal). Clique em “Derivar capacidade” para aplicar acima.`}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Unidade do lote econômico</Label>
                    <Select
                      value={formState.economicBatchUnit ?? "none"}
                      onValueChange={(value) =>
                        setFormState((current) => ({
                          ...current,
                          economicBatchUnit:
                            value === "none"
                              ? null
                              : (value as ProductionProduct["economicBatchUnit"]),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Não definido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não definido</SelectItem>
                        <SelectItem value="kg">Kg</SelectItem>
                        <SelectItem value="forma">Forma</SelectItem>
                        <SelectItem value="maceira">Maceira</SelectItem>
                        <SelectItem value="pacote">Pacote</SelectItem>
                        <SelectItem value="unidade">Unidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end md:col-span-2">
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
                  <p className="mt-2 text-3xl font-semibold text-emerald-900">
                    {formatLocaleNumber(yieldPercent, {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })}
                    %
                  </p>
                  <p className="mt-2 text-xs text-emerald-800">
                    Percentual líquido estimado depois da perda principal informada.
                  </p>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/80 bg-panel/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Totais da Receita
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    Total de ingredientes:{" "}
                    {formatKgLabel(recipeTotals.totalIngredientsKg, {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Peso final após a perda principal:{" "}
                    {formatKgLabel(recipeTotals.outputAfterBreakKg, {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quantidade final prevista:{" "}
                    <strong>
                      {formatLocaleNumber(recipeFinalQuantityPrecise, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}{" "}
                      {recipeTotals.finalOutputUnit}
                    </strong>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Peso unitário considerado:{" "}
                    <strong>
                      {formatKgLabel(recipeTotals.fractionUnitWeightKg, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </strong>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Frações finais estimadas:{" "}
                    <strong>
                      {formatLocaleNumber(recipeFinalQuantityPrecise, {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </strong>
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
                        setFormState((current) => ({
                          ...current,
                          breakComment: event.target.value,
                        }))
                      }
                      placeholder="Ex: perda antes do forno por divisão"
                    />
                  </div>
                </div>
              </section>

              <div
                id="product-preparation-stages"
                tabIndex={-1}
                className={cn(
                  "rounded-xl",
                  invalidFields.includes("preparationStages") &&
                    "border border-danger/50 bg-danger/10 p-2",
                )}
              >
                <ProductPreparationStagesEditor
                  value={formState.preparationStages}
                  disabled={isReadOnly}
                  onChange={(preparationStages) =>
                    setFormState((current) => ({ ...current, preparationStages }))
                  }
                />
              </div>

              <section className="grid gap-2">
                <Label>Instruções de preparo</Label>
                <Textarea
                  value={formState.preparationMode}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      preparationMode: event.target.value,
                    }))
                  }
                  className="min-h-[140px]"
                  placeholder="Descreva observações, checkpoints ou cuidados específicos do preparo..."
                />
              </section>
            </fieldset>
          </TabsContent>

          <TabsContent value="cronograma">
            <fieldset disabled={isReadOnly} className="space-y-5">
              <section className="space-y-4 rounded-xl border border-border/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Cronograma definido pelo produto
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Defina os dias de fabricação. O fluxo operacional sempre considera: dia do
                    pedido, dia de produção, dia de expedição/entrega e dia previsto de venda.
                  </p>
                </div>
                <OperationalSequenceCard
                  eyebrow="Leitura do cronograma"
                  title="Como o sistema transforma o pedido em produção, entrega e venda"
                  description="O produto participa do cronograma da loja dentro desta sequência, sempre na mesma ordem."
                  steps={[
                    {
                      key: "ordered",
                      label: "Pedido",
                      value: "Janela operacional da loja",
                      helper: "O pedido entra no dia-base permitido para a loja, respeitando cutoff e dias operacionais.",
                      tone: "neutral",
                    },
                    {
                      key: "production",
                      label: "Produzir",
                      value: `${formState.expeditionLeadDays} dia(s) antes da entrega`,
                      helper: "Antecedência necessária pra produção (esfriamento, descanso, etc.). Configurada por produto.",
                      tone: "info",
                    },
                    {
                      key: "delivery",
                      label: "Expedir / entregar",
                      value: `D+${snapshot.operationalSettings.expeditionLeadDays} da base`,
                      helper: "Regra global da fábrica (D+X). Configurada nas Regras de Pedido e Expedição.",
                      tone: "warning",
                    },
                    {
                      key: "sale",
                      label: "Vender a partir de",
                      value:
                        normalizeSaleLeadDays(snapshot.operationalSettings.saleLeadDays) === 0
                          ? "No mesmo dia da entrega"
                          : `Entrega + ${normalizeSaleLeadDays(snapshot.operationalSettings.saleLeadDays)} dia(s)`,
                      helper: "Configurado globalmente nas regras da fábrica (D+Y após entrega).",
                      tone: "success",
                    },
                  ]}
                  footer="Relação explícita: a produção precisa caber entre a base operacional do pedido e a entrega prometida. Se não houver um dia compatível, o item fica bloqueado no cronograma."
                />
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
                        <p className="text-xs font-semibold uppercase tracking-[0.08em]">
                          {day.shortLabel}
                        </p>
                        <p className="mt-1 text-sm">{day.label}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Antecedência de produção (dias)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      value={formState.expeditionLeadDays}
                      disabled={isReadOnly}
                      onChange={(e) =>
                        setFormState((current) => ({
                          ...current,
                          expeditionLeadDays:
                            e.target.value === "" || Number.isNaN(Number(e.target.value))
                              ? 1
                              : Math.max(0, Number(e.target.value)),
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Quantos dias antes da expedição esse item precisa começar a ser produzido. Bolos: <strong>1</strong> (esfriar 1 dia). Pão fresco produzido no mesmo dia: <strong>0</strong>.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-panel/25 p-4 text-sm text-muted-foreground">
                  Fluxo: pedido → produção {formState.expeditionLeadDays} dia(s) antes da expedição → entrega → venda no dia seguinte (D+Y global em Configurações de fábrica).
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
                      Quando ativado, o produto aparece como insumo disponível nas receitas de
                      outros produtos.
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Produto MPI</strong> = item que pode
                      ser <em>vendido</em> e também <em>reutilizado</em> em outra receita. É
                      diferente do <strong className="text-foreground">ingrediente puro</strong>{" "}
                      (comprado direto do fornecedor) e do{" "}
                      <strong className="text-foreground">ingrediente misturado</strong>{" "}
                      (receita interna que não é vendida), cadastrados em Ingredientes.
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
                            : (formState.ingredientProfile?.weightKg ??
                              formState.unitProfiles.sales.weightKg),
                        purchaseUnit:
                          formState.ingredientProfile?.purchaseUnit ??
                          formState.ingredientProfile?.unit ??
                          "Kg",
                        purchaseToConsumptionFactor:
                          formState.ingredientProfile?.purchaseToConsumptionFactor ?? 1,
                        metadata: formState.ingredientProfile?.metadata ?? "",
                        observation: formState.ingredientProfile?.observation ?? "",
                      }}
                      unitOptions={productUnitOptions}
                      showPurchaseFields
                      purchaseHelperText="1 unidade de compra equivale a este fator multiplicado pela unidade de consumo."
                      metadataPlaceholder="Ex: usar como base de sanduíches, consumir após resfriar"
                      onChange={(patch) =>
                        setFormState((current) => ({
                          ...current,
                          ingredientProfile: {
                            unit:
                              (patch.unit as ProductUnitProfile["unit"] | undefined) ??
                              current.ingredientProfile?.unit ??
                              "Kg",
                            weightKg:
                              patch.unit === "Kg"
                                ? 1
                                : (patch.weightKg ??
                                  current.ingredientProfile?.weightKg ??
                                  current.unitProfiles.sales.weightKg),
                            purchaseUnit:
                              (patch.purchaseUnit as ProductUnitProfile["unit"] | undefined) ??
                              current.ingredientProfile?.purchaseUnit ??
                              current.ingredientProfile?.unit ??
                              "Kg",
                            purchaseToConsumptionFactor:
                              patch.purchaseToConsumptionFactor ??
                              current.ingredientProfile?.purchaseToConsumptionFactor ??
                              1,
                            metadata:
                              patch.metadata ?? current.ingredientProfile?.metadata ?? "",
                            observation:
                              patch.observation ??
                              current.ingredientProfile?.observation ??
                              "",
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
                    Ative a flag acima para espelhar os campos do cadastro de ingrediente dentro do
                    produto.
                  </div>
                )}
              </section>
            </fieldset>
          </TabsContent>
        </Tabs>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/80 bg-white px-5 py-4">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {formError && !isReadOnly ? (
              <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground sm:max-w-xl">
                {formError}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                {!isReadOnly ? "Revise os dados e salve quando concluir as alterações." : null}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!formGuard.confirmIfNeeded()) {
                    return;
                  }
                  onOpenChange(false);
                }}
              >
                {isReadOnly ? "Fechar" : "Cancelar"}
              </Button>
              {!isReadOnly ? (
                <Button type="button" onClick={() => void handleSaveProduct()} disabled={isSubmitting}>
                  {product ? "Salvar Alterações" : "Cadastrar Produto"}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCommitDialogOpen} onOpenChange={setIsCommitDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar alteração</DialogTitle>
            <DialogDescription>
              Descreva o que foi alterado neste produto. Este registro ficará no histórico de versões.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Descrição da alteração *</Label>
              <Textarea
                value={commitDescription}
                onChange={(e) => setCommitDescription(e.target.value)}
                placeholder="Ex: Ajustou peso da receita, alterou dias de produção..."
                className="min-h-[80px]"
                autoFocus
              />
            </div>
            {isOperationalProduct ? (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                <p className="text-xs text-foreground">
                  Este produto está no cronograma operacional. Salvar vai{" "}
                  <strong>reconstruir a revisão pendente</strong> do cronograma e os pedidos afetados
                  precisarão ser <strong>reauditados/reliberados</strong> antes de liberar para produção.
                </p>
              </div>
            ) : null}
            <div className="rounded-lg border border-border/70 bg-panel/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Assinatura: <strong className="text-foreground">{product?.name ?? "Produto"}</strong>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCommitDialogOpen(false)}
              disabled={isSubmitting}
            >
              Voltar
            </Button>
            <Button
              type="button"
              disabled={!commitDescription.trim() || isSubmitting}
              onClick={() => {
                if (pendingProductPayload) {
                  void submitProduct(pendingProductPayload, commitDescription.trim());
                }
              }}
            >
              {isSubmitting ? "Salvando..." : "Confirmar e salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IngredientFormDialog
        open={isIngredientDialogOpen}
        onOpenChange={setIsIngredientDialogOpen}
        mode="edit"
        snapshot={snapshot}
        refresh={refresh}
        allowSaveAndCreateAnother={false}
        onSaved={(ingredient) => {
          setDraftRecipeSourceId(ingredient.id);
          setDraftRecipeUnit(ingredient.unit);
          setIsIngredientDialogOpen(false);
        }}
      />
    </>
  );
}
