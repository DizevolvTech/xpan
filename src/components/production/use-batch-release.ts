"use client";

import { useState } from "react";

import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/shared/toast";
import type { BatchGroupView } from "@/lib/supabase-data/order-batch-overview";

export function brDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return year && month && day ? `${day}/${month}` : dateKey;
}

/** Texto de por que o lote ainda não pode ser liberado (null = pode). */
export function batchReleaseBlockedReason(group: Pick<BatchGroupView, "state" | "deadline" | "pendingOrderIds">) {
  if (group.pendingOrderIds.length === 0) return "Nenhum pedido para liberar ainda";
  if (group.state === "aguardando_lojas") {
    return `As lojas ainda podem pedir até ${brDate(group.deadline.dateKey)} às ${group.deadline.time}`;
  }
  return null;
}

/**
 * Liberar um lote (todos os pedidos da data de entrega) — usado pelo painel de lotes e pelas
 * faixas de lote da lista de Pedidos. Quadro #4 (Lucas, 27/10): dentro do prazo das lojas o
 * lote não é liberado (sem "liberar mesmo assim"); libera completo ou com o prazo encerrado.
 */
export function useBatchRelease(onReleased: () => Promise<void> | void) {
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  async function releaseGroup(group: BatchGroupView) {
    const blocked = batchReleaseBlockedReason(group);
    if (blocked) {
      toast.info(blocked);
      return;
    }
    const go = await confirm({
      title: `Liberar a entrega de ${brDate(group.deliveryDate)} para a produção?`,
      description: `${group.pendingOrderIds.length} pedido(s) vão para a produção de uma vez.${
        group.missingStoreNames.length > 0
          ? ` O prazo acabou sem pedido de: ${group.missingStoreNames.join(", ")}.`
          : " Todas as lojas pediram."
      }`,
      tone: "default",
      confirmLabel: "Liberar lote",
      cancelLabel: "Voltar",
    });
    if (!go) return;
    setBusyDate(group.deliveryDate);
    try {
      const response = await fetch("/api/order-batches/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryDate: group.deliveryDate }),
      });
      const result = (await response.json().catch(() => null)) as
        | { released?: string[]; failed?: Array<{ orderCode: string; message: string }>; message?: string }
        | null;
      if (!response.ok) throw new Error(result?.message ?? "Falha ao liberar o lote.");
      const released = result?.released?.length ?? 0;
      const failed = result?.failed ?? [];
      if (failed.length > 0) {
        toast.warning(
          `${released} pedido(s) liberado(s); ${failed.length} não: ${failed.map((item) => `${item.orderCode} (${item.message})`).join("; ")}`,
        );
      } else {
        toast.success(`Entrega de ${brDate(group.deliveryDate)}: ${released} pedido(s) liberado(s) para a produção.`);
      }
      await onReleased();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao liberar o lote.");
    } finally {
      setBusyDate(null);
    }
  }

  return { releaseGroup, busyDate };
}
