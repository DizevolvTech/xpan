"use client";

import { useCallback, useEffect, useState } from "react";

import { waitingBatchOrdersByCode, type WaitingBatchOrder } from "@/lib/waiting-batch-orders";
import type { OrderBatchOverview } from "@/lib/supabase-data/order-batch-overview";

const EMPTY = new Map<string, WaitingBatchOrder>();

/**
 * Pedidos de lote ainda no prazo das lojas (código PD-… → prazo). Quadro #4 (Lucas, 28/10):
 * Visão Geral e Detalhe do pedido escondem o "Liberar" desses pedidos, igual à tela de Pedidos.
 * Falha na leitura não bloqueia a tela: o servidor continua recusando a liberação (409).
 */
export function useWaitingBatchOrders(reloadKey: unknown = null) {
  const [waiting, setWaiting] = useState<Map<string, WaitingBatchOrder>>(EMPTY);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/order-batches/overview", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json().catch(() => null)) as OrderBatchOverview | null;
      if (data?.groups) setWaiting(waitingBatchOrdersByCode(data.groups));
    } catch {
      // mantém o último estado
    }
  }, []);

  useEffect(() => {
    // Busca assíncrona: o setState acontece depois da resposta, não no efeito.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, reloadKey]);

  return waiting;
}
