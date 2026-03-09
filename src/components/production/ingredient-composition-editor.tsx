"use client";

import { Plus, Trash2 } from "lucide-react";

import type { UnitCode } from "@/lib/factory-planning/units";
import type { IngredientCompositionItem } from "@/lib/production-planning";
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
  readOnly?: boolean;
}

const defaultUnitOptions = ["Kg", "L", "g", "Un"] as const satisfies readonly UnitCode[];

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
  readOnly = false,
}: IngredientCompositionEditorProps) {
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
            <Select value={draft.componentId} onValueChange={(value) => onDraftChange({ componentId: value })}>
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
          </div>

          <div className="grid gap-2">
            <Label>Quantidade</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={draft.quantity}
              onChange={(event) => onDraftChange({ quantity: event.target.value })}
              placeholder="0,000"
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
                    {unit}
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
              composition.map((item) => (
                <tr key={item.id}>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.name}</td>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.quantity}</td>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.unit}</td>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">
                    {item.observation?.trim() ? item.observation : "-"}
                  </td>
                  <td className="border-t border-border/70 bg-card px-3 py-3 text-right">
                    {readOnly || !onRemove ? (
                      <span className="text-xs text-muted-foreground">Somente leitura</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-danger-foreground/80 hover:bg-danger/35 hover:text-danger-foreground"
                        onClick={() => onRemove(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
