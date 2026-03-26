"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import type { UnitCode } from "@/lib/factory-planning/units";
import { getOperationalUnitLabel, preferredOperationalUnits } from "@/lib/operational-units";
import type { IngredientCompositionItem } from "@/lib/production-planning";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CompositionOption = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
};

type CompositionDraft = {
  componentId: string;
  quantity: string;
  unit: UnitCode;
  observation: string;
};

interface IngredientCompositionEditorProps {
  title: string;
  description: string;
  composition: IngredientCompositionItem[];
  emptyMessage: string;
  options?: CompositionOption[];
  draft?: CompositionDraft;
  unitOptions?: readonly UnitCode[];
  onDraftChange?: (patch: Partial<CompositionDraft>) => void;
  onAdd?: () => void;
  onRemove?: (itemId: string) => void;
  onMove?: (itemId: string, direction: "up" | "down") => void;
  onUpdate?: (
    itemId: string,
    patch: Partial<Pick<IngredientCompositionItem, "quantity" | "unit" | "observation">>,
  ) => void;
  readOnly?: boolean;
}

const defaultUnitOptions = preferredOperationalUnits;

export function IngredientCompositionEditor({
  title,
  description,
  composition,
  emptyMessage,
  options = [],
  draft,
  unitOptions = defaultUnitOptions,
  onDraftChange,
  onAdd,
  onRemove,
  onMove,
  onUpdate,
  readOnly = false,
}: IngredientCompositionEditorProps) {
  const shouldUseSearchableSelect = options.length >= 8;

  return (
    <section className="space-y-4 rounded-xl border border-border/80 bg-panel/20 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {!readOnly && draft && onDraftChange && onAdd ? (
        <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.7fr_1fr_auto]">
          <div className="grid gap-2">
            <Label>Componente</Label>
            {shouldUseSearchableSelect ? (
              <SearchableSelect
                value={draft.componentId}
                onValueChange={(value) => onDraftChange({ componentId: value })}
                options={options.map((option) => ({
                  value: option.id,
                  label: option.label,
                  description: option.description,
                  keywords: option.keywords,
                }))}
                placeholder="Selecione um componente"
                searchPlaceholder="Buscar ingrediente ou produto..."
                emptyMessage="Nenhum componente encontrado."
                title="Selecionar componente"
                description="Busque pelo nome ou código do ingrediente ou produto MPI."
              />
            ) : (
              <Select
                value={draft.componentId}
                onValueChange={(value) => onDraftChange({ componentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um componente" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Quantidade</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={draft.quantity}
              onChange={(event) => onDraftChange({ quantity: event.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Unidade</Label>
            <Select value={draft.unit} onValueChange={(value) => onDraftChange({ unit: value as UnitCode })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {getOperationalUnitLabel(unit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Observação</Label>
            <Input
              value={draft.observation}
              onChange={(event) => onDraftChange({ observation: event.target.value })}
              placeholder="Ex: usar peneirado"
            />
          </div>

          <div className="flex items-end">
            <Button type="button" onClick={onAdd}>
              <Plus className="size-4" />
              Adicionar
            </Button>
          </div>
        </div>
      ) : null}

      <PaginatedSection items={composition} label="componentes" initialPageSize={5}>
        {(paginatedComposition) => (
          <div className="overflow-hidden rounded-xl border border-border/70">
            <table className="w-full border-collapse">
              <thead className="bg-card">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Componente</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Quantidade</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Unidade</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Observação</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {composition.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border-t border-border/70 bg-card px-3 py-3 text-sm text-muted-foreground">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  paginatedComposition.map((item) => (
                    <tr key={item.id}>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.name}</td>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                    {readOnly || !onUpdate ? (
                      item.quantity
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.quantity}
                        onChange={(event) => onUpdate(item.id, { quantity: Number(event.target.value) })}
                      />
                    )}
                  </td>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                    {readOnly || !onUpdate ? (
                      item.unit
                    ) : (
                      <Select
                        value={item.unit}
                        onValueChange={(value) => onUpdate(item.id, { unit: value as UnitCode })}
                      >
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {unitOptions.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {getOperationalUnitLabel(unit)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                    {readOnly || !onUpdate ? (
                      item.observation?.trim() ? item.observation : "-"
                    ) : (
                      <Input
                        value={item.observation ?? ""}
                        onChange={(event) => onUpdate(item.id, { observation: event.target.value })}
                        placeholder="Observação operacional"
                      />
                    )}
                  </td>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-right">
                    {readOnly || !onRemove ? (
                      <span className="text-xs text-muted-foreground">Somente leitura</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => onMove?.(item.id, "up")}
                          disabled={composition.findIndex((entry) => entry.id === item.id) === 0}
                          title="Mover para cima"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => onMove?.(item.id, "down")}
                          disabled={composition.findIndex((entry) => entry.id === item.id) === composition.length - 1}
                          title="Mover para baixo"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger-foreground/80 hover:bg-danger/35 hover:text-danger-foreground"
                          onClick={() => onRemove(item.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </PaginatedSection>
    </section>
  );
}
