import "server-only";

import { getCachedServerData } from "@/lib/server-data-cache";
import { buildFactoryPlanningData } from "@/lib/order-planning";
import { applyFactoryWorkflowState } from "@/lib/factory-workflow-logic";
import { buildFactoryInputFromDb } from "@/lib/supabase-data/store-orders";
import {
  assertTenantId,
  buildTenantCacheKey,
  type SupabaseDataClient,
} from "@/lib/supabase-data/common";
import { canonicalProductionItemKey, getPersistedWorkflowState } from "@/lib/supabase-data/workflow";
import { getPersistedDeliveryExecutions } from "@/lib/supabase-data/delivery";

const FACTORY_PLANNING_CACHE_TTL_MS = 10_000;

export async function getFactoryPlanningSnapshot(
  referenceDate: string,
  options: {
    supabase?: SupabaseDataClient;
    includeProfileNames?: boolean;
    tenantId?: string | null;
  } = {},
) {
  const includeProfileNames = options.includeProfileNames ?? false;
  const tenantId = assertTenantId(options.tenantId);
  const cacheKey = buildTenantCacheKey(
    tenantId,
    "planning",
    referenceDate,
    includeProfileNames ? "with-profiles" : "without-profiles",
  );

  return getCachedServerData(cacheKey, FACTORY_PLANNING_CACHE_TTL_MS, async () => {
    const [factoryInput, workflowState, deliveryExecutions] = await Promise.all([
      buildFactoryInputFromDb({
        supabase: options.supabase,
        includeProfileNames,
        tenantId,
      }),
      getPersistedWorkflowState(options.supabase),
      getPersistedDeliveryExecutions({ supabase: options.supabase, tenantId }),
    ]);

    const basePlanning = buildFactoryPlanningData(referenceDate, factoryInput);

    const startedKeys = new Set(workflowState.productionStartedKeys);

    return applyFactoryWorkflowState(basePlanning, {
      isReleased(orderId) {
        return workflowState.releasedOrders.includes(orderId);
      },
      isCancelled(orderId) {
        return workflowState.cancelledOrders.includes(orderId);
      },
      resolveProductionItemStatus(itemKey) {
        if (!itemKey) {
          return null;
        }
        // Estado é keyed por chave CANÔNICA (3 partes); chaves MPI vêm com 4.
        return workflowState.productionItemStatuses[canonicalProductionItemKey(itemKey)] ?? "nao_iniciado";
      },
      isProductionStarted(itemKey) {
        return itemKey ? startedKeys.has(canonicalProductionItemKey(itemKey)) : false;
      },
      resolveBatchesDone(itemKey) {
        return itemKey ? workflowState.productionBatchesDone[canonicalProductionItemKey(itemKey)] ?? 0 : 0;
      },
      // Mesmo espaço de id de `isReleased` (legacy_id): getPersistedWorkflowState
      // chaveia releasedOrders por legacy_id e getPersistedDeliveryExecutions
      // chaveia por legacy_id ?? id — lookup direto pelo orderId da OP.
      resolveDeliveryStatus(orderId) {
        return deliveryExecutions[orderId]?.status ?? null;
      },
    });
  });
}
