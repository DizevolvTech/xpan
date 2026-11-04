import { recipeStageLabels } from "@/lib/production-planning";

import {
  buildProductKey,
  collectCustomStageKeys,
  describeProductKey,
  omitKeys,
  recipeFieldSkip,
} from "./build-file";
import type {
  CatalogDestination,
  CatalogFile,
  CatalogProduct,
  CatalogRecipeLine,
  CatalogReview,
  FieldChange,
  RecipeChange,
  ReviewIngredient,
  ReviewProduct,
  ReviewStage,
  Row,
} from "./types";

/** Colunas que não entram na comparação/atualização de produto existente. */
const UPDATE_SKIP = new Set([
  "id",
  "tenant_id",
  "legacy_id",
  "created_at",
  "updated_at",
  "subcategory_id",
  "operational_subcategory_id",
  "code",
  "external_code",
]);

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  short_name: "Nome curto",
  gtin: "GTIN",
  description: "Descrição",
  active: "Ativo",
  available_for_ordering: "Disponível para pedido",
  validity_days: "Validade (dias)",
  minimum_production_kg: "Produção mínima (Kg)",
  economic_production_kg: "Produção econômica (Kg)",
  capacity_per_batch: "Capacidade por batida",
  min_per_batch: "Mínimo por batida",
  min_per_batch_kg: "Mínimo por batida (Kg)",
  max_batch_weight_kg: "Limite máximo da batida (Kg)",
  main_ingredient_limit_kg: "Limite do insumo principal (Kg)",
  production_days: "Dias de produção",
  expedition_lead_days: "Lead de expedição",
  allows_storage: "Permite estoque",
  preparation_mode: "Modo de preparo",
  break_percent: "Quebra (%)",
  break_stage: "Etapa da quebra",
  break_comment: "Comentário da quebra",
  lab_test: "Teste de laboratório",
  can_be_ingredient: "Pode ser insumo (MPI)",
  is_mpi_ingredient: "Espelho MPI",
  is_sold_loose: "Vendido a granel",
  weight_label: "Peso",
  production_unit: "Unidade de produção",
  sales_unit: "Unidade de venda",
  expedition_unit: "Unidade de expedição",
  sales_to_kg_factor: "Fator venda → Kg",
  expedition_to_kg_factor: "Fator expedição → Kg",
  unit_profiles: "Unidades",
  packaging_profile: "Embalagem",
  recipe_stage_config: "Etapas da ficha",
  ingredient_profile: "Perfil como insumo",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function normalizeName(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Row)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

export function sameValue(a: unknown, b: unknown): boolean {
  const left = a === undefined ? null : a;
  const right = b === undefined ? null : b;
  if (typeof left === "number" && typeof right === "string" && right.trim() !== "") return left === Number(right);
  if (typeof left === "string" && typeof right === "number" && left.trim() !== "") return Number(left) === right;
  return stableStringify(left) === stableStringify(right);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(value);
  const raw = typeof value === "string" ? value : stableStringify(value);
  return raw.length > 90 ? `${raw.slice(0, 87)}...` : raw;
}

function columnsOf(rows: Row[]): Set<string> {
  const columns = new Set<string>();
  for (const row of rows.slice(0, 50)) for (const key of Object.keys(row)) columns.add(key);
  return columns;
}

/** Mantém só as colunas que o destino conhece (vazio = destino sem amostra: mantém tudo). */
export function pickColumns(row: Row, columns: ReadonlySet<string>): Row {
  if (columns.size === 0) return { ...row };
  const result: Row = {};
  for (const [key, value] of Object.entries(row)) if (columns.has(key)) result[key] = value;
  return result;
}

function stageLabel(key: unknown, file: CatalogFile): string {
  const value = text(key);
  const builtin = (recipeStageLabels as Record<string, string>)[value];
  if (builtin) return builtin;
  return file.stages.find((stage) => stage.key === value)?.label || value || "sem etapa";
}

