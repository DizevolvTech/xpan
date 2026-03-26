import type { DeliveryExecutionStatus } from "@/lib/delivery-workflow";
import type { UnitCode } from "@/lib/factory-planning/units";
import type { OrderStatus } from "@/lib/order-planning";
import type { ProductionWeekDay } from "@/lib/production-planning";

export type StoreVisibleOrderStatus = OrderStatus | DeliveryExecutionStatus;

export interface StoreOrderSummary {
  id: string;
  code: string;
  storeId: string;
  date: string;
  orderedAtKey: string;
  deliveryDate: string;
  deliveryDateKey: string;
  status: StoreVisibleOrderStatus;
  store: string;
}

export interface StoreOrderDetailItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  category: string;
  unit: UnitCode;
  operationalUnit: UnitCode;
  quantity: number;
}

export interface StoreOrderTimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  actorName: string | null;
}

export interface StoreOrderDetail extends StoreOrderSummary {
  orderedAtIso: string;
  dPlusLabel: string;
  cutoffTime: string;
  receivesSunday: boolean;
  receiveWindow: string;
  note: string;
  canEdit: boolean;
  canCancel: boolean;
  canOpenOccurrence: boolean;
  items: StoreOrderDetailItem[];
  events: StoreOrderTimelineEvent[];
}

export type StoreOrderCatalogProduct = {
  id: string;
  productId: string;
  scheduleId: string | null;
  code: string;
  name: string;
  unit: UnitCode;
  unitKind: "continuous" | "discrete";
  salesToKgFactor: number;
  category: string;
  sectorName: string;
  lineName: string;
  lineType: string;
  scheduleName: string;
  productionDays: ProductionWeekDay[];
  minimumProductionKg: number;
  available: boolean;
  blockedReason: string | null;
  baseDate: string;
  deliveryDate: string;
  productionDate: string | null;
  saleDate: string;
  sex: number;
  sab: number;
  dom: number;
  seg: number;
  ter: number;
  qua: number;
  qui: number;
  total: number;
};
