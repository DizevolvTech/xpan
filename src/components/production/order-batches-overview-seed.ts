"use client";

import type { OrderBatchOverview } from "@/lib/supabase-data/order-batch-overview";

/**
 * Cartão #18: visão dos lotes que veio junto com o HTML da tela de Pedidos.
 * Vale uma vez e por pouco tempo: a primeira leitura do painel usa este dado; recarregar
 * depois de liberar/abrir lote sempre busca de novo no servidor.
 */
const SEED_TTL_MS = 10_000;
let seeded: { data: OrderBatchOverview; at: number } | null = null;

export function seedOrderBatchesOverview(data: OrderBatchOverview) {
  seeded = { data, at: Date.now() };
}

export function takeSeededOrderBatchesOverview(): (OrderBatchOverview & { message?: string }) | null {
  const current = seeded;
  seeded = null;
  return current && Date.now() - current.at < SEED_TTL_MS ? current.data : null;
}
