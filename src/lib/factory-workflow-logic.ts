import { buildProductionOrdersFromPlannedItems } from "@/lib/order-planning";
import type {
  FactoryPlanningData,
  OrderStatus,
  PlannedOrderItem,
  PlannedOrderRow,
  ProductionItemStatus,
} from "@/lib/order-planning";
import { getProductionStatusProgress } from "@/lib/production-workflow";
import type { DeliveryExecutionStatus } from "@/lib/delivery-workflow";

// Ordem canônica do fluxo (cancelado fica à parte). O "elo mais fraco" agrega
// uma OP pelo MENOR estágio entre seus pedidos.
const ORDER_STATUS_STAGE: Record<OrderStatus, number> = {
  em_espera: 0,
  agendado: 1,
  em_producao: 2,
  aguardando_expedicao: 3,
  rota_entrega: 4,
  entregue: 5,
  // `cancelado` é tratado à parte (curto-circuito antes da agregação) — nunca
  // entra no cálculo de elo mais fraco; valor só satisfaz a exaustividade do tipo.
  cancelado: -1,
};

// Mapeia o status de execução de entrega (por pedido) → OrderStatus. Uma entrega
// que ainda está em `aguardando_expedicao` (ou ausente) NÃO sobrepõe a produção:
// retorna null para o caller cair de volta no status de produção da OP.
function mapDeliveryStatusToOrderStatus(
  deliveryStatus: DeliveryExecutionStatus | null,
): OrderStatus | null {
  switch (deliveryStatus) {
    case "entregue":
      return "entregue";
    case "pronto_coleta":
    case "em_rota":
    case "no_destino":
    case "tentativa_falha":
      return "rota_entrega";
    case "aguardando_expedicao":
    case null:
    case undefined:
    default:
      return null;
  }
}

function getWorkflowOrderStatus(items: PlannedOrderItem[]): OrderStatus {
  if (items.length === 0) {
    return "em_espera";
  }
  if (items.every((item) => item.status === "cancelado")) {
    return "cancelado";
  }
  if (items.every((item) => item.status === "aguardando_expedicao")) {
    return "aguardando_expedicao";
  }
  if (items.some((item) => item.status === "em_producao")) {
    return "em_producao";
  }
  if (items.some((item) => item.status === "agendado")) {
    return "agendado";
  }
  return "em_espera";
}

function getAverageProgress(items: Array<{ workflowProgress: number }>) {
  if (items.length === 0) {
    return 0;
  }
  return Number((items.reduce((sum, item) => sum + item.workflowProgress, 0) / items.length).toFixed(1));
}

function buildOrderProductionDateLabel(items: PlannedOrderItem[]) {
  const dates = Array.from(
    new Set(items.map((item) => item.productionDate).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b));

  if (dates.length === 0) {
    return "Sem agenda";
  }
  if (dates.length === 1) {
    const [year, month, day] = dates[0].split("-");
    return `${day}/${month}/${year}`;
  }

  const [startYear, startMonth, startDay] = dates[0].split("-");
  const [endYear, endMonth, endDay] = dates[dates.length - 1].split("-");
  return `${startDay}/${startMonth}/${startYear} a ${endDay}/${endMonth}/${endYear}`;
}

function buildOpsLabel(opCodes: string[]) {
  if (opCodes.length === 0) {
    return "-";
  }
  if (opCodes.length === 1) {
    return opCodes[0];
  }
  return `${opCodes[0]} +${opCodes.length - 1}`;
}

interface ItemWorkflowDeps {
  isReleased: (orderId: string) => boolean;
  isCancelled: (orderId: string) => boolean;
  resolveProductionItemStatus: (itemKey: string | null) => ProductionItemStatus | null;
  isProductionStarted: (itemKey: string | null) => boolean;
  resolveBatchesDone: (itemKey: string | null) => number;
}

