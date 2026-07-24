import "server-only";

import type { ProductionProduct } from "@/lib/production-planning";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertSupabaseResult,
  isSupabaseMissingSchemaError,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import { getMasterDataSnapshot } from "@/lib/supabase-data/master-data";

/** Receita congelada: `orderId → productId → receita` (ids no espaço `legacy_id ?? id`). */
export type ReleasedRecipeByOrderProduct = Map<string, Map<string, ProductionProduct["recipe"]>>;

const TABLE = "workflow_release_recipe_snapshots";

/**
 * XPAN #6: carrega as receitas CONGELADAS na liberação de todos os pedidos do tenant.
 * O motor usa esse mapa para expandir a receita de pedidos liberados com a versão do
 * momento da liberação, ignorando edições posteriores. Ausência da tabela (ambiente sem a
 * migration) devolve mapa vazio → tudo cai na receita ao vivo (comportamento anterior).
 */
export async function getReleasedRecipeSnapshots(
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<ReleasedRecipeByOrderProduct> {
  const result = await supabase.from(TABLE).select("order_id, product_id, recipe");
  if (result.error) {
    if (isSupabaseMissingSchemaError(result.error, [TABLE])) {
      return new Map();
    }
    throw new Error(`Failed to load release recipe snapshots: ${result.error.message}`);
  }
  const rows = (result.data ?? []) as Array<{
    order_id: string;
    product_id: string;
    recipe: ProductionProduct["recipe"] | null;
  }>;
  const map: ReleasedRecipeByOrderProduct = new Map();
  for (const row of rows) {
    let byProduct = map.get(row.order_id);
    if (!byProduct) {
      byProduct = new Map();
      map.set(row.order_id, byProduct);
    }
    byProduct.set(row.product_id, Array.isArray(row.recipe) ? row.recipe : []);
  }
  return map;
}

/** Percorre a ÁRVORE de receita (só refs `produto`, cycle-safe) coletando `productId → receita`. */
function collectRecipeTree(
  productId: string,
  productsById: Map<string, ProductionProduct>,
  acc: Map<string, ProductionProduct["recipe"]>,
  visited: Set<string>,
): void {
  if (visited.has(productId)) return;
  visited.add(productId);
  const product = productsById.get(productId);
  if (!product || product.recipe.length === 0) return;
  acc.set(productId, product.recipe);
  for (const ref of product.recipe) {
    // Só produtos (MPI) recursam — ingredientes misturados ficam na pré-pesagem, não viram
    // sub-receita expandida (mesma regra da expansão).
    if (ref.sourceType === "produto") {
      collectRecipeTree(ref.sourceId, productsById, acc, visited);
    }
  }
}

/**
 * XPAN #6: CONGELA a receita da árvore do pedido no momento da liberação. Uma linha por
 * (pedido × produto da árvore) com a receita como está AGORA. Idempotente (delete + insert):
 * re-liberar após editar a receita re-congela. Best-effort — o chamador não deve deixar uma
 * falha de snapshot bloquear a liberação (fallback = receita ao vivo).
 */
export async function captureReleaseRecipeSnapshot(
  orderRow: { id: string; legacy_id: string | null },
  tenantId: string,
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<void> {
  const orderLegacyId = orderRow.legacy_id ?? orderRow.id;

  const [itemsResult, productsResult] = await Promise.all([
    supabase.from("store_order_items").select("product_id").eq("order_id", orderRow.id),
    supabase.from("products").select("id, legacy_id"),
  ]);
  const itemRows = assertSupabaseResult(itemsResult, "Failed to load order items for recipe snapshot") as Array<{
    product_id: string;
  }>;
  const productRows = assertSupabaseResult(productsResult, "Failed to load products for recipe snapshot") as Array<{
    id: string;
    legacy_id: string | null;
  }>;

  const legacyByUuid = new Map(productRows.map((row) => [row.id, row.legacy_id ?? row.id]));
  const orderProductIds = Array.from(
    new Set(itemRows.map((row) => legacyByUuid.get(row.product_id) ?? row.product_id)),
  );

  // Receitas AO VIVO neste instante (= a versão a congelar).
  const snapshot = await getMasterDataSnapshot({ supabase, includeProfileNames: false, tenantId });
  const productsById = new Map(snapshot.products.map((product) => [product.id, product]));

  const recipeByProduct = new Map<string, ProductionProduct["recipe"]>();
  const visited = new Set<string>();
  for (const productId of orderProductIds) {
    collectRecipeTree(productId, productsById, recipeByProduct, visited);
  }

  // Regrava do zero (delete + insert): evita linhas órfãs se a árvore encolheu. order_id é
  // um legacy id globalmente único, então o filtro isola o pedido; o tenant client ainda
  // escopa por tenant_id.
  const deleteResult = await supabase.from(TABLE).delete().eq("order_id", orderLegacyId);
  if (deleteResult.error) {
    throw new Error(`Failed to clear release recipe snapshot: ${deleteResult.error.message}`);
  }
  if (recipeByProduct.size === 0) return;

  const insertResult = await supabase.from(TABLE).insert(
    Array.from(recipeByProduct.entries()).map(([productId, recipe]) => ({
      order_id: orderLegacyId,
      product_id: productId,
      recipe,
    })),
  );
  if (insertResult.error) {
    throw new Error(`Failed to persist release recipe snapshot: ${insertResult.error.message}`);
  }
}
