"use client";

import { ReleaseOrderBlockedError } from "@/lib/use-factory-planning";

interface ConfirmFn {
  (options: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "destructive" | "default";
  }): Promise<boolean>;
}

interface ToastApiLike {
  success: (description: string) => unknown;
  error: (description: string) => unknown;
  warning: (description: string) => unknown;
}

interface ReleaseOrderFn {
  (orderId: string, options?: { force?: boolean }): Promise<void>;
}

/**
 * Encapsula o fluxo de UI da liberação para produção:
 *  - happy path: toast de sucesso
 *  - bloqueio não-forçável (pedido cancelado): toast de erro
 *  - bloqueio forçável (capacidade / janela operacional): AlertDialog com motivo
 *    e botão "Liberar mesmo assim" que dispara releaseOrder({ force: true })
 *
 * Mantém a UX consistente entre /gestor-fabrica/pedidos (lista) e
 * /gestor-fabrica/pedidos/[orderId] (detalhe).
 */
export async function performReleaseOrderWithConfirm(
  order: { id: string; code: string },
  releaseOrder: ReleaseOrderFn,
  confirm: ConfirmFn,
  toast: ToastApiLike,
): Promise<void> {
  try {
    await releaseOrder(order.id);
    toast.success(`Pedido ${order.code} liberado para produção.`);
    return;
  } catch (error) {
    if (!(error instanceof ReleaseOrderBlockedError)) {
      toast.error(error instanceof Error ? error.message : "Falha ao liberar o pedido.");
      return;
    }

    if (!error.forceable) {
      toast.error(`Pedido ${order.code} bloqueado: ${stripInvalidPrefix(error.message)}`);
      return;
    }

    const confirmed = await confirm({
      title: `Liberar o pedido ${order.code} mesmo assim?`,
      description: `${stripInvalidPrefix(error.message)}\n\nA liberação ficará registrada como exceção (liberação forçada) no histórico do pedido.`,
      tone: "destructive",
      confirmLabel: "Liberar mesmo assim",
      cancelLabel: "Voltar",
    });

    if (!confirmed) {
      return;
    }

    try {
      await releaseOrder(order.id, { force: true });
      toast.warning(`Pedido ${order.code} liberado com exceção (override do gestor).`);
    } catch (forceError) {
      toast.error(
        forceError instanceof Error ? forceError.message : "Falha ao forçar liberação.",
      );
    }
  }
}

function stripInvalidPrefix(message: string) {
  return message.replace(/^Invalid release:\s*/i, "");
}