export interface DestinationIndex {
  productsByKey: Map<string, Row[]>;
  productsByExternal: Map<string, Row[]>;
  productsByCode: Map<string, Row[]>;
  ingredientsByCode: Map<string, Row[]>;
  ingredientsByExternal: Map<string, Row[]>;
  stageKeys: Set<string>;
  productCols: Set<string>;
  recipeCols: Set<string>;
  ingredientCols: Set<string>;
  recipeByProduct: Map<string, CatalogRecipeLine[]>;
  stepsByProduct: Map<string, Array<{ stageKey: string; sortOrder: number }>>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

export function indexDestination(dest: CatalogDestination): DestinationIndex {
  const productsByKey = new Map<string, Row[]>();
  const productsByExternal = new Map<string, Row[]>();
  const productsByCode = new Map<string, Row[]>();
  const keyById = new Map<string, string>();
  for (const row of dest.products) {
    const key = buildProductKey(row.code, row.external_code);
    keyById.set(String(row.id), key);
    push(productsByKey, key, row);
    if (text(row.external_code)) push(productsByExternal, text(row.external_code), row);
    push(productsByCode, text(row.code), row);
  }
  const ingredientsByCode = new Map<string, Row[]>();
  const ingredientsByExternal = new Map<string, Row[]>();
  const codeById = new Map<string, string>();
  for (const row of dest.ingredients) {
    codeById.set(String(row.id), text(row.code));
    push(ingredientsByCode, text(row.code), row);
    if (text(row.external_code)) push(ingredientsByExternal, text(row.external_code), row);
  }
  const recipeByProduct = new Map<string, CatalogRecipeLine[]>();
  const sortedItems = [...dest.recipeItems].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  for (const item of sortedItems) {
    const isProduct = item.source_type === "produto";
    push(recipeByProduct, String(item.product_id), {
      sourceType: isProduct ? "produto" : "ingrediente",
      ingredientCode: !isProduct && item.ingredient_source_id ? codeById.get(String(item.ingredient_source_id)) ?? null : null,
      productKey: isProduct && item.product_source_id ? keyById.get(String(item.product_source_id)) ?? null : null,
      fields: omitKeys(item, recipeFieldSkip),
    });
  }
  const stepsByProduct = new Map<string, Array<{ stageKey: string; sortOrder: number }>>();
  for (const step of dest.preparationSteps) {
    push(stepsByProduct, String(step.product_id), {
      stageKey: text(step.stage_key),
      sortOrder: Number(step.sort_order ?? 0),
    });
  }
  for (const list of stepsByProduct.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    productsByKey,
    productsByExternal,
    productsByCode,
    ingredientsByCode,
    ingredientsByExternal,
    stageKeys: new Set(dest.stages.map((stage) => text(stage.key))),
    productCols: columnsOf(dest.products),
    recipeCols: columnsOf(dest.recipeItems),
    ingredientCols: columnsOf(dest.ingredients),
    recipeByProduct,
    stepsByProduct,
  };
}

export function findDestinationProducts(index: DestinationIndex, key: string): Row[] {
  const value = key.slice(2);
  return key.startsWith("L:")
    ? (index.productsByExternal.get(value) ?? [])
    : (index.productsByCode.get(value) ?? []);
}

export function matchLine(line: { code: string; name: string } | null, subcategories: Row[]): Row | null {
  if (!line) return null;
  const byName = subcategories.filter((row) => normalizeName(row.name) === normalizeName(line.name));
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    return byName.find((row) => text(row.code) === line.code) ?? byName[0];
  }
  return subcategories.find((row) => text(row.code) === line.code && normalizeName(row.name) === normalizeName(line.name)) ?? null;
}

function lineIdentity(line: CatalogRecipeLine): string {
  const ref = line.sourceType === "produto" ? `P:${line.productKey ?? "?"}` : `I:${line.ingredientCode ?? "?"}`;
  return `${ref}|${text(line.fields.stage)}`;
}

function lineTitle(line: CatalogRecipeLine, file: CatalogFile): string {
  const base = text(line.fields.label) || (line.sourceType === "produto" ? line.productKey : line.ingredientCode) || "item";
  return `${base} (${stageLabel(line.fields.stage, file)})`;
}

function describeLine(line: CatalogRecipeLine): string {
  return `${formatValue(line.fields.quantity)} ${text(line.fields.unit)}`.trim();
}

