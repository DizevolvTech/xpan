"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { readClientAccessContext } from "@/lib/client-access-context";
import type { ProductionOrderRow } from "@/lib/factory-planning/types";
import { productionOrderPlanningKey } from "@/lib/production-order-trash-filter";
import { formatKgValue } from "@/lib/utils";

interface TrashItem {
  id: string;
  opCode: string | null;
  productionDate: string | null;
  lineName: string | null;
  productsCount: number | null;
  totalKg: number | null;
  deletedAt: string;
}

/**
 * Lixeira de OPs (reunião 22/10, bloco 8 — decisão do Lucas: só Master). O Master abre o
 * cliente em modo leitura; só ele vê "Excluir OP" e a Lixeira.
 */
export function useIsMasterTenantView() {
  const [isMaster, setIsMaster] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setIsMaster(readClientAccessContext().accessMode === "read-only-tenant"),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);
  return isMaster;
}

export function useOpTrashActions(referenceDate: string, onChanged: () => Promise<unknown> | void) {
  const confirm = useConfirm();
  const toast = useToast();
  const [version, setVersion] = useState(0);

  const trash = useCallback(
    async (op: ProductionOrderRow) => {
      const ok = await confirm({
        title: `Excluir a ${op.code}?`,
        description: `A OP vai para a lixeira e some da fila, dos quadros e das impressões (${op.lineName}, ${op.productionDateLabel}, ${formatKgValue(op.totalKg)}). Os pedidos não são apagados. Dá para restaurar pela Lixeira. Se entrar pedido novo nesta linha e dia, a OP volta.`,
        confirmLabel: "Mandar para a lixeira",
        cancelLabel: "Voltar",
        tone: "destructive",
        allowInReadOnly: true,
      });
      if (!ok) return;
      const response = await fetch("/api/production-orders/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trash", planningKey: productionOrderPlanningKey(op), referenceDate }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        toast.error(result?.message ?? "Não foi possível excluir a OP.");
        return;
      }
      toast.success(`${op.code} foi para a lixeira.`);
      setVersion((value) => value + 1);
      await onChanged();
    },
    [confirm, onChanged, referenceDate, toast],
  );

  return { trash, version, bump: () => setVersion((value) => value + 1) };
}

export function OpTrashButton({
  version,
  onRestored,
}: {
  version: number;
  onRestored: () => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const response = await fetch("/api/production-orders/trash", { cache: "no-store" });
    const result = (await response.json().catch(() => null)) as { items?: TrashItem[]; message?: string } | null;
    if (!response.ok) {
      setError(result?.message ?? "Falha ao carregar a lixeira.");
      return;
    }
    setError(null);
    setItems(result?.items ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, version]);

  async function restore(item: TrashItem) {
    setBusyId(item.id);
    try {
      const response = await fetch("/api/production-orders/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", trashId: item.id }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Não foi possível restaurar.");
      toast.success(`${item.opCode ?? "OP"} restaurada.`);
      await load();
      await onRestored();
    } catch (restoreError) {
      toast.error(restoreError instanceof Error ? restoreError.message : "Não foi possível restaurar.");
    } finally {
      setBusyId(null);
    }
  }

  const count = items?.length ?? 0;
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        Lixeira de OPs{count > 0 ? ` (${count})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Lixeira de OPs</DialogTitle>
            <DialogDescription>OPs excluídas pelo Master. Restaurar devolve a OP para a fila.</DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {items && items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">A lixeira está vazia.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border/60 overflow-auto rounded-lg border border-border/70">
              {(items ?? []).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono font-semibold">{item.opCode ?? "OP"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.lineName ?? "—"} · produção {item.productionDate?.split("-").reverse().join("/") ?? "—"}
                      {item.totalKg != null ? ` · ${formatKgValue(item.totalKg)}` : ""} · excluída em{" "}
                      {new Date(item.deletedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    allowInReadOnly
                    disabled={busyId !== null}
                    onClick={() => void restore(item)}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    Restaurar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
