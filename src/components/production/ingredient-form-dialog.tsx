"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";

import { IngredientCompositionEditor } from "@/components/production/ingredient-composition-editor";
import { IngredientProfileFields } from "@/components/production/ingredient-profile-fields";
import { Button } from "@/components/ui/button";
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
import { validateIngredientFormState } from "@/lib/ingredient-form-logic";
import { getOperationalUnitLabel, getOperationalUnitOptions } from "@/lib/operational-units";
import type {
  IngredientCompositionItem,
  ProductionIngredient,
} from "@/lib/production-planning";
import type { MasterDataSnapshot } from "@/lib/supabase-data/master-data";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";

export type IngredientDialogMode = "view" | "edit";

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

type IngredientFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient?: ProductionIngredient | null;
  mode: IngredientDialogMode;
  snapshot: MasterDataSnapshot;
  refresh: (forceRefresh?: boolean) => Promise<MasterDataSnapshot>;
  onSaved?: (ingredient: ProductionIngredient, snapshot: MasterDataSnapshot) => void;
  allowSaveAndCreateAnother?: boolean;
  onRequestEdit?: () => void;
};

function buildFormState(ingredient?: ProductionIngredient | null): IngredientFormState {
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

export function IngredientFormDialog({
  open,
  onOpenChange,
  ingredient = null,
  mode,
  snapshot,
  refresh,
  onSaved,
  allowSaveAndCreateAnother = true,
  onRequestEdit,
}: IngredientFormDialogProps) {
  const [formState, setFormState] = useState<IngredientFormState>(() => buildFormState(ingredient));
  const [formBaseline, setFormBaseline] = useState("");
  const [draftComponentId, setDraftComponentId] = useState("");
  const [draftComponentQty, setDraftComponentQty] = useState("");
  const [draftComponentUnit, setDraftComponentUnit] = useState<ProductionIngredient["unit"]>("Kg");
  const [draftComponentObservation, setDraftComponentObservation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isReadOnly = mode === "view";
  const formDirty =
    open &&
    !isReadOnly &&
    JSON.stringify({
      formState,
      draftComponentId,
      draftComponentQty,
      draftComponentUnit,
      draftComponentObservation,
    }) !== formBaseline;
  const formGuard = useUnsavedChangesGuard({
    enabled: open && !isReadOnly,
    isDirty: formDirty,
  });

  function resetToNewIngredientForm() {
    const nextFormState = buildFormState(null);
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
    window.setTimeout(() => {
      document.getElementById("ingredient-name")?.focus();
    }, 0);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

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
  }, [ingredient, mode, open]);

  const mpiProducts = useMemo(
    () => snapshot.products.filter((product) => product.canBeIngredient),
    [snapshot.products],
  );
  const productOptions = useMemo(
    () =>
      mpiProducts.map((product) => ({
        id: product.id,
        label: `${product.code} · ${product.name}`,
        description: product.shortName?.trim()
          ? `Nome reduzido: ${product.shortName}`
          : undefined,
        keywords: [product.code, product.shortName].filter((keyword): keyword is string =>
          Boolean(keyword?.trim()),
        ),
        type: "produto" as const,
      })),
    [mpiProducts],
  );
  const ingredientOptions = useMemo(
    () =>
      snapshot.ingredients
        .filter((item) => item.status === "ativo")
        .map((item) => ({
          id: item.id,
          label: `${item.code} · ${item.name}`,
          description: item.shortName?.trim() ? `Nome reduzido: ${item.shortName}` : undefined,
          keywords: [item.code, item.shortName].filter((keyword): keyword is string =>
            Boolean(keyword?.trim()),
          ),
          type: "ingrediente" as const,
        })),
    [snapshot.ingredients],
  );
  const compositionOptions = useMemo(
    () => [...ingredientOptions, ...productOptions],
    [ingredientOptions, productOptions],
  );
  const ingredientUnitOptions = useMemo(
    () =>
      getOperationalUnitOptions(
        formState.unit,
        draftComponentUnit,
        ...formState.composition.map((item) => item.unit),
      ),
    [draftComponentUnit, formState.composition, formState.unit],
  );

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

  async function handleSave(options?: { createAnother?: boolean }) {
    const createAnother = options?.createAnother === true;
    const validation = validateIngredientFormState({ name: formState.name });
    if (validation.error) {
      setInvalidFields(validation.invalidFields);
      setFormError(validation.error);
      window.setTimeout(() => {
        document.getElementById("ingredient-name")?.focus();
      }, 0);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setInvalidFields([]);

    try {
      const response = await fetch(
        ingredient
          ? `/api/master-data/ingredients/${ingredient.id}`
          : "/api/master-data/ingredients",
        {
          method: ingredient ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formState,
            status: ingredient?.status ?? "ativo",
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as
        | { id?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "Falha ao salvar ingrediente");
      }

      const nextSnapshot = await refresh();
      const persistedIngredientId = body?.id ?? ingredient?.id;
      const savedIngredient = persistedIngredientId
        ? nextSnapshot.ingredients.find((item) => item.id === persistedIngredientId) ?? null
        : null;

      if (savedIngredient) {
        onSaved?.(savedIngredient, nextSnapshot);
      }

      if (createAnother) {
        resetToNewIngredientForm();
        return;
      }

      onOpenChange(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Falha ao salvar ingrediente");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
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
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>
            {!ingredient
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
            <div className="flex flex-col gap-3 rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm text-info-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Modo visualização: revise os dados do ingrediente sem alterar o cadastro.</span>
              {ingredient && onRequestEdit ? (
                <Button type="button" variant="outline" size="sm" onClick={onRequestEdit}>
                  <Pencil className="size-4" />
                  Editar
                </Button>
              ) : null}
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
                  className={cn(
                    invalidFields.includes("name") &&
                      "border-danger/60 ring-1 ring-danger/30",
                  )}
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
                      type: value as ProductionIngredient["type"],
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
                <Label>Unidade de Consumo *</Label>
                <Select
                  value={formState.unit}
                  onValueChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      unit: value as ProductionIngredient["unit"],
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
              metadataLabel="Lembretes"
              metadataPlaceholder="Ex: alergênico, armazenar refrigerado, fornecedor preferencial..."
              purchaseHelperText={`1 ${getOperationalUnitLabel(formState.purchaseUnit ?? formState.unit)} = ${formState.purchaseToConsumptionFactor || 1} ${getOperationalUnitLabel(formState.unit)}. Ex: ovos — compra Dz, consumo g, fator 600 (1 Dz = 600g).`}
              onChange={(patch) =>
                setFormState((current) => ({
                  ...current,
                  unit:
                    (patch.unit as ProductionIngredient["unit"] | undefined) ?? current.unit,
                  purchaseUnit:
                    (patch.purchaseUnit as ProductionIngredient["purchaseUnit"] | undefined) ??
                    current.purchaseUnit ??
                    current.unit,
                  purchaseToConsumptionFactor:
                    patch.purchaseToConsumptionFactor ??
                    current.purchaseToConsumptionFactor,
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
                    setDraftComponentUnit(patch.unit as ProductionIngredient["unit"]);
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
              onOpenChange(false);
            }}
          >
            {isReadOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!isReadOnly ? (
            <>
              {!ingredient && allowSaveAndCreateAnother ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSave({ createAnother: true })}
                  disabled={isSubmitting}
                >
                  Salvar e novo
                </Button>
              ) : null}
              <Button type="button" onClick={() => void handleSave()} disabled={isSubmitting}>
                {ingredient ? "Salvar Alterações" : "Cadastrar Ingrediente"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