export function diffRecipe(fileLines: CatalogRecipeLine[], destLines: CatalogRecipeLine[], file: CatalogFile): RecipeChange[] {
  const changes: RecipeChange[] = [];
  const withIdentity = (lines: CatalogRecipeLine[]) => {
    const seen = new Map<string, number>();
    return lines.map((line) => {
      const base = lineIdentity(line);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return { id: `${base}#${n}`, line };
    });
  };
  const fileList = withIdentity(fileLines);
  const destList = withIdentity(destLines);
  const destById = new Map(destList.map((entry) => [entry.id, entry.line]));
  const fileIds = new Set(fileList.map((entry) => entry.id));

  for (const { id, line } of fileList) {
    const current = destById.get(id);
    if (!current) {
      changes.push({ kind: "adicionado", text: `Entra: ${lineTitle(line, file)} — ${describeLine(line)}` });
      continue;
    }
    const keys = new Set([...Object.keys(line.fields), ...Object.keys(current.fields)]);
    keys.delete("sort_order");
    const diffs: string[] = [];
    for (const key of keys) {
      if (!(key in current.fields) || !(key in line.fields)) continue;
      if (!sameValue(line.fields[key], current.fields[key])) {
        diffs.push(`${FIELD_LABELS[key] ?? RECIPE_LABELS[key] ?? key}: ${formatValue(current.fields[key])} → ${formatValue(line.fields[key])}`);
      }
    }
    if (diffs.length > 0) {
      changes.push({ kind: "alterado", text: `${lineTitle(line, file)} — ${diffs.join("; ")}` });
    }
  }
  for (const { id, line } of destList) {
    if (!fileIds.has(id)) {
      changes.push({ kind: "removido", text: `Sai: ${lineTitle(line, file)} — ${describeLine(line)}` });
    }
  }
  if (changes.length === 0) {
    const fileOrder = fileList.map((entry) => entry.id).join(">");
    const destOrder = destList.map((entry) => entry.id).join(">");
    if (fileOrder !== destOrder) changes.push({ kind: "ordem", text: "A ordem das linhas da receita muda" });
  }
  return changes;
}

const RECIPE_LABELS: Record<string, string> = {
  quantity: "Quantidade",
  unit: "Unidade",
  label: "Nome da linha",
  stage: "Etapa",
  is_main: "Ingrediente principal",
  observation: "Observação",
  counts_toward_mixer: "Conta na masseira",
  print_destinations: "Destino de impressão",
};

export function diffProductData(product: CatalogProduct, destRow: Row, index: DestinationIndex): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const [field, value] of Object.entries(omitKeys(product.fields, UPDATE_SKIP))) {
    if (!index.productCols.has(field)) continue;
    if (!sameValue(value, destRow[field])) {
      changes.push({ field, label: FIELD_LABELS[field] ?? field, from: formatValue(destRow[field]), to: formatValue(value) });
    }
  }
  if (product.preparationSteps.length > 0) {
    const destSteps = index.stepsByProduct.get(String(destRow.id)) ?? [];
    const fileSteps = product.preparationSteps;
    const same =
      destSteps.length === fileSteps.length &&
      destSteps.every((step, i) => step.stageKey === fileSteps[i].stageKey);
    if (!same) {
      changes.push({
        field: "preparation_steps",
        label: "Etapas de preparo",
        from: destSteps.map((s) => s.stageKey).join(" > ") || "—",
        to: fileSteps.map((s) => s.stageKey).join(" > "),
      });
    }
  }
  return changes;
}

export interface ProductAnalysis {
  product: CatalogProduct;
  destRow: Row | null;
  lineRow: Row | null;
  review: ReviewProduct;
}

export interface CatalogAnalysis {
  review: CatalogReview;
  index: DestinationIndex;
  products: Map<string, ProductAnalysis>;
  ingredientStatus: Map<string, ReviewIngredient>;
  stageStatus: Map<string, ReviewStage>;
}