// Mapeia UM item de planejamento para o estado de workflow (release/status/
// progress/batidas). Extraída do `.map` original para ser reaplicável tanto ao
// conjunto de EXIBIÇÃO (`data.orderItems`, sem MPI) quanto ao conjunto COMPLETO
// de planejamento (`data.productionPlanItems`, COM os itens MPI expandidos), de
// onde as OPs são reconstruídas — assim a OP do MPI sobrevive ao liberar o pedido.
function applyItemWorkflowState(item: PlannedOrderItem, workflow: ItemWorkflowDeps): PlannedOrderItem {
  if (workflow.isCancelled(item.orderId)) {
    return {
      ...item,
      releasedToProduction: false,
      productionStarted: false,
      productionItemStatus: null,
      workflowProgress: 0,
      batchesDone: 0,
      opCode: null,
      status: "cancelado" as OrderStatus,
    };
  }

  if (!item.canPlan) {
    // Item sem plano de produção (sem cronograma ativo / data inviável) está FORA
    // do fluxo: o motor sempre define productionItemKey/productionDate = null e
    // buildProductionOrdersFromPlannedItems filtra `canPlan && productionDate`, logo
    // este item NUNCA gera OP. Zerar release/status mantém a coerência (sem OP =
    // não está produzindo) e evita item "agendado"/liberado preso sem OP no chão.
    // A proteção contra orfanar OPs ao editar receita é o preserveActiveSchedule
    // (master-data-admin) — que mantém o item canPlan —, não este ramo.
    return {
      ...item,
      releasedToProduction: false,
      productionStarted: false,
      productionItemStatus: null,
      workflowProgress: 0,
      batchesDone: 0,
      opCode: null,
      status: "em_espera" as OrderStatus,
    };
  }

  const releasedToProduction = workflow.isReleased(item.orderId);
  if (!releasedToProduction) {
    return {
      ...item,
      releasedToProduction,
      productionStarted: false,
      productionItemStatus: "nao_iniciado" as ProductionItemStatus,
      workflowProgress: 0,
      batchesDone: 0,
      opCode: null,
      status: "em_espera" as OrderStatus,
    };
  }

  const productionItemStatus = workflow.resolveProductionItemStatus(item.productionItemKey) ?? "nao_iniciado";
  const workflowProgress = getProductionStatusProgress(
    productionItemStatus,
    item.preparationStages,
  );
  // Iniciada = marcada explicitamente pelo gestor OU já avançou de `nao_iniciado`
  // (compat: OPs com trabalho em curso continuam visíveis no Chão).
  const productionStarted =
    workflow.isProductionStarted(item.productionItemKey) || productionItemStatus !== "nao_iniciado";
  const status: OrderStatus =
    productionItemStatus === "concluido"
      ? "aguardando_expedicao"
      : workflowProgress > 0
        ? "em_producao"
        : "agendado";

  return {
    ...item,
    releasedToProduction,
    productionStarted,
    productionItemStatus,
    workflowProgress,
    batchesDone: workflow.resolveBatchesDone(item.productionItemKey),
    status,
  };
}

