"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { StoreMasterData } from "@/lib/production-planning";
import type { StoreProductMixTemplate } from "@/lib/store-product-mix";

export type ProductStoreMixToggles = { templates: Record<string, boolean>; stores: Record<string, boolean> };

type StoreLike = Pick<StoreMasterData, "id" | "name" | "status" | "productMixTemplateId" | "manualProductMix">;

/** Situação atual do produto em cada modelo e em cada loja de lista própria. */
export function buildProductStoreMixToggles(
  productId: string | null,
  templates: readonly StoreProductMixTemplate[],
  stores: readonly StoreLike[],
): ProductStoreMixToggles {
  const result: ProductStoreMixToggles = { templates: {}, stores: {} };
  templates.forEach((template) => {
    result.templates[template.id] = productId ? template.productIds.includes(productId) : false;
  });
  stores.forEach((store) => {
    if (!store.productMixTemplateId && store.manualProductMix) {
      result.stores[store.id] = productId ? store.manualProductMix.includes(productId) : false;
    }
  });
  return result;
}

/** Só o que mudou (o servidor mexe só nisso). */
export function diffProductStoreMixToggles(
  initial: ProductStoreMixToggles,
  current: ProductStoreMixToggles,
): ProductStoreMixToggles {
  const pick = (from: Record<string, boolean>, base: Record<string, boolean>) =>
    Object.fromEntries(Object.entries(from).filter(([id, value]) => base[id] !== value));
  return { templates: pick(current.templates, initial.templates), stores: pick(current.stores, initial.stores) };
}

export function hasProductStoreMixChanges(diff: ProductStoreMixToggles) {
  return Object.keys(diff.templates).length > 0 || Object.keys(diff.stores).length > 0;
}

export async function saveProductStoreMix(productId: string, diff: ProductStoreMixToggles) {
  const response = await fetch("/api/master-data/product-store-mix", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, ...diff }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Falha ao salvar as lojas do produto.");
  }
}

/**
 * Cartão #602: no cadastro do produto, em quais lojas ele é vendido. Marca o produto nos
 * modelos de mix e nas lojas com lista própria; lojas em "Todos os produtos" sempre o veem.
 * Produto já cadastrado salva aqui mesmo ("Salvar lojas"); produto novo salva junto com o
 * cadastro.
 */
export function ProductStoreMixSection({
  isNewProduct,
  templates,
  stores,
  value,
  onChange,
  onSave,
  saving = false,
  dirty = false,
  readOnly = false,
}: {
  isNewProduct: boolean;
  templates: StoreProductMixTemplate[];
  stores: StoreLike[];
  value: ProductStoreMixToggles;
  onChange: (next: ProductStoreMixToggles) => void;
  onSave?: () => void;
  saving?: boolean;
  dirty?: boolean;
  readOnly?: boolean;
}) {
  const activeStores = useMemo(() => stores.filter((store) => store.status === "ativo"), [stores]);
  const allProductsStores = activeStores.filter((store) => !store.productMixTemplateId && !store.manualProductMix);
  const manualStores = activeStores.filter((store) => !store.productMixTemplateId && store.manualProductMix);
  const storesByTemplate = useMemo(() => {
    const map = new Map<string, string[]>();
    activeStores.forEach((store) => {
      if (store.productMixTemplateId) {
        map.set(store.productMixTemplateId, [...(map.get(store.productMixTemplateId) ?? []), store.name]);
      }
    });
    return map;
  }, [activeStores]);

  const visibleCount =
    allProductsStores.length +
    manualStores.filter((store) => value.stores[store.id]).length +
    templates.filter((template) => value.templates[template.id]).reduce(
      (total, template) => total + (storesByTemplate.get(template.id)?.length ?? 0),
      0,
    );

  return (
    <section className="space-y-3 rounded-xl border border-border/80 p-4" data-testid="product-store-mix">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Lojas que vendem este produto (mix)</h3>
          <p className="text-xs text-muted-foreground">
            Nos lotes de pedidos, só essas lojas veem este produto. Hoje: <strong>{visibleCount}</strong> de{" "}
            {activeStores.length} lojas ativas.
          </p>
        </div>
        {!isNewProduct && onSave && !readOnly ? (
          <Button type="button" size="sm" variant="outline" disabled={!dirty || saving} onClick={onSave}>
            {saving ? "Salvando..." : "Salvar lojas"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Modelos de mix</p>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum modelo. Crie em Cadastros › Lojas › Modelos de mix.</p>
            ) : (
              templates.map((template) => {
                const names = storesByTemplate.get(template.id) ?? [];
                return (
                  <label key={template.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      checked={value.templates[template.id] === true}
                      disabled={readOnly}
                      aria-label={`Modelo ${template.name}`}
                      onCheckedChange={(checked) =>
                        onChange({ ...value, templates: { ...value.templates, [template.id]: checked === true } })
                      }
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{template.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {names.length > 0 ? names.join(", ") : "Nenhuma loja usa este modelo"}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Lojas com lista própria
            </p>
            {manualStores.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma loja com lista própria.</p>
            ) : (
              manualStores.map((store) => (
                <label key={store.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm">
                  <Checkbox
                    checked={value.stores[store.id] === true}
                    disabled={readOnly}
                    aria-label={`Loja ${store.name}`}
                    onCheckedChange={(checked) =>
                      onChange({ ...value, stores: { ...value.stores, [store.id]: checked === true } })
                    }
                  />
                  {store.name}
                </label>
              ))
            )}
            {allProductsStores.length > 0 ? (
              <p className="pt-1 text-xs text-muted-foreground">
                Veem todos os produtos: {allProductsStores.map((store) => store.name).join(", ")}.
              </p>
            ) : null}
          </div>
      </div>

      {isNewProduct && !readOnly ? (
        <p className="text-xs text-muted-foreground">As lojas marcadas são salvas junto com o cadastro do produto.</p>
      ) : null}
    </section>
  );
}
