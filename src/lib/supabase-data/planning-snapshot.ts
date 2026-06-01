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
import { getPersistedWorkflowState } from "@/lib/supabase-data/workflow";

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
    const [factoryInput, workflowState] = await Promise.all([
      buildFactoryInputFromDb({
        supabase: options.supabase,
        includeProfileNames,
        tenantId,
      }),
      getPersistedWorkflowState(options.supabase),
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
        return workflowState.productionItemStatuses[itemKey] ?? "nao_iniciado";
      },
      isProductionStarted(itemKey) {
        return itemKey ? startedKeys.has(itemKey) : false;
      },
    });
  });
}