export function applyFactoryWorkflowState(
  data: FactoryPlanningData,
  workflow: {
    isReleased: (orderId: string) => boolean;
    isCancelled: (orderId: string) => boolean;
    resolveProductionItemStatus: (itemKey: string | null) => ProductionItemStatus | null;
    // Opcional: callers que não alimentam o quadro do Chão (auto-release, métricas,
    // testes do motor) podem omitir — `productionStarted` então só é true quando o
    // status já avançou (compat: OPs em andamento nunca somem do Chão).
    isProductionStarted?: (itemKey: string | null) => boolean;
    resolveBatchesDone?: (itemKey: string | null) => number;
    // Opcional: status de execução de entrega por pedido (mesmo espaço de id de
    // `isReleased`). Quando omitido, o status da OP fica só na produção (compat:
    // chamadas de teste/motor/métricas inalteradas).
    resolveDeliveryStatus?: (orderId: string) => DeliveryExecutionStatus | null;
  },
): FactoryPlanningData {
  const itemDeps: ItemWorkflowDeps = {
    isReleased: workflow.isReleased,
    isCancelled: workflow.isCancelled,
    resolveProductionItemStatus: workflow.resolveProductionItemStatus,
    isProductionStarted: workflow.isProductionStarted ?? (() => false),
    resolveBatchesDone: workflow.resolveBatchesDone ?? (() => 0),
  };

  // Lado de EXIBIÇÃO (orders/expedition): conjunto sem MPI — comportamento preservado.
  const orderItems = data.orderItems.map((item) => applyItemWorkflowState(item, itemDeps));

  // FIX MPI — reconstrói as OPs do conjunto COMPLETO de planejamento (que INCLUI
  // os itens MPI expandidos). Sem `productionPlanItems` (fixtures de teste antigas),
  // cai de volta em `orderItems`. Itens MPI herdam orderId/canPlan/productionDate do
  // pai (recipe-expansion), então `isReleased(orderId)` os marca liberados junto.
  const planSourceItems = data.productionPlanItems ?? data.orderItems;
  const planItemsWithState = planSourceItems.map((item) => applyItemWorkflowState(item, itemDeps));
  const releasedItems = planItemsWithState.filter((item) => item.releasedToProduction);
  const { productionOrders: baseProductionOrders, opsByOrderId, opCodeByPlanningKey } =
    buildProductionOrdersFromPlannedItems(releasedItems, data.referenceDate);

  // Status EFETIVO da OP: dobra a ENTREGA por cima do status de produção (que
  // satura em aguardando_expedicao). Agrega por ELO MAIS FRACO entre os pedidos
  // da OP — só sobe pra `entregue` se TODOS entregues; se algum ainda está em
  // produção/aguardando, reporta esse estágio anterior; entrega em andamento
  // (sem todos entregues) reporta rota_entrega. Slots de esqueleto (`skeleton:`)
  // não têm entrega (resolver retorna null) → mantêm o status de produção.
  const resolveDeliveryStatus = workflow.resolveDeliveryStatus;
  const productionOrders = resolveDeliveryStatus
    ? baseProductionOrders.map((op) => {
        if (op.status === "cancelado") {
          return op;
        }
        const orderIds = Array.from(new Set(op.sourceItems.map((sourceItem) => sourceItem.orderId)));
        if (orderIds.length === 0) {
          return op;
        }
        const effective = orderIds.reduce<OrderStatus>((weakest, orderId) => {
          const mapped = mapDeliveryStatusToOrderStatus(resolveDeliveryStatus(orderId));
          // Sem entrega (ou entrega ainda em aguardando) → status de produção da OP.
          const perOrder: OrderStatus = mapped ?? op.status;
          return ORDER_STATUS_STAGE[perOrder] < ORDER_STATUS_STAGE[weakest] ? perOrder : weakest;
        }, "entregue");
        if (effective === op.status) {
          return op;
        }
        // Não mexe em progress — produção continua 100%.
        return { ...op, status: effective };
      })
    : baseProductionOrders;

  // O motor já derivou status/progress por batida (batchesDone vs batchCount) em
  // cada ProductionOrderItem. Indexa por productionItemKey para propagar de volta
  // ao lado do pedido (produtos batidos NÃO escrevem em workflow_production_items).
  const opItemDerived = new Map<string, { status: ProductionItemStatus; progress: number }>();
  for (const op of productionOrders) {
    for (const opItem of op.items) {
      opItemDerived.set(opItem.productionItemKey, { status: opItem.status, progress: opItem.progress });
    }
  }

  const orderItemsWithOpCodes = orderItems.map((item) => {
    const planningKey = item.productionDate
      ? [item.productionDate, item.sectorId, item.lineId, item.scheduleId ?? "sem-linha"].join("|")
      : null;
    const opCode = planningKey ? opCodeByPlanningKey.get(planningKey) ?? null : null;
    // Para itens batidos, o status/progress canônico vem do motor (derivado das
    // batidas), não de workflow_production_items — sobrescreve o lado do pedido.
    const isBatched = item.capacityPerBatch != null && item.capacityPerBatch > 0;
    const derived = isBatched && item.productionItemKey ? opItemDerived.get(item.productionItemKey) : undefined;
    if (derived) {
      return {
        ...item,
        opCode,
        productionItemStatus: derived.status,
        workflowProgress: derived.progress,
        status:
          derived.status === "concluido"
            ? ("aguardando_expedicao" as OrderStatus)
            : derived.progress > 0
              ? ("em_producao" as OrderStatus)
              : ("agendado" as OrderStatus),
      };
    }
    return {
      ...item,
      opCode,
    };
  });

  const itemsByOrderId = orderItemsWithOpCodes.reduce<Map<string, PlannedOrderItem[]>>((acc, item) => {
    if (!acc.has(item.orderId)) {
      acc.set(item.orderId, []);
    }
    acc.get(item.orderId)!.push(item);
    return acc;
  }, new Map());

  const orders = data.orders.map<PlannedOrderRow>((order) => {
    const items = itemsByOrderId.get(order.id) ?? [];
    const opCodes = Array.from(opsByOrderId.get(order.id) ?? []).sort((a, b) => a.localeCompare(b));
    const cancelled = workflow.isCancelled(order.id);

    return {
      ...order,
      // FIX A: deriva do estado AUTORITATIVO de release (DB) por order_id, não só
      // dos itens. Um pedido sem itens plannable (ou vazio) mantinha
      // releasedToProduction=false mesmo com release gravado → estado preso (voltava
      // pra coluna "Aberto", cancelamento bloqueado). `isReleased` mantém a UI coerente
      // com o DB.
      releasedToProduction: cancelled
        ? false
        : workflow.isReleased(order.id) || items.some((item) => item.releasedToProduction),
      availableForRelease: cancelled ? false : items.every((item) => item.availableForRelease) && items.length > 0,
      workflowProgress: cancelled ? 0 : getAverageProgress(items),
      productionDateLabel: buildOrderProductionDateLabel(items),
      opsLabel: buildOpsLabel(opCodes),
      status: cancelled ? "cancelado" : getWorkflowOrderStatus(items),
    };
  });

  const orderById = new Map(orders.map((order) => [order.id, order]));
  const expedition = data.expedition
    .filter((row) => !workflow.isCancelled(row.orderId))
    .map((row) => {
    const order = orderById.get(row.orderId);
    const items = orderItemsWithOpCodes.filter((item) => item.orderId === row.orderId);
    return {
      ...row,
      releasedToProduction: order?.releasedToProduction ?? false,
      workflowProgress: order?.workflowProgress ?? 0,
      status: order?.status ?? "em_espera",
      items: row.items.map((item) => {
        const matching = items.find((candidate) => candidate.id === item.itemId);
        return {
          ...item,
          workflowProgress: matching?.workflowProgress ?? 0,
        };
      }),
    };
    });

  const expeditionItems = expedition.flatMap((row) =>
    row.items.map((item) => ({
      id: `${row.id}-${item.itemId}`,
      expeditionId: row.id,
      orderId: row.orderId,
      orderCode: row.orderCode,
      storeId: row.storeId,
      storeName: row.storeName,
      deliveryDate: row.deliveryDate,
      deliveryDateLabel: row.deliveryDateLabel,
      status: row.status,
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      requestedQuantity: item.requestedQuantity,
      requestedUnit: item.requestedUnit,
      internalKg: item.internalKg,
      expeditionQuantityRaw: item.expeditionQuantityRaw,
      expeditionQuantity: item.expeditionQuantity,
      expeditionUnit: item.expeditionUnit,
    })),
  );

  return {
    ...data,
    orders,
    orderItems: orderItemsWithOpCodes,
    productionOrders,
    expedition,
    expeditionItems,
  };
}
