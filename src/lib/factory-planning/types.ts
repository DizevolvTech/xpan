import type { ProductPreparationStageKey, ProductionWeekDay } from "@/lib/production-planning";
import type { UnitCode } from "@/lib/factory-planning/units";

export type OrderStatus =
  | "agendado"
  | "em_producao"
  | "em_espera"
  | "aguardando_expedicao"
  | "cancelado"
  | "rota_entrega"
  | "entregue";
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
  /**
   * AJ-A10: data de entrega PERSISTIDA do pedido (`delivery_date`). Usada para
   * EXIBIÇÃO de pedidos vazios e como base do filtro operacional. NÃO deve mais
   * ancorar a disponibilidade — ver `committedDeliveryDate`. Opcional para
   * compatibilidade com fixtures de teste.
   */
  deliveryDate?: string | null;
  /**
   * XPAN-2/3: data de entrega COMPROMETIDA — só existe quando a FÁBRICA abriu o
   * pedido para uma data futura (`opened_at` preenchido). É a ÚNICA fonte que
   * ancora a busca regressiva de disponibilidade (AJ-A10). Pedido criado pela
   * loja do zero (`opened_at` nulo) → `null` → cada item entrega em
   * produção + lead do próprio produto (modelo production-driven), evitando que
   * a janela global (D+X) bloqueie/re-agende itens que produzem no seu dia.
   */
  committedDeliveryDate?: string | null;
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
  // FASE 1 (esqueleto do cronograma): origem da demanda do item.
  // - "pedido": item nascido de um StoreOrder (comportamento legado, quantidade real).
  // - "cronograma": slot produto×linha×dia derivado do cronograma ATIVO sem pedido
  //   correspondente — aparece com quantidade/kg 0 para que a produção do dia mostre
  //   o que o cronograma prevê, mesmo sem demanda.
  demandSource: "pedido" | "cronograma";
  // Item derivado da receita (MPI ou ingrediente misturado) — não o produto final do
  // pedido. Ausente/false para itens normais; os builders de expansão marcam `true`.
  isIntermediate?: boolean;
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
  // Produção já em andamento (≥1 item avançou de `nao_iniciado`). NÃO é mais o filtro de
  // visibilidade do Chão (desde 2026-07-24 liberar já manda a OP pro chão — ver
  // isOpOnChaoBoard). Hoje só sinaliza "já começou" para KPIs/rótulos.
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
  // Item INTERMEDIÁRIO (base/insumo): MPI ou ingrediente misturado derivado da receita,
  // não o produto final do pedido. A UI o sinaliza (badge "Base") porque ele é uma etapa
  // ANTERIOR e por isso costuma estar num progresso diferente do produto final.
  isIntermediate: boolean;
  // FASE 2 (blindagem): origem da demanda agregada do item da OP.
  // - "pedido": ao menos um source item nasceu de um StoreOrder (demanda real) OU
  //   o item consolidou kg > 0.
  // - "cronograma": todos os source items são slots de esqueleto (qtd 0) — item
  //   de planejamento, sem demanda. A UI (Fase 3) e a métrica usam isto para
  //   distinguir o que é só previsão do cronograma.
  demandSource: "pedido" | "cronograma";
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
  // Capacidade por batida (>0 = produto BATIDO: status vem das batidas, geridas no
  // Chão; null/0 = não batido, status pelos botões de avançar/voltar). O motor
  // sempre propaga este campo do item de planejamento (ver engine buildProductionOrders).
  capacityPerBatch: number | null;
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
  // FASE 2 (blindagem): existe demanda real (algum item com totalKg > 0). Uma OP
  // cujos itens são todos cronograma/0 é uma "OP de esqueleto" — só visão de
  // planejamento, não desce pro chão nem conta em métrica.
  hasDemand: boolean;
  releasedToProduction: boolean;
  // OP iniciada (≥1 item com produção iniciada). NÃO é mais o filtro do Chão: desde
  // 2026-07-24 toda OP liberada aparece pro operário (isOpOnChaoBoard). Serve p/ KPIs
  // e para saber se o trabalho já começou.
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
  /**
   * FIX MPI — conjunto COMPLETO de itens de planejamento usado pelo motor para
   * montar as OPs: `[...expandedItems, ...skeletonItems]`, ou seja, INCLUI os
   * itens de sub-receita/MPI expandidos (que NÃO aparecem em `orderItems`, voltado
   * à exibição). `applyFactoryWorkflowState` reconstrói as `productionOrders` a
   * partir DESTE conjunto para que a OP do MPI (ex.: massa de pizza) sobreviva ao
   * liberar o pedido. Opcional para compatibilidade com fixtures de teste que
   * montam `FactoryPlanningData` à mão (sem MPI) — nesse caso o caller cai de volta
   * em `orderItems`.
   */
  productionPlanItems?: PlannedOrderItem[];
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
