"use client";

import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { StoreProductMix } from "@/lib/store-product-mix";

export type StoreProductMixOption = { id: string; code: string; name: string };

/**
 * Mix de produtos da loja (cliente, 07/10): quais produtos a loja vê por padrão nos pedidos
 * abertos. "Todos os produtos" = `null` (padrão). Filtro de apresentação: não bloqueia pedido.
 *
 * Marcar todos os produtos grava `null`, assim um produto novo continua aparecendo nessa loja.
 */
export function StoreProductMixField({
  options,
  value,
  onChange,
  readOnly = false,
}: {
  options: StoreProductMixOption[];
  value: StoreProductMix | undefined;
  onChange: (next: StoreProductMix) => void;
  readOnly?: boolean;
}) {
  const [customMode, setCustomMode] = useState(Array.isArray(value) && value.length > 0);
  const [search, setSearch] = useState("");

  const allIds = useMemo(() => options.map((option) => option.id), [options]);
  const selected = useMemo(() => new Set(customMode && value == null ? allIds : (value ?? [])), [allIds, customMode, value]);

  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) => option.code.toLowerCase().includes(term) || option.name.toLowerCase().includes(term),
    );
  }, [options, search]);

  function emit(nextIds: string[]) {
    // Tudo marcado = sem restrição (null): produto novo continua aparecendo na loja.
    onChange(nextIds.length > 0 && nextIds.length === allIds.length ? null : nextIds);
  }

  function chooseMode(custom: boolean) {
    if (readOnly) return;
    setCustomMode(custom);
    if (!custom) {
      onChange(null);
    }
  }

  function toggle(productId: string) {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    emit(allIds.filter((id) => next.has(id)));
  }

  function setMany(ids: string[], checked: boolean) {
    if (readOnly) return;
    const next = new Set(selected);
    ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    emit(allIds.filter((id) => next.has(id)));
  }

  const selectedCount = selected.size;
  const emptySelection = customMode && selectedCount === 0;

  return (
    <section className="space-y-3 rounded-xl border border-border/80 bg-panel/20 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Mix de produtos da loja</h3>
        <p className="text-xs text-muted-foreground">
          Define quais produtos esta loja vê por padrão nos pedidos abertos. Não bloqueia nada: pedido manual e
          encomenda fora do padrão continuam aceitando qualquer produto.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
          <input
            type="radio"
            name="store-product-mix-mode"
            checked={!customMode}
            disabled={readOnly}
            onChange={() => chooseMode(false)}
          />
          <span>
            Todos os produtos <span className="text-muted-foreground">(padrão)</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
          <input
            type="radio"
            name="store-product-mix-mode"
            checked={customMode}
            disabled={readOnly}
            onChange={() => chooseMode(true)}
          />
          <span>Só os produtos que eu marcar</span>
        </label>
      </div>

      {customMode ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produto por código ou nome..."
              className="max-w-xs"
              aria-label="Buscar produto no mix"
            />
            {!readOnly ? (
              <>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => setMany(visibleOptions.map((option) => option.id), true)}
                >
                  Marcar {search.trim() ? "os filtrados" : "todos"}
                </button>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => setMany(visibleOptions.map((option) => option.id), false)}
                >
                  Desmarcar {search.trim() ? "os filtrados" : "todos"}
                </button>
              </>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              <strong>{selectedCount}</strong> de {options.length} produtos no mix
            </span>
          </div>

          <div className="grid max-h-64 gap-1 overflow-auto rounded-lg border border-border/70 bg-card p-2 sm:grid-cols-2">
            {visibleOptions.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
            ) : (
              visibleOptions.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm">
                  <Checkbox
                    checked={selected.has(option.id)}
                    disabled={readOnly}
                    onCheckedChange={() => toggle(option.id)}
                  />
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{option.code}</span> · {option.name}
                  </span>
                </label>
              ))
            )}
          </div>

          {emptySelection ? (
            <p role="alert" className="text-xs text-danger">
              Marque ao menos um produto, ou volte para &quot;Todos os produtos&quot;.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