/** Compara o arquivo com o destino e monta a revisão (nada é gravado aqui). */
export function analyzeCatalog(file: CatalogFile, dest: CatalogDestination): CatalogAnalysis {
  const index = indexDestination(dest);

  // --- insumos
  const ingredientStatus = new Map<string, ReviewIngredient>();
  const fileIngredientCodes = new Map<string, number>();
  for (const ingredient of file.ingredients) fileIngredientCodes.set(ingredient.code, (fileIngredientCodes.get(ingredient.code) ?? 0) + 1);
  for (const ingredient of file.ingredients) {
    const entry: ReviewIngredient = {
      code: ingredient.code,
      name: ingredient.name,
      unit: ingredient.unit,
      status: "novo",
      conflicts: [],
      notes: [],
    };
    const matches = index.ingredientsByCode.get(ingredient.code) ?? [];
    if ((fileIngredientCodes.get(ingredient.code) ?? 0) > 1) {
      entry.conflicts.push(`O arquivo traz mais de um insumo com o código ${ingredient.code}.`);
    }
    if (matches.length > 1) {
      entry.conflicts.push(`Há ${matches.length} insumos com o código ${ingredient.code} no destino.`);
    } else if (matches.length === 1) {
      entry.status = "existe";
      const existing = matches[0];
      if (normalizeName(existing.unit) !== normalizeName(ingredient.unit)) {
        entry.conflicts.push(
          `Unidade diferente: no arquivo é ${ingredient.unit || "—"}, no destino é ${text(existing.unit) || "—"}.`,
        );
      }
      if (normalizeName(existing.name) !== normalizeName(ingredient.name)) {
        entry.notes.push(`Nome no destino: ${text(existing.name)} (mantido).`);
      }
    } else {
      const external = text(ingredient.fields.external_code);
      const clash = external ? index.ingredientsByExternal.get(external)?.[0] : undefined;
      if (clash) {
        entry.conflicts.push(
          `O código ERP ${external} já é usado no destino pelo insumo ${text(clash.code)} - ${text(clash.name)}.`,
        );
      }
    }
    ingredientStatus.set(ingredient.code, entry);
  }

  // --- etapas
  const stageStatus = new Map<string, ReviewStage>();
  for (const stage of file.stages) {
    const exists = index.stageKeys.has(stage.key);
    const destStage = dest.stages.find((row) => text(row.key) === stage.key);
    stageStatus.set(stage.key, {
      key: stage.key,
      label: stage.label,
      status: exists ? "existe" : "nova",
      notes: exists && destStage && text(destStage.label) !== stage.label ? [`Nome no destino: ${text(destStage.label)} (mantido).`] : [],
    });
  }

  // --- produtos
  const fileKeyCount = new Map<string, number>();
  for (const product of file.products) fileKeyCount.set(product.key, (fileKeyCount.get(product.key) ?? 0) + 1);
  const fileKeys = new Set(file.products.map((product) => product.key));
  const plannedNewCodes = new Set<string>();
  const analyses = new Map<string, ProductAnalysis>();

  for (const product of file.products) {
    const conflicts: string[] = [];
    const notes: string[] = [];
    const requires: string[] = [];
    const matches = findDestinationProducts(index, product.key);
    if ((fileKeyCount.get(product.key) ?? 0) > 1) {
      conflicts.push(`O arquivo traz mais de um produto com ${describeProductKey(product.key)}.`);
    }
    if (matches.length > 1) {
      conflicts.push(`Há ${matches.length} produtos com ${describeProductKey(product.key)} no destino; corrija o duplicado antes.`);
    }
    const destRow = matches.length === 1 ? matches[0] : null;
    const lineRow = matchLine(product.line, dest.subcategories);
    if (!lineRow) {
      const lineName = product.line ? `"${product.line.name}"` : "(sem linha)";
      if (!destRow) {
        conflicts.push(`A linha de produção ${lineName} não existe no destino. Cadastre-a e importe de novo.`);
      } else {
        notes.push(`A linha ${lineName} não existe no destino; o produto fica na linha atual.`);
      }
    }

    for (const line of product.recipe) {
      if (line.sourceType === "produto") {
        if (!line.productKey) {
          conflicts.push(`Um MPI da receita (${text(line.fields.label) || "sem nome"}) não está no arquivo.`);
        } else if (fileKeys.has(line.productKey)) {
          const targetMatches = findDestinationProducts(index, line.productKey);
          if (targetMatches.length === 0 && line.productKey !== product.key) requires.push(line.productKey);
          if (targetMatches.length > 1) {
            conflicts.push(`O MPI ${describeProductKey(line.productKey)} está duplicado no destino.`);
          }
        } else if (findDestinationProducts(index, line.productKey).length !== 1) {
          conflicts.push(`O MPI ${describeProductKey(line.productKey)} não está no arquivo nem no destino.`);
        }
      } else if (!line.ingredientCode) {
        conflicts.push(`Um insumo da receita (${text(line.fields.label) || "sem nome"}) não está no arquivo.`);
      } else {
        const status = ingredientStatus.get(line.ingredientCode);
        const inDest = (index.ingredientsByCode.get(line.ingredientCode) ?? []).length === 1;
        if (!status && !inDest) {
          conflicts.push(`O insumo ${line.ingredientCode} não está no arquivo nem no destino.`);
        } else if (status && status.conflicts.length > 0) {
          conflicts.push(`Insumo ${line.ingredientCode} - ${status.name} em conflito: ${status.conflicts[0]}`);
        }
      }
    }
    for (const stageKey of collectCustomStageKeys(product.fields, product.recipe)) {
      if (!index.stageKeys.has(stageKey) && !stageStatus.has(stageKey)) {
        conflicts.push(`A etapa ${stageKey} não está no arquivo nem no destino.`);
      }
    }

    let changes: FieldChange[] = [];
    let recipeChanges: RecipeChange[] = [];
    let action: ReviewProduct["action"] = "novo";
    if (destRow) {
      changes = diffProductData(product, destRow, index);
      if (lineRow && String(lineRow.id) !== String(destRow.subcategory_id)) {
        const current = dest.subcategories.find((row) => String(row.id) === String(destRow.subcategory_id));
        changes.unshift({ field: "line", label: "Linha de produção", from: current ? text(current.name) : "—", to: text(lineRow.name) });
      }
      recipeChanges = diffRecipe(product.recipe, index.recipeByProduct.get(String(destRow.id)) ?? [], file);
      action = changes.length === 0 && recipeChanges.length === 0 ? "igual" : "atualizar";
    } else if (matches.length === 0) {
      const code = product.code;
      if (code && ((index.productsByCode.get(code)?.length ?? 0) > 0 || plannedNewCodes.has(code))) {
        notes.push(`O código de fábrica ${code} já existe no destino; será gerado outro.`);
      }
      plannedNewCodes.add(code);
    }

    analyses.set(product.key, {
      product,
      destRow,
      lineRow,
      review: {
        key: product.key,
        name: product.name,
        code: product.code,
        externalCode: product.externalCode,
        action,
        includedAsIngredient: product.includedAsIngredient,
        conflicts,
        notes,
        changes,
        recipeChanges,
        recipeLineCount: product.recipe.length,
        requires: [...new Set(requires)],
        blocked: conflicts.length > 0,
      },
    });
  }

  // Propaga bloqueio: depender de MPI novo que está bloqueado bloqueia também.
  let changed = true;
  while (changed) {
    changed = false;
    for (const { review } of analyses.values()) {
      if (review.blocked) continue;
      for (const key of review.requires) {
        const dependency = analyses.get(key);
        if (dependency?.review.blocked) {
          review.conflicts.push(`Depende do MPI ${dependency.review.name}, que tem conflito.`);
          review.blocked = true;
          changed = true;
          break;
        }
      }
    }
  }

  const products = file.products.map((product) => (analyses.get(product.key) as ProductAnalysis).review);
  const review: CatalogReview = {
    source: { companyName: file.source.companyName, exportedAt: file.exportedAt },
    products,
    ingredients: [...ingredientStatus.values()],
    stages: [...stageStatus.values()],
    summary: {
      novos: products.filter((p) => !p.blocked && p.action === "novo").length,
      atualizar: products.filter((p) => !p.blocked && p.action === "atualizar").length,
      iguais: products.filter((p) => !p.blocked && p.action === "igual").length,
      bloqueados: products.filter((p) => p.blocked).length,
    },
  };
  return { review, index, products: analyses, ingredientStatus, stageStatus };
}

export function buildCatalogReview(file: CatalogFile, dest: CatalogDestination): CatalogReview {
  return analyzeCatalog(file, dest).review;
}

/** Seleção padrão: tudo que cria ou atualiza e não está bloqueado. */
export function defaultSelection(review: CatalogReview): string[] {
  return review.products.filter((p) => !p.blocked && p.action !== "igual").map((p) => p.key);
}

/**
 * Liga/desliga um produto mantendo a seleção coerente: ligar puxa os MPIs novos que ele exige;
 * desligar um MPI novo desliga quem depende dele.
 */
export function toggleSelection(review: CatalogReview, selected: readonly string[], key: string, on: boolean): string[] {
  const byKey = new Map(review.products.map((p) => [p.key, p]));
  const result = new Set(selected);
  if (on) {
    const queue = [key];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      const item = byKey.get(current);
      if (!item || item.blocked || (result.has(current) && current !== key)) continue;
      result.add(current);
      for (const dep of item.requires) if (!result.has(dep)) queue.push(dep);
    }
  } else {
    const queue = [key];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      if (!result.delete(current)) continue;
      for (const item of review.products) {
        if (item.requires.includes(current) && result.has(item.key)) queue.push(item.key);
      }
    }
  }
  return [...result];
}
