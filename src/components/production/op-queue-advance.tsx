"use client";

import { useCallback, useMemo, useState } from "react";
import { FastForward, Loader2 } from "lucide-react";

import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import type { ProductionItemStatus, ProductionOrderRow } from "@/lib/factory-planning/types";
import { advanceableItemsOf, pendingBatchItemsOf } from "@/lib/production-workflow";

/** OP tem algo para avançar pela fila: etapa (status) ou próxima batida. */
export function canAdvanceFromQueue(op: ProductionOrderRow) {
  return advanceableItemsOf(op).length > 0 || pendingBatchItemsOf(op).length > 0;
}

type CompleteBatchFn = (key: string, batchCount: number, options?: { force?: boolean }) => Promise<void>;

type AdvanceFn = (
  items: Array<{ productionItemKey: string; status: ProductionItemStatus }>,
  options?: { force?: boolean },
) => Promise<{ advanced: number; blockedCount: number; forceable: boolean; failed: unknown[] }>;

/**
 * Avanço de etapa DIRETO DA FILA de OPs, uma ou várias de uma vez
 * (reunião 22/10, bloco 4: "mudar o status direto da fila, sem entrar produto a produto").
 * Cada produto não batido da OP vai para a próxima etapa dele; batidos seguem pelas batidas.
 */
export function useOpQueueAdvance(advanceProductionItems: AdvanceFn, completeProductionBatch?: CompleteBatchFn) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const toggle = useCallback(
    (id: string) =>
      setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])),
    [],
  );
  const clear = useCallback(() => setSelectedIds([]), []);

  const advance = useCallback(
    async (ops: ProductionOrderRow[], label: string) => {
      const items = ops.flatMap(advanceableItemsOf);
      const batchItems = completeProductionBatch ? ops.flatMap(pendingBatchItemsOf) : [];
      if (items.length === 0 && batchItems.length === 0) {
        toast.info("Nada a avançar nesta OP.");
        return;
      }
      if (batchItems.length > 0) {
        const go = await confirm({
          title: "Concluir a próxima batida?",
          description: `${batchItems.length} produto(s) por batida: registra a próxima batida de cada um (a última batida conclui o produto). Dá para desfazer dentro da OP.`,
          tone: "default",
          confirmLabel: "Concluir batida",
          cancelLabel: "Cancelar",
        });
        if (!go) return;
      }
      setBusy(true);
      try {
        let batchesDone = 0;
        const batchFailures: string[] = [];
        for (const batch of batchItems) {
          try {
            await completeProductionBatch!(batch.productionItemKey, batch.batchCount);
            batchesDone += 1;
          } catch (error) {
            batchFailures.push(error instanceof Error ? error.message : "Falha ao concluir a batida.");
          }
        }
        if (batchesDone > 0) toast.success(`${batchesDone} batida(s) concluída(s) — ${label}.`);
        if (batchFailures.length > 0) toast.error(`${batchFailures.length} batida(s) não registradas: ${batchFailures[0]}`);
        if (items.length === 0) {
          setSelectedIds([]);
          return;
        }
        let result = await advanceProductionItems(items);
        if (result.blockedCount > 0 && result.forceable) {
          const go = await confirm({
            title: "Iniciar antes da data de produção?",
            description: `${result.blockedCount} produto(s) ainda não chegaram na data de produção.`,
            tone: "default",
            confirmLabel: "Iniciar mesmo assim",
            cancelLabel: "Deixar para a data",
          });
          if (go) {
            const forced = await advanceProductionItems(items, { force: true });
            result = { ...forced, advanced: result.advanced + forced.advanced };
          }
        } else if (result.blockedCount > 0) {
          toast.warning(`${result.blockedCount} produto(s) só iniciam na data de produção.`);
        }
        if (result.advanced > 0) toast.success(`${result.advanced} produto(s) avançado(s) — ${label}.`);
        if (result.failed.length > 0) toast.error(`${result.failed.length} produto(s) não avançaram.`);
        setSelectedIds([]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao avançar a produção.");
      } finally {
        setBusy(false);
      }
    },
    [advanceProductionItems, completeProductionBatch, confirm, toast],
  );

  return useMemo(
    () => ({ selectedIds, isSelected: (id: string) => selectedIds.includes(id), toggle, clear, advance, busy }),
    [selectedIds, toggle, clear, advance, busy],
  );
}

export type OpQueueAdvanceControl = ReturnType<typeof useOpQueueAdvance>;

/** Caixa de seleção da linha (não abre a OP ao clicar). */
export function OpQueueSelectCell({ control, op }: { control: OpQueueAdvanceControl; op: ProductionOrderRow }) {
  const canAdvance = canAdvanceFromQueue(op);
  return (
    <label
      className="flex size-9 cursor-pointer items-center justify-center"
      data-stop-row-click="true"
      onClick={(event) => event.stopPropagation()}
      title={canAdvance ? "Selecionar para avançar" : "Nada a avançar por etapa nesta OP"}
    >
      <input
        type="checkbox"
        className="size-4 accent-primary"
        disabled={!canAdvance || control.busy}
        checked={control.isSelected(op.id)}
        onChange={() => control.toggle(op.id)}
        aria-label={`Selecionar ${op.code}`}
      />
    </label>
  );
}

/** Botão "Avançar" da própria linha. */
export function OpQueueAdvanceButton({ control, op }: { control: OpQueueAdvanceControl; op: ProductionOrderRow }) {
  if (!canAdvanceFromQueue(op)) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 gap-1 px-2 text-xs"
      disabled={control.busy}
      data-stop-row-click="true"
      onClick={(event) => {
        event.stopPropagation();
        void control.advance([op], op.code);
      }}
      title={
        pendingBatchItemsOf(op).length > 0
          ? "Avança a OP: próxima etapa ou próxima batida de cada produto"
          : "Avança cada produto desta OP para a próxima etapa"
      }
      aria-label={`Avançar etapa da ${op.code}`}
    >
      <FastForward className="size-3.5" aria-hidden />
      <span>Avançar</span>
    </Button>
  );
}

/** Barra que aparece com OPs marcadas. */
export function OpQueueAdvanceBar({
  control,
  ops,
}: {
  control: OpQueueAdvanceControl;
  ops: ProductionOrderRow[];
}) {
  const selected = ops.filter((op) => control.selectedIds.includes(op.id));
  if (selected.length === 0) return null;
  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-card px-3 py-2 shadow-[var(--shadow-soft)]">
      <span className="text-sm font-semibold">{selected.length} OP(s) selecionada(s)</span>
      <Button
        type="button"
        size="sm"
        disabled={control.busy}
        onClick={() => void control.advance(selected, `${selected.length} OP(s)`)}
      >
        {control.busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FastForward className="size-4" aria-hidden />}
        Avançar etapa das selecionadas
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={control.busy} onClick={control.clear}>
        Limpar seleção
      </Button>
    </div>
  );
}
