import type { UnitCode } from "@/lib/factory-planning/units";
import type { OrderStatus } from "@/lib/order-planning";
import type { ProductionWeekDay } from "@/lib/production-planning";

export interface StoreOrderSummary {
  id: string;
  code: string;
  date: string;
  deliveryDate: string;
  status: OrderStatus;
  store: string;
}

export interface StoreOrderDetailItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: UnitCode;
  operationalUnit: UnitCode;
  quantity: number;
}

export interface StoreOrderDetail extends StoreOrderSummary {
  dPlusLabel: string;
  cutoffTime: string;
  receivesSunday: boolean;
  receiveWindow: string;
  note: string;
  items: StoreOrderDetailItem[];
}

export type StoreOrderCatalogProduct = {
  id: string;
  productId: string;
  code: string;
  name: string;
  unit: UnitCode;
  category: string;
  sectorName: string;
  lineName: string;
  lineType: string;
  scheduleName: string;
  productionDays: ProductionWeekDay[];
  available: boolean;
  sex: number;
  sab: number;
  dom: number;
  seg: number;
  ter: number;
  qua: number;
  qui: number;
  total: number;
};
