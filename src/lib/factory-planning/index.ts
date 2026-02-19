import { buildMockFactoryInput } from "@/lib/factory-planning/mock-source";
import { getTodayDateKey } from "@/lib/factory-planning/engine";
import type { StoreOrder, StoreProfile } from "@/lib/factory-planning/types";

export * from "@/lib/factory-planning/types";
export * from "@/lib/factory-planning/units";
export * from "@/lib/factory-planning/engine";
export { buildMockFactoryInput } from "@/lib/factory-planning/mock-source";

const defaultSimulationInput = buildMockFactoryInput(getTodayDateKey());
export const stores: StoreProfile[] = defaultSimulationInput.stores;
export const storeOrders: StoreOrder[] = defaultSimulationInput.storeOrders;
