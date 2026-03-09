import "server-only";

import { buildFactoryPlanningData } from "@/lib/order-planning";
import { applyFactoryWorkflowState } from "@/lib/factory-workflow-logic";
import { buildFactoryInputFromDb } from "@/lib/supabase-data/store-orders";
import { type SupabaseDataClient } from "@/lib/supabase-data/common";
import { getPersistedWorkflowState } from "@/lib/supabase-data/workflow";

export async function getFactoryPlanningSnapshot(
  referenceDate: string,
  options: {
    supabase?: SupabaseDataClient;
    includeProfileNames?: boolean;
  } = {},
) {
  const [factoryInput, workflowState] = await Promise.all([
    buildFactoryInputFromDb({
      supabase: options.supabase,
      includeProfileNames: options.includeProfileNames,
    }),
    getPersistedWorkflowState(options.supabase),
  ]);

  const basePlanning = buildFactoryPlanningData(referenceDate, factoryInput);

  return applyFactoryWorkflowState(basePlanning, {
    isReleased(orderId) {
      return workflowState.releasedOrders.includes(orderId);
    },
    resolveProductionItemStatus(itemKey) {
      if (!itemKey) {
        return null;
      }
      return workflowState.productionItemStatuses[itemKey] ?? "nao_iniciado";
    },
  });
}
