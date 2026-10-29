"use client";

import { useLayoutEffect } from "react";

import { seedOrderBatchesOverview } from "@/components/production/order-batches-overview-seed";
import { seedDeliveryExecutionState, type DeliveryExecutionState } from "@/lib/delivery-execution";
import type { PedidosPrefetch } from "@/lib/pedidos-prefetch";
import type { SavedListFilters } from "@/lib/saved-list-filters";
import type { OrderBatchOverview } from "@/lib/supabase-data/order-batch-overview";
import type { MasterDataSnapshot } from "@/lib/supabase-data/master-data";
import type { FactoryPlanningData } from "@/lib/order-planning";
import { seedFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { seedSavedListFilters } from "@/lib/use-list-status-filter";
import { seedMasterDataSnapshot } from "@/lib/use-master-data";

/**
 * Cartão #18: coloca nos caches da tela os dados que vieram com o HTML. Roda em
 * useLayoutEffect, antes dos useEffect dos hooks da tela, que então acham o cache
 * fresco e não vão ao servidor. Não renderiza nada (sem diferença entre servidor e
 * navegador na hidratação).
 */
export function PedidosPrefetchSeed({ payload }: { payload: PedidosPrefetch }) {
  useLayoutEffect(() => {
    if (payload.referenceDate && payload.factoryPlanning) {
      seedFactoryPlanningSnapshot(payload.referenceDate, payload.factoryPlanning as FactoryPlanningData);
    }
    if (payload.masterData) seedMasterDataSnapshot(payload.masterData as MasterDataSnapshot);
    if (payload.deliveryExecutions) seedDeliveryExecutionState(payload.deliveryExecutions as DeliveryExecutionState);
    if (payload.listFilters) seedSavedListFilters(payload.listFilters as SavedListFilters);
    if (payload.orderBatchesOverview) seedOrderBatchesOverview(payload.orderBatchesOverview as OrderBatchOverview);
    // Só na montagem: o dado é o retrato do momento em que a página foi gerada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
