import type { ProductionIngredient } from "@/lib/production-planning";

export type IngredientFormValidationField = "name" | "externalCode";

export type IngredientFormValidationResult = {
  error: string | null;
  invalidFields: IngredientFormValidationField[];
};

export function normalizeExternalCode(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

export function findDuplicateExternalCode<T extends { id: string; externalCode?: string }>(
  externalCode: string,
  catalog: T[],
  currentId?: string | null,
): T | null {
  const normalized = normalizeExternalCode(externalCode).toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    catalog.find(
      (item) =>
        item.id !== currentId &&
        normalizeExternalCode(item.externalCode).toLowerCase() === normalized,
    ) ?? null
  );
}

export function validateIngredientFormState(
  ingredient: Pick<ProductionIngredient, "name" | "externalCode">,
  options: {
    duplicateExternalCode?: boolean;
    requireExternalCode?: boolean;
  } = {},
): IngredientFormValidationResult {
  const invalidFields: IngredientFormValidationField[] = [];
  const requireExternalCode = options.requireExternalCode !== false;

  if (requireExternalCode && !normalizeExternalCode(ingredient.externalCode)) {
    invalidFields.push("externalCode");
  }

  if (!ingredient.name.trim()) {
    invalidFields.push("name");
  }

  if (options.duplicateExternalCode) {
    return {
      error: "Este código ERP já está cadastrado. Informe outro código para continuar.",
      invalidFields: invalidFields.includes("externalCode")
        ? invalidFields
        : ["externalCode", ...invalidFields],
    };
  }

  if (invalidFields.length > 0) {
    return {
      error:
        invalidFields[0] === "externalCode"
          ? "Informe o código ERP do cliente antes de continuar o cadastro."
          : "Preencha os campos obrigatórios destacados antes de salvar.",
      invalidFields,
    };
  }

  return {
    error: null,
    invalidFields: [],
  };
}
