/* -------------------------------------------------------------------------------------------------
 * Cartão #241 — levar cadastros (produtos + fichas técnicas) de um ambiente para outro.
 *
 * Tipos do arquivo `.json` de transferência e da revisão mostrada antes de gravar. Ids nunca
 * viajam: o arquivo referencia tudo por código (produto: código da loja ou da fábrica; insumo:
 * code; etapa: key; linha de produção: nome/código).
 * -----------------------------------------------------------------------------------------------*/

export type Row = Record<string, unknown>;

export const CATALOG_FORMAT = "xpan-catalog";
export const CATALOG_VERSION = 1;
export const CATALOG_MAX_PRODUCTS = 2000;
export const CATALOG_MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface CatalogLineRef {
  code: string;
  name: string;
}

export interface CatalogRecipeLine {
  sourceType: "ingrediente" | "produto";
  /** `code` do insumo quando a linha é insumo. */
  ingredientCode: string | null;
  /** Chave (`productKey`) do produto-ingrediente (MPI) quando a linha é MPI. */
  productKey: string | null;
  /** Todas as colunas da linha da receita, exceto ids/tenant/datas. */
  fields: Row;
}

export interface CatalogProduct {
  /** `L:<código da loja>` ou, sem código da loja, `F:<código da fábrica>`. */
  key: string;
  code: string;
  externalCode: string | null;
  name: string;
  /** Entrou no arquivo só porque outro produto usa como ingrediente (MPI). */
  includedAsIngredient: boolean;
  line: CatalogLineRef | null;
  /** Todas as colunas do produto, exceto ids/tenant/datas/linhas. */
  fields: Row;
  preparationSteps: Array<{ stageKey: string; sortOrder: number }>;
  recipe: CatalogRecipeLine[];
}

export interface CatalogIngredient {
  code: string;
  name: string;
  unit: string;
  /** Todas as colunas do insumo, exceto ids/tenant/datas. */
  fields: Row;
}

export interface CatalogStage {
  key: string;
  label: string;
  baseStage: string;
  sortOrder: number;
  active: boolean;
}

export interface CatalogFile {
  format: typeof CATALOG_FORMAT;
  version: number;
  exportedAt: string;
  source: { companyName: string };
  products: CatalogProduct[];
  ingredients: CatalogIngredient[];
  stages: CatalogStage[];
}

/** Dados do ambiente de destino (linhas cruas do banco, já filtradas pelo tenant). */
export interface CatalogDestination {
  products: Row[];
  recipeItems: Row[];
  ingredients: Row[];
  preparationSteps: Row[];
  stages: Row[];
  subcategories: Row[];
}

export type ProductAction = "novo" | "atualizar" | "igual";

export interface FieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface RecipeChange {
  kind: "adicionado" | "removido" | "alterado" | "ordem";
  text: string;
}

export interface ReviewProduct {
  key: string;
  name: string;
  code: string;
  externalCode: string | null;
  action: ProductAction;
  includedAsIngredient: boolean;
  /** Motivos que bloqueiam só este item. */
  conflicts: string[];
  /** Avisos que não bloqueiam. */
  notes: string[];
  changes: FieldChange[];
  recipeChanges: RecipeChange[];
  recipeLineCount: number;
  /** Chaves de produtos NOVOS (MPI) que precisam ser importados junto. */
  requires: string[];
  blocked: boolean;
}

export interface ReviewIngredient {
  code: string;
  name: string;
  unit: string;
  status: "novo" | "existe";
  conflicts: string[];
  notes: string[];
}

export interface ReviewStage {
  key: string;
  label: string;
  status: "nova" | "existe";
  notes: string[];
}

export interface CatalogReview {
  source: { companyName: string; exportedAt: string };
  products: ReviewProduct[];
  ingredients: ReviewIngredient[];
  stages: ReviewStage[];
  summary: { novos: number; atualizar: number; iguais: number; bloqueados: number };
}

export interface ImportPlanNewProduct {
  key: string;
  id: string;
  row: Row;
  preparationSteps: Row[];
  recipeRows: Row[];
}

export interface ImportPlanUpdatedProduct {
  key: string;
  id: string;
  row: Row;
  preparationSteps: Row[];
  recipeRows: Row[];
  changes: FieldChange[];
}

export interface ImportPlan {
  stages: Row[];
  ingredients: Array<{ code: string; id: string; row: Row }>;
  newProducts: ImportPlanNewProduct[];
  updatedProducts: ImportPlanUpdatedProduct[];
}
