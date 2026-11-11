"use client";

import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  getStoreProductMixMode,
  type StoreProductMix,
  type StoreProductMixMode,
  type StoreProductMixTemplate,
} from "@/lib/store-product-mix";

export type StoreProductMixOption = { id: string; code: string; name: string };

export type StoreProductMixValue = { mode: StoreProductMixMode; templateId: string | null; manual: StoreProductMix };

/** Valor inicial do campo a partir da loja salva. */
export function buildStoreProductMixValue(store?: {
  productMixTemplateId?: string | null;
  manualProductMix?: StoreProductMix;
} | null): StoreProductMixValue {
  const templateId = store?.productMixTemplateId ?? null;
  const manual = store?.manualProductMix ?? null;
  return { mode: getStoreProductMixMode({ productMixTemplateId: templateId, manualProductMix: manual }), templateId, manual };
}

/** Erro do campo antes de salvar (`null` = ok). */
export function validateStoreProductMixValue(value: StoreProductMixValue): string | null {
  if (value.mode === "modelo" && !value.templateId) return "Escolha o modelo de mix da loja, ou volte para \"Todos os produtos\".";
  if (value.mode === "manual" && Array.isArray(value.manual) && value.manual.length === 0) {
    return "Marque ao menos um produto no mix da loja, ou volte para \"Todos os produtos\".";
  }
  return null;
}

/** Campos enviados à API ao salvar a loja. */
export function toStoreProductMixPayload(value: StoreProductMixValue) {
  if (value.mode === "modelo") return { productMixTemplateId: value.templateId, manualProductMix: null };
  if (value.mode === "manual") return { productMixTemplateId: null, manualProductMix: value.manual };
  return { productMixTemplateId: null, manualProductMix: null };
}

/**
 * Lista de produtos com busca e marcar/desmarcar (mix da loja e modelos de mix).
 * `selected` são ids de produto; `onChange` recebe a lista nova na ordem das opções.
 */
