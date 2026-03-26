import type { ProductionIngredient } from "@/lib/production-planning";

export type IngredientFormValidationField = "name";

export type IngredientFormValidationResult = {
  error: string | null;
  invalidFields: IngredientFormValidationField[];
};

export function validateIngredientFormState(
  ingredient: Pick<ProductionIngredient, "name">,
): IngredientFormValidationResult {
  const invalidFields: IngredientFormValidationField[] = [];

  if (!ingredient.name.trim()) {
    invalidFields.push("name");
  }

  if (invalidFields.length > 0) {
    return {
      error: "Preencha os campos obrigatórios destacados antes de salvar.",
      invalidFields,
    };
  }

  return {
    error: null,
    invalidFields: [],
  };
}
