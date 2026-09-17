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
  defaultCountsTowardMixer,
  hierarchyLabels,
  productionWeekDays,
  recipeItemCountsTowardMixer,
  recipeStageLabels,
  recipeStages,
  type BreakStage,
  type IngredientCompositionItem,
  type PackagingProfile,
  type ProductLabTest,
  type ProductUnitProfile,
  type ProductionLine,
  type ProductionProduct,
  type RecipeIngredientReference,
  type RecipeStage,
  type RecipeStageConfigEntry,
} from "@/lib/production-planning";
import {
  addRecipeStage,
  canRemoveRecipeStage,
  getAddableRecipeStages,
  getRecipeStageBlocks,
  insertRecipeItemInStage,
  moveRecipeItemToStage,
  moveRecipeItemWithinStage,
  moveRecipeStage,
  removeRecipeStage,
  setRecipeStageInstructions,
} from "@/lib/recipe-stage-editor";
import {
  getOperationalUnitLabel,
  getOperationalUnitOptions,
  preferredOperationalUnits,
} from "@/lib/operational-units";
import { findDuplicateExternalCode, normalizeExternalCode } from "@/lib/ingredient-form-logic";
import { getProductDisplayCode, normalizeGtin } from "@/lib/product-identity";
import { getProductRecipeTotalsFromData, getRecipeReferenceWeightKgFromData } from "@/lib/production-data-utils";
import {
  applyLabTestToProduct,
  bakerPercentLegalHint,
  computeLabTest,
  computeRecipeBakerPercents,
  emptyLabTest,
  ingredientKgPerFinishedUnit,
} from "@/lib/lab-test";
import { normalizeSaleLeadDays } from "@/lib/order-planning";
import { deriveCapacityFromProductRecipe, deriveEconomicProductionKg, formatBatchSizesPhrase, planBatches } from "@/lib/production-batches";
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

/**
 * Rascunho do "adicionar ingrediente" — um POR BLOCO. A ficha é editada em blocos (etapa), então
 * o formulário de adição mora dentro do bloco e o item já nasce naquela etapa; não existe mais um
 * formulário solto no topo pedindo a etapa num dropdown.
 */
type RecipeDraftState = {
  sourceId: string;
  quantity: string;
  unit: RecipeIngredientReference["unit"];
};

const emptyRecipeDraft: RecipeDraftState = { sourceId: "", quantity: "", unit: "Kg" };

