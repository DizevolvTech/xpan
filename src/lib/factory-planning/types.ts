import type { UnitCode } from "@/lib/factory-planning/units";

export type OrderStatus = "agendado" | "em_producao" | "em_espera" | "rota_entrega";
export type OrderUnit = UnitCode;

export interface StoreProfile {
  id: string;
  name: string;
  cutoffTime: string;
  dPlusDays: number;
  receivesSunday: boolean;
}

export interface StoreOrderItem {
  id: string;
  productId: string;
  quantity: number;
  unit: OrderUnit;
}

export interface StoreOrder {
  id: string;
  code: string;
  storeId: string;
  orderedAt: string;
  items: StoreOrderItem[];
}

export interface PlannedOrderItem {
  id: string;
  orderId: string;
  orderCode: string;
  storeId: string;
  storeName: string;
  orderedAt: string;
  baseDate: string;
  deliveryDate: string;
  productionDate: string | null;
  delayed: boolean;
  productId: string;
  productCode: string;
  productName: string;
  lineId: string;
  lineName: string;
  sectorId: string;
  sectorName: string;
  scheduleId: string | null;
  scheduleCode: string | null;
  scheduleName: string | null;
  requestedQuantity: number;
  requestedUnit: OrderUnit;
  internalKg: number;
  expeditionUnit: OrderUnit;
  expeditionQuantityRaw: number;
  expeditionQuantity: number;
  canPlan: boolean;
  opCode: string | null;
  status: OrderStatus;
}

export interface PlannedOrderRow {
  id: string;
  code: string;
  storeId: string;
  storeName: string;
  orderedAt: string;
  dPlusLabel: string;
  deliveryDate: string;
  deliveryDateLabel: string;
  productionDateLabel: string;
  itemsCount: number;
  totalKg: number;
  opsLabel: string;
  status: OrderStatus;
}

export interface ProductionOrderItem {
  productId: string;
  productCode: string;
  productName: string;
  totalKg: number;
}

export interface ProductionOrderSourceItem {
  id: string;
  orderId: string;
  orderCode: string;
  storeName: string;
  productId: string;
  productCode: string;
  productName: string;
  requestedQuantity: number;
  requestedUnit: OrderUnit;
  internalKg: number;
  deliveryDate: string;
  deliveryDateLabel: string;
  expeditionUnit: OrderUnit;
  expeditionQuantity: number;
}

export interface ProductionOrderRow {
  id: string;
  code: string;
  productionDate: string;
  productionDateLabel: string;
  sectorId: string;
  sectorName: string;
  lineId: string;
  lineName: string;
  scheduleId: string;
  scheduleCode: string;
  scheduleName: string;
  itemsCount: number;
  ordersCount: number;
  totalKg: number;
  status: OrderStatus;
  orderCodes: string[];
  items: ProductionOrderItem[];
  sourceItems: ProductionOrderSourceItem[];
}

export interface ExpeditionItem {
  itemId: string;
  productId: string;
  productCode: string;
  productName: string;
  requestedQuantity: number;
  requestedUnit: OrderUnit;
  internalKg: number;
  expeditionQuantityRaw: number;
  expeditionQuantity: number;
  expeditionUnit: OrderUnit;
  productionDate: string | null;
}

export interface ExpeditionRow {
  id: string;
  orderId: string;
  orderCode: string;
  storeId: string;
  storeName: string;
  deliveryDate: string;
  deliveryDateLabel: string;
  totalKg: number;
  itemsCount: number;
  itemsSummary: string;
  status: OrderStatus;
  items: ExpeditionItem[];
}

export interface ExpeditionSeparationRow {
  id: string;
  expeditionId: string;
  orderId: string;
  orderCode: string;
  storeId: string;
  storeName: string;
  deliveryDate: string;
  deliveryDateLabel: string;
  status: OrderStatus;
  productId: string;
  productCode: string;
  productName: string;
  requestedQuantity: number;
  requestedUnit: OrderUnit;
  internalKg: number;
  expeditionQuantityRaw: number;
  expeditionQuantity: number;
  expeditionUnit: OrderUnit;
}

export interface FactoryPlanningData {
  referenceDate: string;
  orders: PlannedOrderRow[];
  orderItems: PlannedOrderItem[];
  productionOrders: ProductionOrderRow[];
  expedition: ExpeditionRow[];
  expeditionItems: ExpeditionSeparationRow[];
  productionDates: string[];
  deliveryDates: string[];
}

export interface FactorySimulationInput {
  stores: StoreProfile[];
  storeOrders: StoreOrder[];
}
