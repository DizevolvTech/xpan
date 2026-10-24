"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { useFutureDateOverride } from "@/lib/use-future-date-override";

/** Ações de batida do gestor com a mesma trava/override de data do restante da OP. */
export function useGestorBatchActions(
  completeProductionBatch: (key: string, batchCount: number, options?: { force?: boolean }) => Promise<void>,
  undoProductionBatch: (key: string) => Promise<void>,
  onError: (message: string | null) => void,
) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const tryFutureDateOverride = useFutureDateOverride();

  const complete = useCallback(
    async (key: string, batchCount: number) => {
      onError(null);
      setPendingKey(key);
      try {
        await completeProductionBatch(key, batchCount);
      } catch (error) {
        const handled = await tryFutureDateOverride(
          error,
          () => completeProductionBatch(key, batchCount, { force: true }),
          (message) => onError(message),
        );
        if (!handled) onError(error instanceof Error ? error.message : "Falha ao concluir a batida.");
      } finally {
        setPendingKey(null);
      }
    },
    [completeProductionBatch, onError, tryFutureDateOverride],
  );

  const undo = useCallback(
    async (key: string) => {
      onError(null);
      setPendingKey(key);
      try {
        await undoProductionBatch(key);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Falha ao desfazer a batida.");
      } finally {
        setPendingKey(null);
      }
    },
    [onError, undoProductionBatch],
  );

  return { pendingKey, complete, undo };
}

/**
 * Controles de batida para o GESTOR (reunião 22/10, bloco 4: "toda OP precisa ter uma ação").
 * Antes o gestor via "0/N batidas · geridas no Chão" sem nenhum botão; agora conclui ou
 * desfaz a batida, com a mesma regra do chão (a última batida fecha o produto).
 */
export function GestorBatchControls({
  batchesDone,
  batchCount,
  busy,
  onComplete,
  onUndo,
}: {
  batchesDone: number;
  batchCount: number;
  busy: boolean;
  onComplete: () => void;
  onUndo: () => void;
}) {
  const isDone = batchesDone >= batchCount;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground tabular-nums">
        {isDone ? `Todas as ${batchCount} batidas concluídas` : `Batida ${batchesDone + 1} de ${batchCount}`}
      </p>
      <div className="flex flex-wrap gap-2">
        {batchesDone > 0 ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onUndo}>
            Desfazer batida
          </Button>
        ) : null}
        {!isDone ? (
          <Button type="button" size="sm" disabled={busy} onClick={onComplete}>
            Concluir batida {batchesDone + 1}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