function readOptionalNumber(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

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
  const [recipeDrafts, setRecipeDrafts] = useState<Partial<Record<RecipeStage, RecipeDraftState>>>(
    {},
  );
  // Bloco que abriu o cadastro de ingrediente inline — o insumo criado volta pro rascunho dele.
  const [ingredientDialogStage, setIngredientDialogStage] = useState<RecipeStage>(defaultRecipeStage);
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
      recipeDrafts,
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
    setRecipeDrafts({});
    setIngredientDialogStage(defaultRecipeStage);
    setFormBaseline(
      JSON.stringify({
        formState: nextFormState,
        recipeDrafts: {},
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
  const duplicateExternalCode = useMemo(
    () =>
      findDuplicateExternalCode(
        formState.externalCode ?? "",
        snapshot.products,
        product?.id ?? null,
      ),
    [formState.externalCode, product?.id, snapshot.products],
  );
  const isNewProduct = !product;
  const storeCodeGateBlocked =
    !isReadOnly &&
    isNewProduct &&
    (!normalizeExternalCode(formState.externalCode) || Boolean(duplicateExternalCode));

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
          label: `${getProductDisplayCode(candidate)} · ${candidate.name}`,
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
  // Unidade dos rascunhos abertos em cada bloco — mantém a unidade legada do insumo escolhido
  // na lista de opções enquanto o item ainda não foi adicionado à receita.
  const recipeDraftUnits = useMemo(
    () => Object.values(recipeDrafts).map((draft) => draft?.unit),
    [recipeDrafts],
  );
  const productUnitOptions = useMemo(
    () =>
      getOperationalUnitOptions(
        formState.unitProfiles.sales.unit,
        formState.unitProfiles.production.unit,
        formState.unitProfiles.expedition.unit,
        formState.ingredientProfile?.unit,
        ...recipeDraftUnits,
        ...formState.recipe.map((item) => item.unit),
      ),
    [
      recipeDraftUnits,
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
  const labComputation = useMemo(
    () =>
      computeLabTest({
        recipeTotalKg: recipeTotals.totalIngredientsKg,
        labTest: formState.labTest ?? emptyLabTest(),
      }),
    [formState.labTest, recipeTotals.totalIngredientsKg],
  );
  const recipeLineMetrics = useMemo(() => {
    const ingredientsById = new Map(snapshot.ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const productsById = new Map(snapshot.products.map((entry) => [entry.id, entry]));
    const rows = formState.recipe.map((item) => ({
      id: item.id,
      kg: getRecipeReferenceWeightKgFromData(item, ingredientsById, productsById),
      isMain: item.isMain,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      label: item.label,
    }));
    const percents = computeRecipeBakerPercents(rows);
    const unitCount = labComputation?.complete ? labComputation.unitCount : 0;
    return new Map(
      rows.map((row) => [
        row.id,
        {
          kg: row.kg,
          overMain: percents.get(row.id)?.overMain ?? null,
          overTotal: percents.get(row.id)?.overTotal ?? null,
          kgPerUnit: ingredientKgPerFinishedUnit(row.kg, unitCount),
          legalHint: bakerPercentLegalHint(row.label, percents.get(row.id)?.overMain ?? null),
        },
      ]),
    );
  }, [formState.recipe, labComputation, snapshot.ingredients, snapshot.products]);

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
  useEffect(() => {
    if (derivedBatchCapacity == null) {
      return;
    }
    const factor =
      salesUnit === "Kg" || salesUnit === "L"
        ? 1
        : formState.unitProfiles.sales.weightKg > 0
          ? formState.unitProfiles.sales.weightKg
          : 1;
    const economic = deriveEconomicProductionKg(derivedBatchCapacity, factor);
    setFormState((current) => {
      if (current.capacityPerBatch === derivedBatchCapacity && current.economicProductionKg === economic) {
        return current;
      }
      return {
        ...current,
        capacityPerBatch: derivedBatchCapacity,
        economicProductionKg: economic,
      };
    });
  }, [derivedBatchCapacity, salesUnit, formState.unitProfiles.sales.weightKg]);
  const recipeSourceOptionsForSearch = useMemo(
    () =>
      recipeSourceOptions.map((option) => {
        const source =
          option.sourceType === "ingrediente"
            ? snapshot.ingredients.find((ingredient) => ingredient.id === option.id)
            : snapshot.products.find((product) => product.id === option.id);
        const externalCode = source?.externalCode?.trim();
        return {
          value: option.id,
          label: option.label,
          description: [
            option.sourceType === "ingrediente" ? "Ingrediente cadastrado" : "Produto MPI",
            externalCode ? `ERP ${externalCode}` : null,
          ]
            .filter((part): part is string => Boolean(part))
            .join(" · "),
          keywords: [source?.code, source?.name, source?.shortName, source?.externalCode].filter(
            (keyword): keyword is string => Boolean(keyword?.trim()),
          ),
        };
      }),
    [recipeSourceOptions, snapshot.ingredients, snapshot.products],
  );
  // A ficha técnica renderizada em BLOCOS (ponto do Adriano: "ingredientes", "ingredientes do
  // recheio", "ingredientes para a montagem"). A ordem vem da config do produto; receita legada
  // sem config cai num bloco Massa único, idêntico à tabela plana de antes.
  const recipeStageBlocks = useMemo(
    () => getRecipeStageBlocks(formState.recipeStageConfig, formState.recipe),
    [formState.recipeStageConfig, formState.recipe],
  );
  const addableRecipeStages = useMemo(
    () => getAddableRecipeStages(formState.recipeStageConfig, formState.recipe),
    [formState.recipeStageConfig, formState.recipe],
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
      const syncedProduction =
        scope === "sales" &&
        nextUnit !== "Kg" &&
        nextUnit !== "L" &&
        current.unitProfiles.production.unit !== "Kg" &&
        current.unitProfiles.production.unit !== "L"
          ? { production: { ...current.unitProfiles.production, weightKg: nextWeight } }
          : {};
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
          ...syncedProduction,
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

  function getRecipeDraft(stage: RecipeStage): RecipeDraftState {
    return recipeDrafts[stage] ?? emptyRecipeDraft;
  }

  /** Rascunho zerado SAI do mapa — senão o guard de alterações não salvas continuaria acusando
   * o formulário como sujo depois de o usuário desfazer a seleção. */
  function clearRecipeDraft(stage: RecipeStage) {
    setRecipeDrafts((current) => {
      if (!current[stage]) {
        return current;
      }
      const next = { ...current };
      delete next[stage];
      return next;
    });
  }

  function updateRecipeDraft(stage: RecipeStage, patch: Partial<RecipeDraftState>) {
    const nextDraft = { ...getRecipeDraft(stage), ...patch };
    if (!nextDraft.sourceId && !nextDraft.quantity) {
      clearRecipeDraft(stage);
      return;
    }
    setRecipeDrafts((current) => ({ ...current, [stage]: nextDraft }));
  }

  /** Unidade inicial vem do cadastro; o usuário pode trocar para Un na linha da receita. */
  function selectRecipeDraftSource(stage: RecipeStage, sourceId: string) {
    const source = recipeSourceOptions.find((option) => option.id === sourceId);
    const unit =
      source?.sourceType === "ingrediente"
        ? snapshot.ingredients.find((ingredient) => ingredient.id === sourceId)?.unit
        : source?.sourceType === "produto"
          ? snapshot.products.find((candidate) => candidate.id === sourceId)?.unitProfiles.sales.unit ??
            snapshot.products.find((candidate) => candidate.id === sourceId)?.salesUnit
          : undefined;

    updateRecipeDraft(stage, { sourceId, unit: unit ?? getRecipeDraft(stage).unit });
  }

  function addRecipeItem(stage: RecipeStage) {
    const draft = getRecipeDraft(stage);
    if (!draft.sourceId || !draft.quantity) {
      return;
    }

    const quantity = Number(draft.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    const sourceOption = recipeSourceOptions.find((option) => option.id === draft.sourceId);
    if (!sourceOption) {
      return;
    }

    setFormState((current) => ({
      ...current,
      // O item nasce na etapa do bloco e entra no FIM daquele bloco — não no fim da receita
      // inteira, que visualmente seria outro bloco.
      recipe: insertRecipeItemInStage(current.recipe, {
        // `recipe-${Date.now()}` colidia em dois cliques no mesmo milissegundo — com o
        // mesmo insumo repetido em etapas diferentes (incentivado agora), editar uma
        // linha editava as duas. UUID mata a colisão.
        // `crypto.randomUUID` só existe em secure context: a tela aberta por
        // `http://<ip-da-lan>` (tablet do chão, `next dev -H 0.0.0.0`) devolveria
        // undefined e quebraria "Adicionar item". O fallback ainda evita a colisão do
        // `Date.now()` puro, que dava id igual em dois cliques no mesmo milissegundo.
        id: globalThis.crypto?.randomUUID?.() ?? `recipe-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sourceId: sourceOption.id,
        sourceType: sourceOption.sourceType,
        label: sourceOption.label,
        quantity,
        unit: draft.unit,
        stage,
        countsTowardMixer: defaultCountsTowardMixer(stage),
      }),
    }));
    clearRecipeDraft(stage);
  }

  function removeRecipeItem(recipeId: string) {
    setFormState((current) => ({
      ...current,
      recipe: current.recipe.filter((item) => item.id !== recipeId),
    }));
  }

  function updateRecipeItem(
    recipeId: string,
    patch: Partial<Pick<RecipeIngredientReference, "quantity" | "unit" | "countsTowardMixer">>,
  ) {
    setFormState((current) => ({
      ...current,
      recipe: current.recipe.map((item) =>
        item.id === recipeId
          ? {
              ...item,
              quantity: patch.quantity ?? item.quantity,
              unit: patch.unit ?? item.unit,
              countsTowardMixer:
                patch.countsTowardMixer ?? item.countsTowardMixer ?? defaultCountsTowardMixer(item.stage),
              stage: item.stage ?? defaultRecipeStage,
            }
          : item,
      ),
    }));
  }

  /** Troca o ingrediente de bloco: ele reaparece no fim da etapa de destino. */
  function changeRecipeItemStage(recipeId: string, stage: RecipeStage) {
    setFormState((current) => ({
      ...current,
      recipe: moveRecipeItemToStage(current.recipe, recipeId, stage).map((item) =>
        item.id === recipeId
          ? { ...item, countsTowardMixer: defaultCountsTowardMixer(stage) }
          : item,
      ),
    }));
  }

  function updateLabTest(patch: Partial<ProductLabTest>) {
    setFormState((current) => ({
      ...current,
      labTest: {
        ...(current.labTest ?? emptyLabTest()),
        ...patch,
      },
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

  /** Sequenciamento DENTRO do bloco — o vizinho é o item da mesma etapa, não o do array. */
  function moveRecipeItem(recipeId: string, direction: "up" | "down") {
    setFormState((current) => ({
      ...current,
      recipe: moveRecipeItemWithinStage(current.recipe, recipeId, direction),
    }));
  }

  /**
   * Toda edição de bloco passa por aqui: os helpers materializam a ordem visível na config
   * (`recipeStageConfig`) antes de mexer, então a sequência salva é exatamente a que está na tela.
   */
  function updateRecipeStageConfig(
    mutate: (
      config: RecipeStageConfigEntry[] | undefined,
      recipe: RecipeIngredientReference[],
    ) => RecipeStageConfigEntry[],
  ) {
    setFormState((current) => ({
      ...current,
      recipeStageConfig: mutate(current.recipeStageConfig, current.recipe),
    }));
  }

  function moveRecipeStageBlock(stage: RecipeStage, direction: "up" | "down") {
    updateRecipeStageConfig((config, recipe) => moveRecipeStage(config, recipe, stage, direction));
  }

  function addRecipeStageBlock(stage: RecipeStage) {
    updateRecipeStageConfig((config, recipe) => addRecipeStage(config, recipe, stage));
  }

  function removeRecipeStageBlock(stage: RecipeStage) {
    updateRecipeStageConfig((config, recipe) => removeRecipeStage(config, recipe, stage));
  }

  function updateRecipeStageInstructions(stage: RecipeStage, instructions: string) {
    updateRecipeStageConfig((config, recipe) =>
      setRecipeStageInstructions(config, recipe, stage, instructions),
    );
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

    const withLab = applyLabTestToProduct(
      {
        ...formState,
        packagingProfile: normalizedPackagingProfile,
      },
      recipeTotals.totalIngredientsKg,
    );
    const salesWeight =
      withLab.unitProfiles.sales.unit === "Kg" ? 1 : withLab.unitProfiles.sales.weightKg;
    const derivedCapacity = deriveCapacityFromProductRecipe({
      recipe: withLab.recipe,
      recipeYieldUnits: recipeFinalQuantityPrecise,
      mainIngredientLimitKg: withLab.mainIngredientLimitKg,
    });
    const expeditionWeight =
      withLab.unitProfiles.expedition.unit === "Kg"
        ? 1
        : withLab.unitProfiles.expedition.weightKg;
    const normalizedQuantityPerPackage = formState.isSoldLoose
      ? 0
      : calculateQuantityPerPackage(
          salesWeight,
          normalizedPackagingProfile?.unit === "Kg"
            ? 1
            : (normalizedPackagingProfile?.weightKg ?? 0),
        );

    const nextProduct: ProductFormState = {
      ...withLab,
      description: withLab.name.trim(),
      gtin: normalizeGtin(withLab.gtin) || undefined,
      preparationStages: normalizeProductPreparationStages(withLab.preparationStages),
      salesUnit: withLab.unitProfiles.sales.unit,
      productionUnit: withLab.unitProfiles.production.unit,
      expeditionUnit: withLab.unitProfiles.expedition.unit,
      salesToKgFactor: salesWeight,
      expeditionToKgFactor: expeditionWeight,
      weight: formatKgLabel(salesWeight, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
      isMpiIngredient: withLab.canBeIngredient,
      capacityPerBatch: derivedCapacity ?? withLab.capacityPerBatch,
      economicProductionKg:
        derivedCapacity != null
          ? deriveEconomicProductionKg(derivedCapacity, salesWeight)
          : withLab.economicProductionKg,
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
      duplicateExternalCode: Boolean(duplicateExternalCode),
      requireExternalCode: isNewProduct || Boolean(normalizeExternalCode(product?.externalCode)),
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
              : "Comece pelo código da loja. O nome completo do produto vira a descrição no ERP; o código da fábrica é gerado automaticamente."}
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
            <TabsTrigger value="receita" disabled={storeCodeGateBlocked}>Receita</TabsTrigger>
            <TabsTrigger value="cronograma" disabled={storeCodeGateBlocked}>Cronograma</TabsTrigger>
            <TabsTrigger value="mpi" disabled={storeCodeGateBlocked}>Produto como MPI</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro">
            <fieldset disabled={isReadOnly} className="space-y-5">
              <section className="space-y-4 rounded-xl border border-border/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Dados do Produto</h3>
                  <p className="text-xs text-muted-foreground">
                    Comece pelo código da loja — é o código do ERP do cliente, o que a operação usa.
                    O código da fábrica é gerado automaticamente.
                  </p>
                </div>
                {storeCodeGateBlocked ? (
                  <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                    Informe um código da loja disponível para liberar o restante do cadastro.
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2 md:col-span-3">
                    <Label htmlFor="product-external-code">Código da loja *</Label>
                    <Input
                      id="product-external-code"
                      value={formState.externalCode ?? ""}
                      onChange={(event) => {
                        const nextCode = event.target.value;
                        setFormState((current) => ({
                          ...current,
                          externalCode: nextCode,
                        }));
                        if (invalidFields.includes("externalCode")) {
                          setInvalidFields((current) =>
                            current.filter((field) => field !== "externalCode"),
                          );
                        }
                        if (formError) {
                          setFormError(null);
                        }
                      }}
                      placeholder="Código do ERP / loja"
                      autoComplete="off"
                      aria-invalid={
                        invalidFields.includes("externalCode") || Boolean(duplicateExternalCode)
                      }
                      className={cn(
                        (invalidFields.includes("externalCode") || duplicateExternalCode) &&
                          "border-danger/60 ring-1 ring-danger/40 focus-visible:ring-danger/50",
                      )}
                    />
                    {duplicateExternalCode ? (
                      <p className="text-xs text-danger-foreground">
                        Este código da loja já está cadastrado em{" "}
                        <strong>{duplicateExternalCode.name}</strong>
                        {duplicateExternalCode.code ? ` (${duplicateExternalCode.code})` : ""}.
                        Informe outro código para continuar.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Validado na hora. Se o código já existir, o restante do formulário não
                        libera.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product-gtin">GTIN</Label>
                    <Input
                      id="product-gtin"
                      value={formState.gtin ?? ""}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          gtin: event.target.value,
                        }))
                      }
                      placeholder="Código de barras"
                      inputMode="numeric"
                      disabled={storeCodeGateBlocked}
                      aria-invalid={invalidFields.includes("gtin")}
                      className={cn(
                        invalidFields.includes("gtin") &&
                          "border-danger/60 ring-1 ring-danger/40 focus-visible:ring-danger/50",
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      Etiqueta com dígito verificador. 8, 12, 13 ou 14 dígitos.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Código da fábrica</Label>
                    <Input value={formState.code} disabled className="bg-muted" />
                  </div>
                </div>
                <fieldset disabled={storeCodeGateBlocked} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="product-name">Nome completo do produto *</Label>
                    <Input
                      id="product-name"
                      placeholder="Ex: Pão de Fubá 250g"
                      aria-invalid={invalidFields.includes("name")}
                      className={cn(
                        invalidFields.includes("name") &&
                          "border-danger/60 ring-1 ring-danger/40 focus-visible:ring-danger/50",
                      )}
                      value={formState.name}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        setFormState((current) => ({
                          ...current,
                          name: nextName,
                          description: nextName,
                        }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Este nome é a descrição do produto no ERP. Não há campo de descrição separado.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="product-short-name">Nome reduzido</Label>
                    <Input
                      id="product-short-name"
                      placeholder="Ex: Pão Fubá 250"
                      value={formState.shortName ?? ""}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          shortName: event.target.value,
                        }))
                      }
                    />
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
                </fieldset>
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
                    Um peso só: o kg da unidade. Loja, padeiro e expedição só mudam o rótulo
                    (Un, pacote, caixa). A dosimetria sempre pesa em kg. O peso da etiqueta
                    (Inmetro) fica no teste de laboratório — não é o peso de produção.
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
                        ["sales", "o que a loja compra"],
                        ["production", "unidade de produção"],
                        ["expedition", "embalagem de expedição"],
                      ] as const
                    ).map(([scope, hint]) => (
                      <div
                        key={`${scope}-description`}
                        className="border-r border-border/70 px-3 py-3 text-xs text-muted-foreground last:border-r-0"
                      >
                        {hint}
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
                      const lockedByLab =
                        Boolean(labComputation?.complete) &&
                        (scope === "sales" || scope === "production") &&
                        !lockedToKg;

                      return (
                        <div
                          key={`${scope}-weight`}
                          className="border-r border-border/70 px-3 py-3 last:border-r-0"
                        >
                          <Input
                            aria-label={`Peso padrão de ${title}`}
                            type="number"
                            step="0.000001"
                            value={
                              lockedByLab
                                ? labComputation?.bakedUnitKg ?? profile.weightKg
                                : lockedToKg
                                  ? 1
                                  : profile.weightKg
                            }
                            disabled={lockedToKg || lockedByLab}
                            onChange={(event) =>
                              updateUnitProfile(scope, { weightKg: Number(event.target.value) })
                            }
                          />
                          {lockedByLab ? (
                            <p className="mt-1 text-[11px] text-amber-800">Unidade assada do teste</p>
                          ) : null}
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Ingredientes da Receita</h3>
                    <p className="text-xs text-muted-foreground">
                      A ficha é montada em BLOCOS, na mesma ordem em que a produção executa: cada
                      etapa tem os ingredientes dela e o seu próprio modo de preparo. O mesmo insumo
                      pode entrar em mais de um bloco (ex.: farinha na esponja e na massa) com pesos
                      próprios.
                    </p>
                  </div>
                  <span className="rounded-full border border-border/70 bg-panel/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {recipeStageBlocks.length} bloco(s) · {formState.recipe.length} ingrediente(s)
                  </span>
                </div>

                <div className="space-y-4">
                  {recipeStageBlocks.map((block, blockIndex) => {
                    const draft = getRecipeDraft(block.stage);
                    const blockCanBeRemoved = canRemoveRecipeStage(
                      formState.recipeStageConfig,
                      formState.recipe,
                      block.stage,
                    );

                    return (
                      <div
                        key={block.stage}
                        className="space-y-3 rounded-xl border border-border/70 bg-panel/15 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-info/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-info-foreground">
                              {blockIndex + 1}º
                            </span>
                            <h4 className="text-sm font-semibold text-foreground">
                              {recipeStageLabels[block.stage]}
                            </h4>
                            <span className="text-xs text-muted-foreground">
                              {block.items.length === 0
                                ? "sem ingredientes"
                                : `${block.items.length} ingrediente(s)`}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              onClick={() => moveRecipeStageBlock(block.stage, "up")}
                              disabled={blockIndex === 0}
                              title="Mover este bloco para cima na sequência da ficha"
                              aria-label={`Mover bloco ${recipeStageLabels[block.stage]} para cima`}
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              onClick={() => moveRecipeStageBlock(block.stage, "down")}
                              disabled={blockIndex === recipeStageBlocks.length - 1}
                              title="Mover este bloco para baixo na sequência da ficha"
                              aria-label={`Mover bloco ${recipeStageLabels[block.stage]} para baixo`}
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-danger-foreground/80 hover:bg-danger/35 hover:text-danger-foreground"
                              onClick={() => removeRecipeStageBlock(block.stage)}
                              disabled={!blockCanBeRemoved}
                              title={
                                block.items.length > 0
                                  ? "Remova os ingredientes antes de excluir o bloco"
                                  : "Remover este bloco da ficha"
                              }
                              aria-label={`Remover bloco ${recipeStageLabels[block.stage]}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor={`recipe-stage-instructions-${block.stage}`}>
                            Modo de preparo desta etapa
                          </Label>
                          <Textarea
                            id={`recipe-stage-instructions-${block.stage}`}
                            value={block.instructions}
                            onChange={(event) =>
                              updateRecipeStageInstructions(block.stage, event.target.value)
                            }
                            className="min-h-[72px]"
                            placeholder={`Como executar ${recipeStageLabels[block.stage].toLowerCase()}: mistura, tempo, ponto...`}
                          />
                          <p className="text-xs text-muted-foreground">
                            Instrução deste bloco — sai junto dos ingredientes dele na folha. A
                            instrução geral do produto continua em “Instruções de preparo”, no fim
                            desta aba.
                          </p>
                        </div>

                        {block.items.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border/70 bg-card px-3 py-3 text-sm text-muted-foreground">
                            Nenhum ingrediente neste bloco ainda.
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-border/70">
                            <table className="w-full min-w-[1180px] border-collapse">
                              <thead className="bg-card">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                    Referência
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                    Qtd
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                    Unidade
                                  </th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                                    % principal
                                  </th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                                    % total
                                  </th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                                    kg / 1 un
                                  </th>
                                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                                    Masseira
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                    Mover para outra etapa
                                  </th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                                    Ações
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {block.items.map((item, itemIndex) => (
                                  <tr key={item.id}>
                                    <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                      {item.label}
                                    </td>
                                    <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        aria-label={`Quantidade de ${item.label}`}
                                        value={item.quantity}
                                        onChange={(event) =>
                                          updateRecipeItem(item.id, {
                                            quantity: Number(event.target.value),
                                          })
                                        }
                                      />
                                    </td>
                                    <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                      <Select
                                        value={item.unit}
                                        onValueChange={(value) =>
                                          updateRecipeItem(item.id, {
                                            unit: value as RecipeIngredientReference["unit"],
                                          })
                                        }
                                      >
                                        <SelectTrigger aria-label={`Unidade de ${item.label}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {getOperationalUnitOptions(item.unit).map((unit) => (
                                            <SelectItem key={unit} value={unit}>
                                              {getOperationalUnitLabel(unit)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </td>
                                    <td className="border-t border-border/70 bg-card px-3 py-3 text-right text-sm tabular-nums">
                                      {recipeLineMetrics.get(item.id)?.overMain != null
                                        ? `${formatLocaleNumber(recipeLineMetrics.get(item.id)?.overMain, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}%`
                                        : "—"}
                                      {recipeLineMetrics.get(item.id)?.legalHint ? (
                                        <p className="mt-1 text-[11px] font-normal text-amber-800">
                                          {recipeLineMetrics.get(item.id)?.legalHint}
                                        </p>
                                      ) : null}
                                    </td>
                                    <td className="border-t border-border/70 bg-card px-3 py-3 text-right text-sm tabular-nums">
                                      {recipeLineMetrics.get(item.id)?.overTotal != null
                                        ? `${formatLocaleNumber(recipeLineMetrics.get(item.id)?.overTotal, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}%`
                                        : "—"}
                                    </td>
                                    <td className="border-t border-border/70 bg-card px-3 py-3 text-right text-sm tabular-nums">
                                      {recipeLineMetrics.get(item.id)?.kgPerUnit != null
                                        ? formatLocaleNumber(recipeLineMetrics.get(item.id)?.kgPerUnit, {
                                            minimumFractionDigits: 6,
                                            maximumFractionDigits: 6,
                                          })
                                        : "—"}
                                    </td>
                                    <td className="border-t border-border/70 bg-card px-3 py-3 text-center">
                                      <Checkbox
                                        checked={recipeItemCountsTowardMixer(item)}
                                        onCheckedChange={(checked) =>
                                          updateRecipeItem(item.id, {
                                            countsTowardMixer: checked === true,
                                          })
                                        }
                                        aria-label={`${item.label} entra na masseira`}
                                        title="Desmarque para incorporação fora do mixer (óleo na mesa, chocolate no fim)"
                                      />
                                    </td>
                                    <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                                      <Select
                                        value={item.stage ?? defaultRecipeStage}
                                        onValueChange={(value) =>
                                          changeRecipeItemStage(item.id, value as RecipeStage)
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
                                    <td className="border-t border-border/70 bg-card px-3 py-3 text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          className={cn(
                                            "hover:text-foreground",
                                            item.isMain
                                              ? "text-warning"
                                              : "text-muted-foreground/50",
                                          )}
                                          onClick={() => setMainRecipeItem(item.id)}
                                          aria-pressed={item.isMain ?? false}
                                          title={
                                            item.isMain
                                              ? "Ingrediente principal (clique para desmarcar)"
                                              : "Marcar como ingrediente principal — base da capacidade por batida (XPAN-8)"
                                          }
                                        >
                                          <Star
                                            className={cn("size-4", item.isMain ? "fill-current" : "")}
                                          />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          className="text-muted-foreground hover:text-foreground"
                                          onClick={() => moveRecipeItem(item.id, "up")}
                                          disabled={itemIndex === 0}
                                          title="Mover para cima dentro do bloco"
                                        >
                                          <ChevronUp className="size-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          className="text-muted-foreground hover:text-foreground"
                                          onClick={() => moveRecipeItem(item.id, "down")}
                                          disabled={itemIndex === block.items.length - 1}
                                          title="Mover para baixo dentro do bloco"
                                        >
                                          <ChevronDown className="size-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          className="text-danger-foreground/80 hover:bg-danger/35 hover:text-danger-foreground"
                                          onClick={() => removeRecipeItem(item.id)}
                                          title="Remover ingrediente"
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="grid gap-3 rounded-lg border border-border/70 bg-card p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                          <div className="grid gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Label>Ingrediente / Produto MPI</Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setIngredientDialogStage(block.stage);
                                  setIsIngredientDialogOpen(true);
                                }}
                              >
                                <Plus className="size-3.5" />
                                Novo ingrediente
                              </Button>
                            </div>
                            <SearchableSelect
                                value={draft.sourceId}
                                onValueChange={(id) => selectRecipeDraftSource(block.stage, id)}
                                options={recipeSourceOptionsForSearch}
                                placeholder="Selecione a referência"
                                searchPlaceholder="Buscar por nome, código XPAN ou código ERP..."
                                emptyMessage="Nenhuma referência encontrada."
                                title={`Adicionar em ${recipeStageLabels[block.stage]}`}
                                description="Busque por nome, código XPAN ou código ERP do ingrediente ou produto MPI."
                              />
                          </div>
                          <div className="grid gap-2">
                            <Label>Quantidade</Label>
                            <Input
                              type="number"
                              step="0.001"
                              aria-label={`Quantidade para ${recipeStageLabels[block.stage]}`}
                              value={draft.quantity}
                              onChange={(event) =>
                                updateRecipeDraft(block.stage, { quantity: event.target.value })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Unidade</Label>
                            <Select
                              value={draft.unit}
                              onValueChange={(value) =>
                                updateRecipeDraft(block.stage, {
                                  unit: value as RecipeIngredientReference["unit"],
                                })
                              }
                            >
                              <SelectTrigger aria-label={`Unidade para ${recipeStageLabels[block.stage]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getOperationalUnitOptions(draft.unit).map((unit) => (
                                  <SelectItem key={unit} value={unit}>
                                    {getOperationalUnitLabel(unit)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Un usa o peso da embalagem/unidade do cadastro — nunca 1 kg.
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => addRecipeItem(block.stage)}
                            disabled={!draft.sourceId || !draft.quantity}
                            title={`Adicionar ingrediente em ${recipeStageLabels[block.stage]}`}
                          >
                            <Plus className="size-4" />
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {addableRecipeStages.length > 0 ? (
                  <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-dashed border-border/70 bg-panel/20 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Adicionar etapa à ficha</p>
                      <p className="text-xs text-muted-foreground">
                        O bloco novo entra no fim da sequência e pode ser movido. Bloco vazio pode ser
                        removido a qualquer momento.
                      </p>
                    </div>
                    <div className="w-full sm:w-72">
                      <Select
                        value=""
                        onValueChange={(value) => addRecipeStageBlock(value as RecipeStage)}
                      >
                        <SelectTrigger aria-label="Adicionar etapa à ficha">
                          <SelectValue placeholder="Selecione a etapa" />
                        </SelectTrigger>
                        <SelectContent>
                          {addableRecipeStages.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              {recipeStageLabels[stage]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-amber-950">Teste de laboratório</h3>
                  <p className="text-xs text-amber-900/80">
                    Lance as medições da ficha amarela. Quebra, rendimento e peso da unidade
                    assada saem sozinhos — não se digitam %. Sempre informe as unidades, mesmo
                    se o produto for vendido em kg. A etiqueta (Inmetro) não entra na produção.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="grid gap-2">
                    <Label>Peso da unidade/bloco cru (kg)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="border-stone-300 bg-white"
                      value={formState.labTest?.rawUnitWeightKg ?? ""}
                      onChange={(event) =>
                        updateLabTest({ rawUnitWeightKg: readOptionalNumber(event.target.value) })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Massa crua (kg)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="border-stone-300 bg-white"
                      placeholder={
                        recipeTotals.totalIngredientsKg > 0
                          ? `Soma da receita: ${formatLocaleNumber(recipeTotals.totalIngredientsKg, {
                              minimumFractionDigits: 3,
                              maximumFractionDigits: 3,
                            })}`
                          : undefined
                      }
                      value={formState.labTest?.rawDoughKg ?? ""}
                      onChange={(event) =>
                        updateLabTest({ rawDoughKg: readOptionalNumber(event.target.value) })
                      }
                    />
                    <p className="text-[11px] text-amber-900/70">
                      Vazio = usa a soma dos ingredientes.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Kg assados</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="border-stone-300 bg-white"
                      value={formState.labTest?.bakedKg ?? ""}
                      onChange={(event) =>
                        updateLabTest({ bakedKg: readOptionalNumber(event.target.value) })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Sobra assada (kg)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="border-stone-300 bg-white"
                      value={formState.labTest?.leftoverBakedKg ?? ""}
                      onChange={(event) =>
                        updateLabTest({ leftoverBakedKg: readOptionalNumber(event.target.value) })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Nº de unidades</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className="border-stone-300 bg-white"
                      value={formState.labTest?.unitCount ?? ""}
                      onChange={(event) =>
                        updateLabTest({ unitCount: readOptionalNumber(event.target.value) })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Peso da etiqueta (kg)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="border-stone-300 bg-white"
                      value={formState.labTest?.labelWeightKg ?? ""}
                      onChange={(event) =>
                        updateLabTest({ labelWeightKg: readOptionalNumber(event.target.value) })
                      }
                    />
                    <p className="text-[11px] text-amber-900/70">Inmetro / rótulo. Não é o peso de produção.</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-stone-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                      Quebra
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-amber-950">
                      {labComputation?.complete
                        ? `${formatLocaleNumber(labComputation.breakPercent, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}%`
                        : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-900/70">
                      1 − (assado efetivo / massa crua)
                    </p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                      Rendimento
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-amber-950">
                      {labComputation?.complete
                        ? `${formatLocaleNumber(labComputation.yieldPercent, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}%`
                        : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-900/70">Assado efetivo / massa crua</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                      Unidade assada
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-amber-950">
                      {labComputation?.complete
                        ? `${formatLocaleNumber(labComputation.bakedUnitGrams, {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          })} g`
                        : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-900/70">
                      {labComputation?.complete
                        ? `${formatLocaleNumber(labComputation.bakedUnitKg, {
                            minimumFractionDigits: 6,
                            maximumFractionDigits: 6,
                          })} kg / un`
                        : "kg assados efetivos / unidades"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                      Assado efetivo
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-amber-950">
                      {labComputation && labComputation.effectiveBakedKg > 0
                        ? formatKgLabel(labComputation.effectiveBakedKg, {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          })
                        : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-900/70">Kg assados − sobra assada</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-border/80 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Parâmetros de Produção</h3>
                  <p className="text-xs text-muted-foreground">
                    Validade, lote mínimo (aviso) e limite da masseira. A capacidade por batida
                    sai do ingrediente principal ⭐ — não se digitam três bases diferentes.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
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
                    <p className="text-xs text-muted-foreground">
                      Só alerta na OP. Não trava e não define o tamanho da batida.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Limite do ingrediente principal por batida (Kg)</Label>
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
                    <p className="text-xs text-muted-foreground">
                      {!hasMainIngredient
                        ? "Marque um ingrediente como principal (⭐) na receita."
                        : formState.mainIngredientLimitKg == null
                          ? "Informe quanto do principal cabe na masseira. A capacidade e a base econômica saem daí."
                          : derivedBatchCapacity === null
                            ? "Não foi possível derivar: o principal precisa estar em Kg, com rendimento válido."
                            : `Capacidade ${formatLocaleNumber(derivedBatchCapacity)} ${salesUnitLabel} por batida · base econômica ${formatKgLabel(
                                formState.economicProductionKg,
                                { minimumFractionDigits: 3, maximumFractionDigits: 3 },
                              )}.`}
                    </p>
                    {batchPreview ? (
                      <p className="text-xs text-muted-foreground">
                        {formatBatchSizesPhrase(batchPreview.batchSizes, batchPreview.unitLabel)}
                      </p>
                    ) : null}
                  </div>
                  {derivedBatchCapacity == null ? (
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
                      <p className="text-xs text-muted-foreground">
                        Sem limite do principal, a capacidade continua manual.
                      </p>
                    </div>
                  ) : null}
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
                    Rendimento do teste
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-900">
                    {labComputation?.complete
                      ? `${formatLocaleNumber(labComputation.yieldPercent, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}%`
                      : `${formatLocaleNumber(yieldPercent, {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })}%`}
                  </p>
                  <p className="mt-2 text-xs text-emerald-800">
                    {labComputation?.complete
                      ? "Calculado do teste: assado efetivo / massa crua. A quebra não é digitada."
                      : "Preencha o teste de laboratório para calcular o rendimento. Enquanto isso, vale a quebra já gravada."}
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
                    Peso final após a quebra do teste:{" "}
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
                <Label htmlFor="product-preparation-mode">Instruções de preparo (produto)</Label>
                <p className="text-xs text-muted-foreground">
                  Instrução GERAL do produto, válida para a ficha inteira. O passo a passo de cada
                  etapa fica no campo “Modo de preparo desta etapa”, dentro do bloco correspondente.
                </p>
                <Textarea
                  id="product-preparation-mode"
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
                          formState.ingredientProfile?.weightKg ??
                          (formState.ingredientProfile?.unit === "Kg"
                            ? 1
                            : formState.unitProfiles.sales.weightKg),
                        recipeYieldKg: formState.ingredientProfile?.recipeYieldKg,
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
                      showWeightKg
                      lockWeightWhenKg={false}
                      showRecipeYieldKg
                      recipeYieldPlaceholderKg={recipeTotals.outputAfterBreakKg}
                      purchaseHelperText="1 unidade de compra equivale a este fator multiplicado pela unidade de consumo."
                      metadataPlaceholder="Ex: usar como base de sanduíches, consumir após resfriar"
                      onChange={(patch) =>
                        setFormState((current) => {
                          const nextUnit =
                            (patch.unit as ProductUnitProfile["unit"] | undefined) ??
                            current.ingredientProfile?.unit ??
                            "Kg";
                          const fallbackWeightKg =
                            current.ingredientProfile?.weightKg ??
                            (nextUnit === "Kg" ? 1 : current.unitProfiles.sales.weightKg);
                          // P0: Kg não zera um peso de unidade já cadastrado (ex. 0,170).
                          // O campo do form pode mandar undefined ao apagar; o tipo exige number.
                          const nextWeightKg =
                            "weightKg" in patch
                              ? (patch.weightKg ?? fallbackWeightKg)
                              : patch.unit === "Kg" && current.ingredientProfile?.weightKg == null
                                ? 1
                                : fallbackWeightKg;

                          return {
                            ...current,
                            ingredientProfile: {
                              unit: nextUnit,
                              weightKg: nextWeightKg,
                              recipeYieldKg:
                                "recipeYieldKg" in patch
                                  ? patch.recipeYieldKg
                                  : current.ingredientProfile?.recipeYieldKg,
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
                          };
                        })
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
                <Button type="button" onClick={() => void handleSaveProduct()} disabled={isSubmitting || storeCodeGateBlocked}>
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
          // Volta pro rascunho do bloco que abriu o cadastro — o insumo novo já entra na etapa certa.
          updateRecipeDraft(ingredientDialogStage, {
            sourceId: ingredient.id,
            unit: ingredient.unit,
          });
          setIsIngredientDialogOpen(false);
        }}
      />
    </>
  );
}