export function ProductChecklist({
  options,
  selected,
  onChange,
  readOnly = false,
  label = "Buscar produto no mix",
}: {
  options: StoreProductMixOption[];
  selected: ReadonlySet<string>;
  onChange: (nextIds: string[]) => void;
  readOnly?: boolean;
  label?: string;
}) {
  const [search, setSearch] = useState("");
  const allIds = useMemo(() => options.map((option) => option.id), [options]);
  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) => option.code.toLowerCase().includes(term) || option.name.toLowerCase().includes(term),
    );
  }, [options, search]);
  const selectedCount = allIds.filter((id) => selected.has(id)).length;

  function setMany(ids: string[], checked: boolean) {
    if (readOnly) return;
    const next = new Set(selected);
    ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    onChange(allIds.filter((id) => next.has(id)));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar produto..."
          className="w-full max-w-xs"
          aria-label={label}
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
        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
          <strong>{selectedCount}</strong> de {options.length} produtos marcados
        </span>
      </div>

      <div className="grid max-h-64 grid-cols-[minmax(0,1fr)] gap-1 overflow-auto rounded-lg border border-border/70 bg-card p-2 sm:grid-cols-2">
        {visibleOptions.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        ) : (
          visibleOptions.map((option) => (
            <label key={option.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm">
              <Checkbox
                checked={selected.has(option.id)}
                disabled={readOnly}
                onCheckedChange={(checked) => setMany([option.id], checked === true)}
              />
              <span className="min-w-0 truncate" title={`${option.code} · ${option.name}`}>
                <span className="text-muted-foreground">{option.code}</span> · {option.name}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

const modeLabels: Array<{ mode: StoreProductMixMode; label: string; hint?: string }> = [
  { mode: "todos", label: "Todos os produtos", hint: "(padrão)" },
  { mode: "modelo", label: "Usar um modelo de mix" },
  { mode: "manual", label: "Escolher os produtos" },
];

/**
 * Mix de produtos da loja (cartão #602): quais produtos a loja vende. Num lote aberto a loja vê
 * só esses produtos. Três jeitos: todos (padrão), um modelo de mix (lista usada por várias
 * lojas) ou a lista marcada aqui. Não vem do histórico de pedidos e pode mudar quando quiser.
 *
 * Na lista manual, marcar todos os produtos grava "todos" (`null`): produto novo continua
 * aparecendo nessa loja.
 */
export function StoreProductMixField({
  options,
  templates,
  value,
  onChange,
  onManageTemplates,
  readOnly = false,
}: {
  options: StoreProductMixOption[];
  templates: StoreProductMixTemplate[];
  value: StoreProductMixValue;
  onChange: (next: StoreProductMixValue) => void;
  onManageTemplates?: () => void;
  readOnly?: boolean;
}) {
  const mode = value.mode;
  const allIds = useMemo(() => options.map((option) => option.id), [options]);
  const manualSelected = useMemo(
    () => new Set(mode === "manual" && value.manual == null ? allIds : (value.manual ?? [])),
    [allIds, mode, value.manual],
  );
  const selectedTemplate = templates.find((template) => template.id === value.templateId) ?? null;
  const productById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);

  function chooseMode(next: StoreProductMixMode) {
    if (readOnly) return;
    if (next === "todos") onChange({ mode: next, templateId: null, manual: value.manual });
    if (next === "manual") onChange({ mode: next, templateId: null, manual: value.manual });
    // A lista manual fica guardada ao trocar de modo (só não é enviada no modo modelo/todos).
    if (next === "modelo") onChange({ mode: next, templateId: value.templateId ?? templates[0]?.id ?? null, manual: value.manual });
  }

  function emitManual(nextIds: string[]) {
    // Tudo marcado = sem restrição (null): produto novo continua aparecendo na loja.
    onChange({ mode: "manual", templateId: null, manual: nextIds.length > 0 && nextIds.length === allIds.length ? null : nextIds });
  }

  const emptyManual = mode === "manual" && manualSelected.size === 0;
  const missingTemplate = mode === "modelo" && !selectedTemplate;

  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border/80 bg-panel/20 p-4" data-testid="store-product-mix">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Mix de produtos da loja</h3>
          <p className="text-xs text-muted-foreground">
            Quais produtos esta loja vende. Nos lotes de pedidos a loja vê só esses produtos. Pode mudar quando
            quiser; não depende dos pedidos anteriores.
          </p>
        </div>
        {onManageTemplates && !readOnly ? (
          <button type="button" className="text-xs font-medium underline" onClick={onManageTemplates}>
            Modelos de mix
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Mix de produtos da loja">
        {modeLabels.map((entry) => (
          <label
            key={entry.mode}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm"
          >
            <input
              type="radio"
              name="store-product-mix-mode"
              checked={mode === entry.mode}
              disabled={readOnly}
              onChange={() => chooseMode(entry.mode)}
            />
            <span>
              {entry.label} {entry.hint ? <span className="text-muted-foreground">{entry.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>

      {mode === "modelo" ? (
        <div className="space-y-2">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum modelo cadastrado ainda.{" "}
              {onManageTemplates && !readOnly ? (
                <button type="button" className="underline" onClick={onManageTemplates}>
                  Criar um modelo de mix
                </button>
              ) : null}
            </p>
          ) : (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Modelo</span>
              <select
                aria-label="Modelo de mix"
                className="h-9 w-full max-w-xs rounded-md border border-border bg-card px-2 text-sm"
                value={value.templateId ?? ""}
                disabled={readOnly}
                onChange={(event) => onChange({ mode: "modelo", templateId: event.target.value || null, manual: value.manual })}
              >
                <option value="">Escolha um modelo...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.productIds.length} {template.productIds.length === 1 ? "produto" : "produtos"})
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedTemplate ? (
            <p className="text-xs text-muted-foreground" data-testid="store-product-mix-template-products">
              {selectedTemplate.productIds
                .map((id) => productById.get(id)?.name)
                .filter((name): name is string => Boolean(name))
                .join(" · ") || "Os produtos deste modelo não estão mais ativos."}
            </p>
          ) : null}
          {missingTemplate && templates.length > 0 ? (
            <p role="alert" className="text-xs text-danger">
              Escolha um modelo, ou volte para &quot;Todos os produtos&quot;.
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "manual" ? (
        <>
          <ProductChecklist options={options} selected={manualSelected} onChange={emitManual} readOnly={readOnly} />
          {emptyManual ? (
            <p role="alert" className="text-xs text-danger">
              Marque ao menos um produto, ou volte para &quot;Todos os produtos&quot;.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
