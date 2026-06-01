import type { ProductPreparationStageKey, ProductionWeekDay } from "@/lib/production-planning";
import type { UnitCode } from "@/lib/factory-planning/units";

export type OrderStatus =
  | "agendado"
  | "em_producao"
  | "em_espera"
  | "aguardando_expedicao"
  | "cancelado"
  | "rota_entrega";
export type ProductionItemStatus =
  | "nao_iniciado"
  | "em_preparacao"
  | "em_producao"
  | "em_forno"
  | "embalando"
  | "concluido";
export type OrderUnit = UnitCode;

export interface StoreProfile {
  id: string;
  code: string;
  name: string;
  orderingDays: ProductionWeekDay[];
  receivingDays: ProductionWeekDay[];
  orderingBlockedDays: ProductionWeekDay[];
  receivingBlockedDays: ProductionWeekDay[];
  receiveWindow: string;
  /** AJ-A8: zona de entrega livre (texto). Quando ausente, a roteirização
   * cai num fallback por janela horária. */
  deliveryZone?: string | null;
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
  saleDate: string;
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
  // AJ-0006.1: lote mínimo de produção do produto (kg) — carregado para a OP
  // consolidar a demanda da fábrica e sinalizar quando ficar abaixo do mínimo.
  minimumProductionKg: number;
  expeditionUnit: OrderUnit;
  expeditionQuantityRaw: number;
  expeditionQuantity: number;
  canPlan: boolean;
  scheduleDayPriority: number | null;
  availableForRelease: boolean;
  releasedToProduction: boolean;
  // Produção iniciada pelo gestor ("Iniciar produção do dia"). Estado separado de
  // releasedToProduction: liberar coloca a OP na coluna do gestor; iniciar é o que
  // a manda para o quadro do Chão (1ª coluna), mantendo o item em `nao_iniciado`.
  productionStarted: boolean;
  // Batidas: capacidade + fator/unidade p/ derivar o plano após consolidar o totalKg.
  capacityPerBatch: number | null;
  salesToKgFactor: number;
  salesUnit: OrderUnit;
  batchesDone: number;
  productionItemKey: string | null;
  productionItemStatus: ProductionItemStatus | null;
  preparationStages: ProductPreparationStageKey[];
  workflowProgress: number;
  opCode: string | null;
  status: OrderStatus;
}

export interface PlannedOrderRow {
  id: string;
  code: string;
  storeId: string;
  storeName: string;
  orderedAt: string;
  orderedAtKey?: string;
  dPlusLabel: string;
  deliveryDate: string;
  deliveryDateLabel: string;
  productionDateLabel: string;
  itemsCount: number;
  totalKg: number;
  opsLabel: string;
  releasedToProduction: boolean;
  availableForRelease: boolean;
  workflowProgress: number;
  status: OrderStatus;
}

export interface ProductionOrderItem {
  productId: string;
  productCode: string;
  productName: string;
  productionItemKey: string;
  totalKg: number;
  // AJ-0006.1: lote mínimo de produção da fábrica e flag de demanda consolidada
  // (soma de todas as lojas neste run) abaixo do mínimo — alerta para o gestor.
  minimumProductionKg: number;
  belowMinimum: boolean;
  productionSequence: number | null;
  progress: number;
  status: ProductionItemStatus;
  // Plano de batidas derivado (planBatches) + progresso.
  batchCount: number;
  batchSizes: number[];
  batchUnitLabel: string;
  batchesDone: number;
  preparationStages: ProductPreparationStageKey[];
  sourceItemsCount: number;
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
  saleDate: string;
  saleDateLabel: string;
  expeditionUnit: OrderUnit;
  expeditionQuantity: number;
  productionItemKey: string;
  productionSequence: number | null;
  releasedToProduction: boolean;
  productionItemStatus: ProductionItemStatus;
  workflowProgress: number;
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
  releasedToProduction: boolean;
  // OP iniciada (≥1 item com produção iniciada). É o filtro de visibilidade do
  // quadro do Chão: liberada mas não iniciada NÃO aparece para o operário.
  productionStarted: boolean;
  progress: number;
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
  saleDate: string;
  workflowProgress: number;
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
  releasedToProduction: boolean;
  workflowProgress: number;
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
