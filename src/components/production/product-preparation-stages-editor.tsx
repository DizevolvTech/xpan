"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  productPreparationStageLabels,
  type ProductPreparationStageKey,
} from "@/lib/production-planning";

const stageDescriptions: Record<ProductPreparationStageKey, string> = {
  em_preparacao: "Pesagem, separação, bancada, mistura inicial ou mise en place.",
  em_producao: "Execução principal da receita fora do forno.",
  em_forno: "Etapa de forneamento, cocção ou finalização térmica.",
  embalando: "Fechamento, porcionamento, embalagem e acabamento final.",
};

type ProductPreparationStagesEditorProps = {
  value: ProductPreparationStageKey[];
  disabled?: boolean;
  onChange: (nextValue: ProductPreparationStageKey[]) => void;
};

export function ProductPreparationStagesEditor({
  value,
  disabled = false,
  onChange,
}: ProductPreparationStagesEditorProps) {
  function toggleStage(stage: ProductPreparationStageKey, checked: boolean) {
    if (!checked) {
      onChange(value.filter((item) => item !== stage));
      return;
    }

    if (value.includes(stage)) {
      return;
    }

    onChange([...value, stage]);
  }

  function moveStage(stage: ProductPreparationStageKey, direction: "up" | "down") {
    const currentIndex = value.findIndex((item) => item === stage);
    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= value.length) {
      return;
    }

    const nextValue = [...value];
    const [moved] = nextValue.splice(currentIndex, 1);
    nextValue.splice(nextIndex, 0, moved);
    onChange(nextValue);
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Etapas operacionais do produto</h3>
        <p className="text-xs text-muted-foreground">
          Selecione somente as etapas que este produto realmente usa e organize na ordem correta.
        </p>
      </div>

      <div className="space-y-3">
        {(Object.keys(productPreparationStageLabels) as ProductPreparationStageKey[]).map((stage) => {
          const enabled = value.includes(stage);
          const currentIndex = value.findIndex((item) => item === stage);

          return (
            <div
              key={stage}
              className={`rounded-xl border p-3 transition-colors ${
                enabled ? "border-info/45 bg-info/10" : "border-border/70 bg-panel/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`stage-${stage}`}
                  checked={enabled}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggleStage(stage, checked === true)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label htmlFor={`stage-${stage}`} className="text-sm font-semibold text-foreground">
                        {productPreparationStageLabels[stage]}
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">{stageDescriptions[stage]}</p>
                    </div>
                    {enabled ? (
                      <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-info-foreground">
                        Ordem {currentIndex + 1}
                      </span>
                    ) : null}
                  </div>

                  {enabled ? (
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={disabled || currentIndex === 0}
                        onClick={() => moveStage(stage, "up")}
                        title="Mover etapa para cima"
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={disabled || currentIndex === value.length - 1}
                        onClick={() => moveStage(stage, "down")}
                        title="Mover etapa para baixo"
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border/70 bg-panel/20 px-3 py-3 text-xs text-muted-foreground">
        O fluxo sempre começa em <strong>Não iniciado</strong> e termina em <strong>Concluído</strong>. Aqui você define apenas as etapas intermediárias.
      </div>
    </div>
  );
}
