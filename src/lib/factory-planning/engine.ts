import {
  defaultProductPreparationStages,
  formatDateBr,
  getEnabledOrderingDays,
  getEnabledReceivingDays,
  type OperationalSettings,
  type ProductionIngredient,
  type ProductionLine,
  type ProductionProduct,
  type ProductionSector,
  type ProductionWeekDay,
  type WeeklyProductionSchedule,
  type WeeklyScheduleItem,
} from "@/lib/production-planning";
import type {
  ExpeditionItem,
  ExpeditionRow,
  ExpeditionSeparationRow,
  FactoryPlanningData,
  OrderStatus,
  PlannedOrderItem,
  PlannedOrderRow,
  ProductionItemStatus,
  ProductionOrderItem,
  ProductionOrderRow,
  ProductionOrderSourceItem,
  StoreOrder,
  StoreProfile,
} from "@/lib/factory-planning/types";
import { getScheduleItemDayPriority } from "@/lib/production-data-utils";
import { planBatches, deriveBatchStatus } from "@/lib/production-batches";
import { round2, roundQuantityForUnit } from "@/lib/factory-planning/units";
import { getProductionStatusProgress, normalizeProductPreparationStages } from "@/lib/production-workflow";
import { expandRecipeIntoItems } from "@/lib/factory-planning/recipe-expansion";

export interface FactoryPlanningInput {
  stores: StoreProfile[];
  storeOrders: StoreOrder[];
  settings: OperationalSettings;
  sectors: ProductionSector[];
  lines: ProductionLine[];
  products: ProductionProduct[];
  schedules: WeeklyProductionSchedule[];
  /**
   * Opcional. Consumido apenas pela expansão MPI (atrás da flag
   * EXPAND_MPI_INTO_OPS) para escalar receitas com ingredientes em
   * unidades não-Kg. Pode ficar undefined em call sites legados sem
   * regressão — `getRecipeReferenceWeightKgFromData` faz fallback.
   */
  ingredients?: ProductionIngredient[];
  /**
   * XPAN #6: receita CONGELADA na liberação por `orderId → productId → receita`. A expansão
   * MPI usa a receita do snapshot para pedidos liberados, para que editar a receita não
   * mude OPs já liberadas. Opcional — undefined ⇒ tudo usa a receita ao vivo (comportamento
   * anterior). Ver `getReleasedRecipeSnapshots`.
   */
  releasedRecipeByOrderProduct?: Map<string, Map<string, ProductionProduct["recipe"]>>;
}

export interface ResolvedPlanningSource {
  settings: OperationalSettings;
  sectorsById: Map<string, ProductionSector>;
  linesById: Map<string, ProductionLine>;
  productsById: Map<string, ProductionProduct>;
  products: ProductionProduct[];
  ingredients: ProductionIngredient[];
  schedules: WeeklyProductionSchedule[];
  releasedRecipeByOrderProduct?: Map<string, Map<string, ProductionProduct["recipe"]>>;
}

const weekdayByIndex: ProductionWeekDay[] = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
];

export const productionStageProgress: Record<ProductionItemStatus, number> = {
  nao_iniciado: 0,
  em_preparacao: getProductionStatusProgress("em_preparacao", defaultProductPreparationStages),
  em_producao: getProductionStatusProgress("em_producao", defaultProductPreparationStages),
  em_forno: getProductionStatusProgress("em_forno", defaultProductPreparationStages),
  embalando: getProductionStatusProgress("embalando", defaultProductPreparationStages),
  concluido: 100,
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(dateKey: string, days: number): string {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function compareDateKeys(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function getWeekDayKey(dateKey: string): ProductionWeekDay {
  const date = fromDateKey(dateKey);
  return weekdayByIndex[date.getDay()];
}

/**
 * Fuso operacional da fábrica. Fixo de propósito: a Vercel roda o processo em UTC, então
 * `getHours()`/`toISOString().slice(0,10)` adiantam o "hoje" em 3h (e um dia inteiro à noite).
 * Ver `getOperationalTodayKey` em `workflow-date-guard.ts`, que segue o mesmo critério.
 */
const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";

const operationalPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OPERATIONAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Data (YYYY-MM-DD) e hora local de um instante, no fuso operacional. */
function getOperationalDateParts(date: Date): { dateKey: string; hour: number; minute: number } {
  const parts = operationalPartsFormatter.formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    dateKey: `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`,
    hour: Number(valueOf("hour")),
    minute: Number(valueOf("minute")),
  };
}

export function getTodayDateKey(): string {
  return getOperationalDateParts(new Date()).dateKey;
}

export function formatDateKeyBr(dateKey: string) {
  return formatDateBr(dateKey);
}

function formatDateTimeBr(dateTimeIso: string): string {
  const date = new Date(dateTimeIso);
  return `${new Intl.DateTimeFormat("pt-BR").format(date)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Data-base do pedido a partir do instante em que ele foi feito e do horário de corte.
 *
 * O corte é lido no FUSO OPERACIONAL, não no fuso do processo: `orderedAt` chega como
 * instante UTC (`toISOString()` do browser ou `ordered_at` do banco) e o servidor roda em
 * UTC, então comparar `getHours()` fazia o corte das 18:00 disparar às 15:00 em Brasília
 * e virava o dia perto da meia-noite.
 */
export function getBaseDateByCutoff(orderedAt: string, cutoffTime: string): string {
  const { dateKey, hour, minute } = getOperationalDateParts(new Date(orderedAt));
  const [cutoffHour, cutoffMinute] = cutoffTime.split(":").map((part) => Number(part));

  const afterCutoff = hour > cutoffHour || (hour === cutoffHour && minute > cutoffMinute);

  return afterCutoff ? addDays(dateKey, 1) : dateKey;
}

export function moveToNextAllowedWeekday(dateKey: string, allowedDays: ProductionWeekDay[]): string {
  if (allowedDays.length === 0) {
    return dateKey;
  }

  let cursor = dateKey;
  for (let i = 0; i < 7; i += 1) {
    if (allowedDays.includes(getWeekDayKey(cursor))) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }

  return dateKey;
}

export function getDeliveryDateByStoreRule(
  baseDate: string,
  store: StoreProfile,
  settings: OperationalSettings,
): string {
  const calculatedDate = addDays(baseDate, settings.expeditionLeadDays);
  return moveToNextAllowedWeekday(calculatedDate, getEnabledReceivingDays(store));
}

export function getOperationalBaseDateByStoreRule(
  orderedAt: string,
  store: Pick<StoreProfile, "orderingDays" | "orderingBlockedDays">,
  settings: Pick<OperationalSettings, "orderCutoffTime">,
): string {
  const baseDate = getBaseDateByCutoff(orderedAt, settings.orderCutoffTime);
  return moveToNextAllowedWeekday(baseDate, getEnabledOrderingDays(store));
}

export function getOperationalOrderWindow(
  orderedAt: string,
  store: StoreProfile,
  settings: OperationalSettings,
) {
  const baseDate = getOperationalBaseDateByStoreRule(orderedAt, store, settings);
  const deliveryDate = getDeliveryDateByStoreRule(baseDate, store, settings);

  return { baseDate, deliveryDate };
}

export interface OperationalAvailabilityResult {
  baseDate: string;
  deliveryDate: string;
  deliveryWeekDay: ProductionWeekDay;
  productionDate: string | null;
  available: boolean;
  delayed: boolean;
  blockedReason: string | null;
  matchingDays: ProductionWeekDay[];
  scheduleItemId: string | null;
}

export function normalizeSaleLeadDays(saleLeadDays: number | undefined) {
  const n = Number(saleLeadDays);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function getMatchingProductionDays(
  productDays: ProductionWeekDay[],
  scheduleItemDays: ProductionWeekDay[] | null,
) {
  const uniqueProductDays = Array.from(new Set(productDays));
  const uniqueScheduleDays = scheduleItemDays ? Array.from(new Set(scheduleItemDays)) : null;

  if (!uniqueScheduleDays) {
    return uniqueProductDays;
  }

  return uniqueProductDays.filter((day) => uniqueScheduleDays.includes(day));
}

export function resolveScheduledProductAvailability(
  orderedAt: string,
  store: StoreProfile,
  settings: OperationalSettings,
  options: {
    productProductionDays: ProductionWeekDay[];
    productExpeditionLeadDays: number;
    scheduleItem?: Pick<WeeklyScheduleItem, "id" | "productionDays"> | null;
    /**
     * AJ-A10: data de entrega COMPROMETIDA (X) quando a loja PREENCHE um pedido que
     * a fábrica abriu para uma data futura. Quando informada, o planejamento ancora
     * em X (entrega = X; busca a data de produção que entrega em X) em vez de na
     * "próxima janela operacional" derivada de `orderedAt`. Ausente/null →
     * comportamento IDÊNTICO ao legado (entrega = janela operacional de orderedAt).
     */
    targetDeliveryDate?: string | null;
  },
): OperationalAvailabilityResult {
  const window = getOperationalOrderWindow(orderedAt, store, settings);
  const baseDate = window.baseDate;
  const receivingDays = getEnabledReceivingDays(store);
  const productGap = options.productExpeditionLeadDays;

  // AJ-A10 — ANCORAGEM: pedido aberto pela fábrica para uma entrega futura
  // comprometida (X). Entrega = X; produção = busca REGRESSIVA (dia da ficha tal
  // que produção + gap = X). Preserva o contrato do modelo "fábrica abre pedido".
  if (options.targetDeliveryDate) {
    const deliveryDate = options.targetDeliveryDate;
    const deliveryWeekDay = getWeekDayKey(deliveryDate);

    if (!options.scheduleItem) {
      return {
        baseDate, deliveryDate, deliveryWeekDay, productionDate: null, available: false, delayed: false,
        blockedReason: "Produto fora da linha de produção ativa.", matchingDays: [], scheduleItemId: null,
      };
    }
    const matchingDays = getMatchingProductionDays(options.productProductionDays, options.scheduleItem.productionDays);
    if (matchingDays.length === 0) {
      return {
        baseDate, deliveryDate, deliveryWeekDay, productionDate: null, available: false, delayed: false,
        blockedReason: "Dias da ficha do produto não coincidem com a linha de produção ativa.",
        matchingDays, scheduleItemId: options.scheduleItem.id,
      };
    }
    const searchFloor = addDays(deliveryDate, -(productGap + 7));
    const productionWindow = resolveProductionDateInWindow(searchFloor, deliveryDate, matchingDays, productGap, receivingDays);
    if (!productionWindow.date) {
      return {
        baseDate, deliveryDate, deliveryWeekDay, productionDate: null, available: false, delayed: productionWindow.delayed,
        blockedReason: `Sem data de produção compatível: o produto exige ${productGap} dia(s) entre produção e entrega, mas nenhum dia da ficha resulta em entrega ${formatDateKeyBr(deliveryDate)}.`,
        matchingDays, scheduleItemId: options.scheduleItem.id,
      };
    }
    if (productionWindow.delayed) {
      // AJ-0024 (âncora): a busca regressiva não acha dia que entregue em X; a próxima
      // produção cai DEPOIS de X. Não agendamos +7 — bloqueamos com motivo acionável.
      const soonestProduction = productionWindow.date ? formatDateKeyBr(productionWindow.date) : "depois do horizonte de planejamento";
      return {
        baseDate, deliveryDate, deliveryWeekDay, productionDate: null, available: false, delayed: true,
        blockedReason: `Esta variante só produz em dias que não entregam ${formatDateKeyBr(deliveryDate)} com ${productGap} dia(s) de lead — a próxima produção possível seria ${soonestProduction}, após a entrega. Escolha a variante que produz no dia compatível.`,
        matchingDays, scheduleItemId: options.scheduleItem.id,
      };
    }
    return {
      baseDate, deliveryDate, deliveryWeekDay, productionDate: productionWindow.date, available: true, delayed: false,
      blockedReason: null, matchingDays, scheduleItemId: options.scheduleItem.id,
    };
  }

  // XPAN-2/3 — MODELO PRODUCTION-DRIVEN: o dia de produção do produto (≥ baseDate)
  // é a fonte de verdade. deliveryDate = produção + gap do produto (ajustado aos dias
  // de recebimento da loja). O parâmetro global (D+X) deixa de agendar a entrega —
  // passa a ser só a "janela" do pedido (escopo operacional / display). Assim o
  // produto produz no SEU dia e entrega produção+gap, mesmo que isso difira do D+X
  // global. Cobre também o caso "mesmo dia" (gap 0): produção = entrega.
  if (!options.scheduleItem) {
    const fallbackDelivery = window.deliveryDate;
    return {
      baseDate, deliveryDate: fallbackDelivery, deliveryWeekDay: getWeekDayKey(fallbackDelivery),
      productionDate: null, available: false, delayed: false,
      blockedReason: "Produto fora da linha de produção ativa.", matchingDays: [], scheduleItemId: null,
    };
  }

  const matchingDays = getMatchingProductionDays(options.productProductionDays, options.scheduleItem.productionDays);
  if (matchingDays.length === 0) {
    const fallbackDelivery = window.deliveryDate;
    return {
      baseDate, deliveryDate: fallbackDelivery, deliveryWeekDay: getWeekDayKey(fallbackDelivery),
      productionDate: null, available: false, delayed: false,
      blockedReason: "Dias da ficha do produto não coincidem com a linha de produção ativa.",
      matchingDays, scheduleItemId: options.scheduleItem.id,
    };
  }

  // Production-driven: primeiro dia de produção compatível em [baseDate, baseDate+14).
  let cursor = baseDate;
  let productionDate: string | null = null;
  for (let offset = 0; offset < 14; offset += 1) {
    if (matchingDays.includes(getWeekDayKey(cursor))) {
      productionDate = cursor;
      break;
    }
    cursor = addDays(cursor, 1);
  }

  if (!productionDate) {
    const fallbackDelivery = window.deliveryDate;
    return {
      baseDate, deliveryDate: fallbackDelivery, deliveryWeekDay: getWeekDayKey(fallbackDelivery),
      productionDate: null, available: false, delayed: true,
      blockedReason: `Produto sem dia de produção compatível nos próximos 14 dias a partir de ${formatDateKeyBr(baseDate)}. Verifique os dias de produção do cadastro e do cronograma.`,
      matchingDays, scheduleItemId: options.scheduleItem.id,
    };
  }

  const deliveryDate = moveToNextAllowedWeekday(addDays(productionDate, productGap), receivingDays);
  return {
    baseDate, deliveryDate, deliveryWeekDay: getWeekDayKey(deliveryDate), productionDate,
    available: true, delayed: false, blockedReason: null, matchingDays, scheduleItemId: options.scheduleItem.id,
  };
}

export function getOperationalTimeline(
  orderedAt: string,
  store: StoreProfile,
  settings: OperationalSettings,
  productionDays: ProductionWeekDay[],
  saleLeadDays = 0,
  productExpeditionLeadDays = 1,
  targetDeliveryDate?: string | null,
) {
  const availability = resolveScheduledProductAvailability(orderedAt, store, settings, {
    productProductionDays: productionDays,
    productExpeditionLeadDays,
    scheduleItem: {
      id: "virtual-schedule-item",
      productionDays,
    },
    targetDeliveryDate,
  });

  return {
    baseDate: availability.baseDate,
    deliveryDate: availability.deliveryDate,
    saleDate: addDays(availability.deliveryDate, normalizeSaleLeadDays(saleLeadDays)),
    productionDate: availability.productionDate,
    delayed: availability.delayed,
  };
}

export function resolveProductionDateInWindow(
  baseDate: string,
  deliveryDate: string,
  productionDays: ProductionWeekDay[],
  productExpeditionLeadDays: number,
  receivingDays: ProductionWeekDay[],
) {
  if (productionDays.length === 0) {
    return { date: null as string | null, delayed: false };
  }

  // Busca regressiva: dia de produção tal que produção + gap (após ajuste de domingo) = entrega
  let cursor = deliveryDate;
  while (compareDateKeys(cursor, baseDate) >= 0) {
    if (productionDays.includes(getWeekDayKey(cursor))) {
      const candidateDelivery = receivingDays.length > 0
        ? moveToNextAllowedWeekday(addDays(cursor, productExpeditionLeadDays), receivingDays)
        : addDays(cursor, productExpeditionLeadDays);
      if (candidateDelivery === deliveryDate) {
        return { date: cursor, delayed: false };
      }
    }
    cursor = addDays(cursor, -1);
  }

  // Não encontrou — busca delayed no futuro até 14 dias
  let futureCursor = addDays(deliveryDate, 1);
  for (let i = 0; i < 14; i += 1) {
    if (productionDays.includes(getWeekDayKey(futureCursor))) {
      return { date: futureCursor, delayed: true };
    }
    futureCursor = addDays(futureCursor, 1);
  }

  return { date: null as string | null, delayed: true };
}

function sanitizeFactor(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function buildActiveScheduleByLine(schedules: WeeklyProductionSchedule[]): Map<string, WeeklyProductionSchedule> {
  const map = new Map<string, WeeklyProductionSchedule>();

  // Defensivo: se houver mais de um cronograma ativo por linha (não deveria, mas pode em race conditions),
  // pega sempre o mais recente — mesmo critério de `buildLatestScheduleByLineId` em store-order-catalog.
  schedules
    .filter((schedule) => schedule.status === "ativo")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach((schedule) => {
      if (!map.has(schedule.lineId)) {
        map.set(schedule.lineId, schedule);
      }
    });

  return map;
}

/**
 * Feature flag para expansão automática de MPI em OPs separadas (AJ-0008).
 *
 * **Default: ON** desde 2026-05-20 — comportamento que o cliente Daniel pediu
 * na Call 2026-05-13 (Bloco 4). Para desligar em emergência sem novo deploy,
 * defina `EXPAND_MPI_INTO_OPS=false` no ambiente (escape hatch).
 *
 * Ver Docs/decisoes/ADR_expansao_mpi_em_op.md.
 */
function isMpiExpansionEnabled() {
  return process.env.EXPAND_MPI_INTO_OPS !== "false";
}

/**
 * Feature flag para expansão de ingrediente `misturado` puro em OP separada (AJ-0008.1,
 * Fase 3). **Default: ON** — decisão do Giuseppe (2026-05-30) estendendo o ADR original.
 * Escape hatch: `EXPAND_MIXED_INGREDIENT_INTO_OPS=false`. Só tem efeito com a expansão de
 * receita ligada (`isMpiExpansionEnabled`).
 */
function isMixedIngredientExpansionEnabled() {
  return process.env.EXPAND_MIXED_INGREDIENT_INTO_OPS !== "false";
}

export function resolvePlanningSource(input: FactoryPlanningInput): ResolvedPlanningSource {
  return {
    settings: input.settings,
    sectorsById: new Map(input.sectors.map((sector) => [sector.id, sector])),
    linesById: new Map(input.lines.map((line) => [line.id, line])),
    productsById: new Map(input.products.map((product) => [product.id, product])),
    products: input.products,
    ingredients: input.ingredients ?? [],
    schedules: input.schedules,
    releasedRecipeByOrderProduct: input.releasedRecipeByOrderProduct,
  };
}

function getPotentialItemStatus(productionDate: string | null, canPlan: boolean, referenceDate: string): OrderStatus {
  if (!canPlan || !productionDate) {
    return "em_espera";
  }
  if (productionDate === referenceDate) {
    return "em_producao";
  }
  return compareDateKeys(productionDate, referenceDate) > 0 ? "agendado" : "em_espera";
}

function getProductionItemKey(item: Pick<PlannedOrderItem, "productionDate" | "lineId" | "productId">) {
  if (!item.productionDate) {
    return null;
  }
  // Chave CANÔNICA e ESTÁVEL (3 partes — SEM scheduleId). O scheduleId mudava a
  // cada revisão de cronograma e órfã o status persistido, fazendo a OP
  // reaparecer como `nao_iniciado`. Status gravados sob a chave antiga (4 partes)
  // são recuperados na leitura via `canonicalProductionItemKey` (workflow.ts).
  return [item.productionDate, item.lineId, item.productId].join("|");
}

function getPlanningKey(item: Pick<PlannedOrderItem, "productionDate" | "sectorId" | "lineId" | "scheduleId">) {
  if (!item.productionDate) {
    return null;
  }
  return [item.productionDate, item.sectorId, item.lineId, item.scheduleId ?? "sem-linha"].join("|");
}

function sortOrderItems(items: PlannedOrderItem[]) {
  return [...items].sort((a, b) => {
    const byDelivery = compareDateKeys(a.deliveryDate, b.deliveryDate);
    if (byDelivery !== 0) {
      return byDelivery;
    }
    const byOrder = a.orderCode.localeCompare(b.orderCode);
    if (byOrder !== 0) {
      return byOrder;
    }
    return a.productCode.localeCompare(b.productCode);
  });
}

function groupOrderItemsByOrderId(items: PlannedOrderItem[]) {
  const map = new Map<string, PlannedOrderItem[]>();

  items.forEach((item) => {
    if (!map.has(item.orderId)) {
      map.set(item.orderId, []);
    }
    map.get(item.orderId)!.push(item);
  });

  return map;
}

function buildOrderProductionDateLabel(items: PlannedOrderItem[]): string {
  const dates = Array.from(
    new Set(items.map((item) => item.productionDate).filter((value): value is string => Boolean(value))),
  ).sort(compareDateKeys);

  if (dates.length === 0) {
    return "Sem agenda";
  }
  if (dates.length === 1) {
    return formatDateBr(dates[0]);
  }
  return `${formatDateBr(dates[0])} a ${formatDateBr(dates[dates.length - 1])}`;
}

function buildOrderOpsLabel(opCodes: string[]) {
  if (opCodes.length === 0) {
    return "-";
  }
  if (opCodes.length === 1) {
    return opCodes[0];
  }
  return `${opCodes[0]} +${opCodes.length - 1}`;
}

function getOrderStatusFromItems(items: PlannedOrderItem[]): OrderStatus {
  if (items.length === 0) {
    return "em_espera";
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

function getLatestDate(items: Array<{ deliveryDate: string }>, fallbackDate: string) {
  return items.reduce(
    (latest, item) => (compareDateKeys(item.deliveryDate, latest) > 0 ? item.deliveryDate : latest),
    fallbackDate,
  );
}

function buildPlannedItems(
  input: {
    storeOrders: StoreOrder[];
    storeById: Map<string, StoreProfile>;
    scheduleByLineId: Map<string, WeeklyProductionSchedule>;
    source: ResolvedPlanningSource;
  },
  referenceDate: string,
): PlannedOrderItem[] {
  const items = input.storeOrders
    .flatMap((order) => {
      const store = input.storeById.get(order.storeId);
      if (!store) {
        return [];
      }

      return order.items.flatMap<PlannedOrderItem>((orderItem) => {
        const product = input.source.productsById.get(orderItem.productId);
        const line = product?.operationalLineId
          ? input.source.linesById.get(product.operationalLineId)
          : undefined;
        const sector = line ? input.source.sectorsById.get(line.sectorId) : undefined;
        const schedule = line ? input.scheduleByLineId.get(line.id) : undefined;
        const scheduleItem = schedule?.items.find((item) => item.productId === product?.id) ?? null;

        if (!product || !line || !sector) {
          return [];
        }

        const availability = resolveScheduledProductAvailability(
          order.orderedAt,
          store,
          input.source.settings,
          {
            productProductionDays: product.productionDays,
            productExpeditionLeadDays: product.expeditionLeadDays,
            scheduleItem,
            // XPAN-2/3: ancora SÓ quando a fábrica comprometeu a entrega (pedido aberto
            // p/ data futura → `committedDeliveryDate`). Pedido criado pela loja (sem
            // committed, mesmo com `deliveryDate` persistida = janela global) → null →
            // caminho production-driven: cada item entrega em produção + lead próprio.
            // Sem esse gate, a data global re-ancorava e bloqueava itens já aceitos pela
            // loja, travando a liberação do pedido (regressão F1).
            targetDeliveryDate: order.committedDeliveryDate ?? null,
          },
        );
        const salesFactor = sanitizeFactor(product.salesToKgFactor);
        const expeditionFactor = sanitizeFactor(product.expeditionToKgFactor);
        const internalKg = round2(orderItem.quantity * salesFactor);
        const expeditionQuantityRaw =
          product.expeditionUnit === "Kg" ? internalKg : round2(internalKg / expeditionFactor);
        const expeditionQuantity =
          product.expeditionUnit === "Kg"
            ? round2(internalKg)
            : roundQuantityForUnit(expeditionQuantityRaw, product.expeditionUnit);

        const canPlan = Boolean(schedule && availability.available && availability.productionDate);
        const scheduleDayPriority =
          canPlan && scheduleItem && availability.productionDate
            ? getScheduleItemDayPriority(scheduleItem, getWeekDayKey(availability.productionDate))
            : null;
        const productionItemKey = canPlan
          ? getProductionItemKey({
              productionDate: availability.productionDate,
              lineId: line.id,
              productId: product.id,
            })
          : null;

        return [
          {
          id: orderItem.id,
          orderId: order.id,
          orderCode: order.code,
          storeId: store.id,
          storeName: store.name,
          orderedAt: formatDateTimeBr(order.orderedAt),
          baseDate: availability.baseDate,
          deliveryDate: availability.deliveryDate,
          saleDate: addDays(availability.deliveryDate, normalizeSaleLeadDays(input.source.settings.saleLeadDays)),
          productionDate: availability.productionDate,
          delayed: availability.delayed,
          demandSource: "pedido",
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          lineId: line.id,
          lineName: line.name,
          sectorId: sector.id,
          sectorName: sector.name,
          scheduleId: schedule?.id ?? null,
          scheduleCode: schedule?.code ?? null,
          scheduleName: schedule?.name ?? null,
          requestedQuantity: orderItem.quantity,
          requestedUnit: orderItem.unit,
          internalKg,
          minimumProductionKg: product.minimumProductionKg,
          expeditionUnit: product.expeditionUnit,
          expeditionQuantityRaw,
          expeditionQuantity,
          canPlan,
          scheduleDayPriority,
          availableForRelease: canPlan,
          releasedToProduction: false,
          productionStarted: false,
          capacityPerBatch: product.capacityPerBatch,
          salesToKgFactor: product.salesToKgFactor,
          salesUnit: product.salesUnit,
          batchesDone: 0,
          productionItemKey,
          productionItemStatus: canPlan ? "nao_iniciado" : null,
          preparationStages: normalizeProductPreparationStages(product.preparationStages),
          workflowProgress: 0,
          opCode: null,
          status: getPotentialItemStatus(availability.productionDate, canPlan, referenceDate),
          } satisfies PlannedOrderItem,
        ];
      });
    })

  return sortOrderItems(items);
}

/**
 * FASE 1 — horizonte de enumeração do esqueleto do cronograma.
 *
 * 7 dias = um ciclo semanal completo: cada dia de produção da semana aparece
 * exatamente uma vez a partir de `referenceDate`. Isto NÃO é o lead de produção
 * (esse vem da config — `OperationalSettings.expeditionLeadDays` — e do
 * `expeditionLeadDays` do produto, aplicados pela disponibilidade do pedido). É
 * só a janela de varredura para materializar os slots produto×linha×dia.
 */
export const SCHEDULE_SKELETON_HORIZON_DAYS = 7;

/**
 * FASE 1 — esqueleto do cronograma.
 *
 * Materializa, a partir do CRONOGRAMA ATIVO por linha, os slots produto×linha×dia
 * MESMO SEM PEDIDO, como `PlannedOrderItem` ESQUELETO (quantidade/kg 0,
 * `demandSource: "cronograma"`). Aditivo: não toca nos itens de pedido. O caller
 * (`buildFactoryPlanningData`) filtra esses slots contra as chaves canônicas dos
 * itens reais para preencher só LACUNAS (produto/dia sem pedido).
 *
 * Para cada linha com cronograma ativo, para cada `scheduleItem` (produto), resolve
 * product/line/sector (mesmos lookups de `buildPlannedItems`) e, com a interseção de
 * dias produto×cronograma (`getMatchingProductionDays`), enumera as datas no horizonte
 * `[referenceDate, referenceDate + SCHEDULE_SKELETON_HORIZON_DAYS)` cujo dia-da-semana
 * pertence à interseção.
 */
export function buildScheduleSkeletonItems(
  input: {
    scheduleByLineId: Map<string, WeeklyProductionSchedule>;
    source: ResolvedPlanningSource;
  },
  referenceDate: string,
  horizonDays: number = SCHEDULE_SKELETON_HORIZON_DAYS,
): PlannedOrderItem[] {
  const items: PlannedOrderItem[] = [];

  for (const schedule of input.scheduleByLineId.values()) {
    const line = input.source.linesById.get(schedule.lineId);
    const sector = line ? input.source.sectorsById.get(line.sectorId) : undefined;
    if (!line || !sector) {
      continue;
    }

    for (const scheduleItem of schedule.items) {
      const product = input.source.productsById.get(scheduleItem.productId);
      if (!product) {
        continue;
      }

      const matchingDays = getMatchingProductionDays(product.productionDays, scheduleItem.productionDays);
      if (matchingDays.length === 0) {
        continue;
      }
      const matchingDaySet = new Set(matchingDays);

      for (let offset = 0; offset < horizonDays; offset += 1) {
        const productionDate = addDays(referenceDate, offset);
        if (!matchingDaySet.has(getWeekDayKey(productionDate))) {
          continue;
        }

        const canPlan = true;
        const scheduleDayPriority = getScheduleItemDayPriority(scheduleItem, getWeekDayKey(productionDate));
        const productionItemKey = getProductionItemKey({
          productionDate,
          lineId: line.id,
          productId: product.id,
        });

        items.push({
          // Id estável e distinto do espaço de ids de pedido (que usa o id do item do pedido).
          id: `skeleton:${productionItemKey}`,
          orderId: `skeleton:${schedule.id}`,
          orderCode: "—",
          storeId: "",
          storeName: "Cronograma",
          orderedAt: "",
          baseDate: productionDate,
          deliveryDate: productionDate,
          saleDate: productionDate,
          productionDate,
          delayed: false,
          demandSource: "cronograma",
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          lineId: line.id,
          lineName: line.name,
          sectorId: sector.id,
          sectorName: sector.name,
          scheduleId: schedule.id,
          scheduleCode: schedule.code,
          scheduleName: schedule.name,
          requestedQuantity: 0,
          requestedUnit: product.salesUnit,
          internalKg: 0,
          minimumProductionKg: product.minimumProductionKg,
          expeditionUnit: product.expeditionUnit,
          expeditionQuantityRaw: 0,
          expeditionQuantity: 0,
          canPlan,
          scheduleDayPriority,
          // FASE 2 (blindagem): um slot do cronograma sem pedido (qtd 0) não tem
          // o que liberar — é só visão de planejamento. NUNCA liberável.
          availableForRelease: false,
          releasedToProduction: false,
          productionStarted: false,
          capacityPerBatch: product.capacityPerBatch,
          salesToKgFactor: product.salesToKgFactor,
          salesUnit: product.salesUnit,
          batchesDone: 0,
          productionItemKey,
          productionItemStatus: "nao_iniciado",
          preparationStages: normalizeProductPreparationStages(product.preparationStages),
          workflowProgress: 0,
          opCode: null,
          status: getPotentialItemStatus(productionDate, canPlan, referenceDate),
        } satisfies PlannedOrderItem);
      }
    }
  }

  return items;
}

export function buildProductionOrdersFromPlannedItems(
  plannedItems: PlannedOrderItem[],
  referenceDate: string,
): {
  productionOrders: ProductionOrderRow[];
  opsByOrderId: Map<string, Set<string>>;
  opCodeByPlanningKey: Map<string, string>;
} {
  const opGroupMap = new Map<
    string,
    {
      planningKey: string;
      productionDate: string;
      sectorId: string;
      sectorName: string;
      lineId: string;
      lineName: string;
      scheduleId: string;
      scheduleCode: string;
      scheduleName: string;
      orderCodes: Set<string>;
      orderIds: Set<string>;
      items: Map<
        string,
        ProductionOrderItem & {
          capacityPerBatch: number | null;
          salesToKgFactor: number;
          // FASE 2: ao menos um source item deste produto nasceu de pedido real.
          hasPedidoSource: boolean;
        }
      >;
      sourceItems: ProductionOrderSourceItem[];
      totalKg: number;
      releasedToProduction: boolean;
      productionStarted: boolean;
    }
  >();

  plannedItems
    .filter((item) => item.canPlan && item.productionDate)
    .forEach((item) => {
      const planningKey = getPlanningKey(item);
      if (!planningKey) {
        return;
      }

      if (!opGroupMap.has(planningKey)) {
        opGroupMap.set(planningKey, {
          planningKey,
          productionDate: item.productionDate!,
          sectorId: item.sectorId,
          sectorName: item.sectorName,
          lineId: item.lineId,
          lineName: item.lineName,
          scheduleId: item.scheduleId ?? "sem-linha",
          scheduleCode: item.scheduleCode ?? "-",
          scheduleName: item.scheduleName ?? "Sem linha",
          orderCodes: new Set<string>(),
          orderIds: new Set<string>(),
          items: new Map<
            string,
            ProductionOrderItem & {
              capacityPerBatch: number | null;
              salesToKgFactor: number;
              hasPedidoSource: boolean;
            }
          >(),
          sourceItems: [],
          totalKg: 0,
          releasedToProduction: false,
          productionStarted: false,
        });
      }

      const group = opGroupMap.get(planningKey)!;
      group.orderCodes.add(item.orderCode);
      group.orderIds.add(item.orderId);
      group.totalKg = round2(group.totalKg + item.internalKg);
      group.releasedToProduction = group.releasedToProduction || item.releasedToProduction;
      group.productionStarted = group.productionStarted || item.productionStarted;

      if (!group.items.has(item.productId)) {
        group.items.set(item.productId, {
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          productionItemKey: item.productionItemKey ?? `${planningKey}|${item.productId}`,
          // Todos os source items de um mesmo productId compartilham a natureza (o MPI/
          // misturado tem productId próprio), então o 1º define se é intermediário.
          isIntermediate: item.isIntermediate ?? false,
          // Placeholder; resolvido após agregar todos os source items (ver
          // hasPedidoSource + totalKg abaixo).
          demandSource: "cronograma",
          hasPedidoSource: false,
          totalKg: 0,
          // AJ-0006.1: mínimo da fábrica; belowMinimum é recomputado após somar a
          // demanda consolidada de todas as lojas deste run de produção.
          minimumProductionKg: item.minimumProductionKg,
          belowMinimum: false,
          productionSequence: item.scheduleDayPriority,
          progress: item.workflowProgress,
          status: item.productionItemStatus ?? "nao_iniciado",
          preparationStages: item.preparationStages,
          sourceItemsCount: 0,
          batchCount: 1,
          batchSizes: [],
          batchUnitLabel: item.salesUnit,
          batchesDone: item.batchesDone,
          capacityPerBatch: item.capacityPerBatch,
          salesToKgFactor: item.salesToKgFactor,
        });
      }

      const aggregated = group.items.get(item.productId)!;
      aggregated.totalKg = round2(aggregated.totalKg + item.internalKg);
      // FASE 2: marca demanda real assim que QUALQUER source item for "pedido"
      // ou trouxer kg. demandSource final é derivado disto abaixo.
      aggregated.hasPedidoSource =
        aggregated.hasPedidoSource || item.demandSource === "pedido" || item.internalKg > 0;
      aggregated.productionSequence = aggregated.productionSequence ?? item.scheduleDayPriority;
      aggregated.progress = Math.max(aggregated.progress, item.workflowProgress);
      aggregated.status =
        aggregated.progress > item.workflowProgress ? aggregated.status : item.productionItemStatus ?? aggregated.status;
      aggregated.sourceItemsCount += 1;

      group.sourceItems.push({
        id: item.id,
        orderId: item.orderId,
        orderCode: item.orderCode,
        storeName: item.storeName,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        requestedQuantity: item.requestedQuantity,
        requestedUnit: item.requestedUnit,
        internalKg: item.internalKg,
        deliveryDate: item.deliveryDate,
        deliveryDateLabel: formatDateBr(item.deliveryDate),
        saleDate: item.saleDate,
        saleDateLabel: formatDateBr(item.saleDate),
        expeditionUnit: item.expeditionUnit,
        expeditionQuantity: item.expeditionQuantity,
        productionItemKey: item.productionItemKey ?? `${planningKey}|${item.productId}`,
        productionSequence: item.scheduleDayPriority,
        releasedToProduction: item.releasedToProduction,
        productionItemStatus: item.productionItemStatus ?? "nao_iniciado",
        workflowProgress: item.workflowProgress,
      });
    });

  const groupedOps = Array.from(opGroupMap.values()).sort((a, b) => {
    const byDate = compareDateKeys(a.productionDate, b.productionDate);
    if (byDate !== 0) {
      return byDate;
    }
    const bySector = a.sectorName.localeCompare(b.sectorName);
    if (bySector !== 0) {
      return bySector;
    }
    return a.lineName.localeCompare(b.lineName);
  });

  const opCodeByPlanningKey = new Map<string, string>();
  const productionOrders: ProductionOrderRow[] = groupedOps.map((group, index) => {
    const code = `OP-${group.productionDate.replaceAll("-", "").slice(2)}-${String(index + 1).padStart(3, "0")}`;
    opCodeByPlanningKey.set(group.planningKey, code);

    // Monta os itens já com plano de batidas + status/progresso efetivo.
    const builtItems = Array.from(group.items.values())
      .map((opItem) => {
        const plan = planBatches({
          totalKg: opItem.totalKg,
          capacityPerBatch: opItem.capacityPerBatch,
          salesToKgFactor: opItem.salesToKgFactor,
          salesUnit: opItem.batchUnitLabel,
        });
        const isBatched = opItem.capacityPerBatch != null && opItem.capacityPerBatch > 0;
        const batchesDone = Math.min(opItem.batchesDone, plan.batchCount);
        const status = isBatched ? deriveBatchStatus(batchesDone, plan.batchCount) : opItem.status;
        const progress = isBatched
          ? Math.round((batchesDone / plan.batchCount) * 100)
          : opItem.progress;
        return {
          ...opItem,
          // FASE 2: "pedido" se houve source de pedido OU kg consolidado > 0;
          // senão é só slot do cronograma (esqueleto).
          demandSource: (opItem.hasPedidoSource || opItem.totalKg > 0 ? "pedido" : "cronograma") as
            | "pedido"
            | "cronograma",
          belowMinimum: opItem.minimumProductionKg > 0 && opItem.totalKg < opItem.minimumProductionKg,
          batchCount: plan.batchCount,
          batchSizes: plan.batchSizes,
          batchUnitLabel: plan.unitLabel,
          batchesDone,
          status,
          progress,
        };
      })
      .sort((a, b) => {
        const bySequence =
          (a.productionSequence ?? Number.MAX_SAFE_INTEGER) -
          (b.productionSequence ?? Number.MAX_SAFE_INTEGER);
        if (bySequence !== 0) {
          return bySequence;
        }
        return a.productCode.localeCompare(b.productCode);
      });

    const progress =
      builtItems.length === 0
        ? 0
        : Number(
            (builtItems.reduce((sum, it) => sum + it.progress, 0) / builtItems.length).toFixed(1),
          );
    const status: OrderStatus =
      progress >= 100
        ? "aguardando_expedicao"
        : progress > 0
          ? "em_producao"
          : compareDateKeys(group.productionDate, referenceDate) >= 0
            ? "agendado"
            : "em_espera";

    return {
      id: `op-${index + 1}`,
      code,
      productionDate: group.productionDate,
      productionDateLabel: formatDateBr(group.productionDate),
      sectorId: group.sectorId,
      sectorName: group.sectorName,
      lineId: group.lineId,
      lineName: group.lineName,
      scheduleId: group.scheduleId,
      scheduleCode: group.scheduleCode,
      scheduleName: group.scheduleName,
      itemsCount: group.sourceItems.length,
      ordersCount: group.orderIds.size,
      totalKg: round2(group.totalKg),
      // FASE 2: a OP tem demanda real se ALGUM item consolidou kg > 0. OP cujos
      // itens são todos cronograma/0 é uma "OP de esqueleto".
      hasDemand: builtItems.some((opItem) => opItem.totalKg > 0),
      releasedToProduction: group.releasedToProduction,
      productionStarted: group.productionStarted,
      progress,
      status,
      orderCodes: Array.from(group.orderCodes).sort((a, b) => a.localeCompare(b)),
      // Remove só os campos auxiliares (usados p/ derivar plano/demandSource) do
      // ProductionOrderItem público. `capacityPerBatch` agora É público (distingue
      // produto batido — status pelas batidas vs botões de status), então fica.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      items: builtItems.map(({ salesToKgFactor, hasPedidoSource, ...rest }) => rest),
      sourceItems: group.sourceItems.sort((a, b) => {
        const bySequence =
          (a.productionSequence ?? Number.MAX_SAFE_INTEGER) -
          (b.productionSequence ?? Number.MAX_SAFE_INTEGER);
        if (bySequence !== 0) {
          return bySequence;
        }
        const byOrder = a.orderCode.localeCompare(b.orderCode);
        if (byOrder !== 0) {
          return byOrder;
        }
        return a.productCode.localeCompare(b.productCode);
      }),
    };
  });

  const opsByOrderId = new Map<string, Set<string>>();
  productionOrders.forEach((op) => {
    op.sourceItems.forEach((item) => {
      if (!opsByOrderId.has(item.orderId)) {
        opsByOrderId.set(item.orderId, new Set<string>());
      }
      opsByOrderId.get(item.orderId)!.add(op.code);
    });
  });

  return { productionOrders, opsByOrderId, opCodeByPlanningKey };
}

function buildOrders(
  storeOrders: StoreOrder[],
  orderItemsByOrderId: Map<string, PlannedOrderItem[]>,
  storeById: Map<string, StoreProfile>,
  opsByOrderId: Map<string, Set<string>>,
  settings: OperationalSettings,
): PlannedOrderRow[] {
  return storeOrders
    .map<PlannedOrderRow | null>((order) => {
      const store = storeById.get(order.storeId);
      if (!store) {
        return null;
      }

      const items = orderItemsByOrderId.get(order.id) ?? [];
      const opCodes = Array.from(opsByOrderId.get(order.id) ?? []).sort((a, b) => a.localeCompare(b));
      const windowDeliveryDate = getOperationalOrderWindow(order.orderedAt, store, settings).deliveryDate;
      // AJ-A10: pedido VAZIO (sem itens) usa a data de entrega PERSISTIDA (promessa
      // firmada na abertura pela fábrica) em vez da janela — senão pedidos do
      // cronograma p/ data futura exibiriam a "próxima" data. Pedido PREENCHIDO usa a
      // data dos ITENS (mesma base do filtro operational-date-scope e de
      // buildExpeditionRows) → evita divergência filtro×exibição (pedido em 2 janelas).
      // O filtro de escopo inclui pedido vazio por row.deliveryDate, então usar a
      // persistida nele é coerente.
      const deliveryDate =
        items.length > 0 ? getLatestDate(items, windowDeliveryDate) : (order.deliveryDate ?? windowDeliveryDate);

      return {
        id: order.id,
        code: order.code,
        storeId: store.id,
        storeName: store.name,
        orderedAt: formatDateTimeBr(order.orderedAt),
        orderedAtKey: order.orderedAt.slice(0, 10),
        dPlusLabel: `D+${settings.expeditionLeadDays}`,
        deliveryDate,
        deliveryDateLabel: formatDateBr(deliveryDate),
        productionDateLabel: buildOrderProductionDateLabel(items),
        itemsCount: items.length,
        totalKg: round2(items.reduce((sum, item) => sum + item.internalKg, 0)),
        opsLabel: buildOrderOpsLabel(opCodes),
        releasedToProduction: items.some((item) => item.releasedToProduction),
        // A10: pedido VAZIO (0 itens) não é liberável — `[].every()` é `true`, o que
        // deixava um pedido sem itens passar na validação e gerar release fantasma.
        // Alinhado com factory-workflow-logic.ts (`... && items.length > 0`).
        availableForRelease: items.length > 0 && items.every((item) => item.availableForRelease),
        workflowProgress: getAverageProgress(items),
        status: getOrderStatusFromItems(items),
      } satisfies PlannedOrderRow;
    })
    .filter((row): row is PlannedOrderRow => Boolean(row))
    .sort((a, b) => {
      const byDelivery = compareDateKeys(a.deliveryDate, b.deliveryDate);
      if (byDelivery !== 0) {
        return byDelivery;
      }
      return a.code.localeCompare(b.code);
    });
}

function buildExpeditionRows(
  storeOrders: StoreOrder[],
  orderItemsByOrderId: Map<string, PlannedOrderItem[]>,
  storeById: Map<string, StoreProfile>,
  orderByCode: Map<string, PlannedOrderRow>,
  settings: OperationalSettings,
): ExpeditionRow[] {
  return storeOrders
    .map((order) => {
      const store = storeById.get(order.storeId);
      if (!store) {
        return null;
      }

      const items = (orderItemsByOrderId.get(order.id) ?? []).slice().sort((a, b) => a.productCode.localeCompare(b.productCode));
      const windowDeliveryDate = getOperationalOrderWindow(order.orderedAt, store, settings).deliveryDate;
      // A expedição usa a data calculada a partir dos ITENS — NÃO a data persistida.
      // O filtro de janela operacional (operational-date-scope) inclui a expedição
      // pelas datas dos itens; se aqui usássemos `order.deliveryDate` (persistida),
      // pedidos do cronograma abertos para data futura apareceriam em 2 janelas com
      // Recebimento divergente do dia filtrado. A lista da loja/gestor
      // (buildPlannedOrderRows) é que mantém a data persistida.
      const deliveryDate = items.length > 0 ? getLatestDate(items, windowDeliveryDate) : windowDeliveryDate;
      const orderSummary = orderByCode.get(order.code);

      const expeditionItems: ExpeditionItem[] = items.map((item) => ({
        itemId: item.id,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        requestedQuantity: item.requestedQuantity,
        requestedUnit: item.requestedUnit,
        internalKg: item.internalKg,
        expeditionQuantityRaw: item.expeditionQuantityRaw,
        expeditionQuantity: item.expeditionQuantity,
        expeditionUnit: item.expeditionUnit,
        productionDate: item.productionDate,
        saleDate: item.saleDate,
        workflowProgress: item.workflowProgress,
      }));

      return {
        id: `exp-${order.id}`,
        orderId: order.id,
        orderCode: order.code,
        storeId: store.id,
        storeName: store.name,
        deliveryDate,
        deliveryDateLabel: formatDateBr(deliveryDate),
        totalKg: round2(expeditionItems.reduce((sum, item) => sum + item.internalKg, 0)),
        itemsCount: expeditionItems.length,
        itemsSummary: expeditionItems
          .map((item) => `${item.productCode}: ${item.requestedQuantity} ${item.requestedUnit}`)
          .join(" | "),
        releasedToProduction: orderSummary?.releasedToProduction ?? false,
        workflowProgress: orderSummary?.workflowProgress ?? 0,
        status: orderSummary?.status ?? "em_espera",
        items: expeditionItems,
      };
    })
    .filter((row): row is ExpeditionRow => Boolean(row))
    .sort((a, b) => {
      const byDelivery = compareDateKeys(a.deliveryDate, b.deliveryDate);
      if (byDelivery !== 0) {
        return byDelivery;
      }
      return a.orderCode.localeCompare(b.orderCode);
    });
}

function buildExpeditionItems(expeditionRows: ExpeditionRow[]): ExpeditionSeparationRow[] {
  return expeditionRows.flatMap((row) =>
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
}

export function buildFactoryPlanningData(
  referenceDate: string,
  input: FactoryPlanningInput,
): FactoryPlanningData {
  const source = resolvePlanningSource(input);
  const storeById = new Map(input.stores.map((store) => [store.id, store]));
  const scheduleByLineId = buildActiveScheduleByLine(source.schedules);
  const orderItems = buildPlannedItems(
    {
      storeOrders: input.storeOrders,
      storeById,
      scheduleByLineId,
      source,
    },
    referenceDate,
  );

  // Expansão de sub-receita produto-MPI em itens planejados (AJ-0008).
  // Ver Docs/decisoes/ADR_expansao_mpi_em_op.md. Default off: comportamento
  // legado preservado até validação do cliente em dev.
  const expandedItems = isMpiExpansionEnabled()
    ? expandRecipeIntoItems(orderItems, source.productsById, source.ingredients, source.products, {
        // AJ-A4: fase 2 — passa os maps para que o MPI rode na linha/setor nativos.
        linesById: source.linesById,
        sectorsById: source.sectorsById,
        // AJ-0008.1 (Fase 3): ingrediente misturado puro também vira OP (default ON).
        expandMixedIngredients: isMixedIngredientExpansionEnabled(),
        // XPAN #6: pedido liberado expande a receita congelada no release, não a ao vivo.
        releasedRecipeByOrderProduct: source.releasedRecipeByOrderProduct,
      })
    : orderItems;

  // FASE 1 — esqueleto do cronograma: slots produto×linha×dia (qtd 0) que o
  // cronograma ATIVO prevê. Só PREENCHE LACUNAS — onde já há um item com demanda
  // real (mesma chave canônica produtoDate|lineId|productId), esse item manda e o
  // esqueleto é descartado, então itens reais NUNCA mudam.
  //
  // As chaves vêm de `expandedItems` (pedidos + MPI já expandido), não só de
  // `orderItems`: uma sub-receita (ex. massa de pizza) que JÁ ganhou demanda via
  // expansão não deve ainda receber um slot-fantasma do cronograma por cima.
  const existingKeys = new Set(
    expandedItems
      .filter((item) => item.canPlan && item.productionDate)
      .map((item) => getProductionItemKey(item))
      .filter((key): key is string => Boolean(key)),
  );
  const skeletonItems = buildScheduleSkeletonItems({ scheduleByLineId, source }, referenceDate).filter((item) => {
    const key = getProductionItemKey(item);
    return key !== null && !existingKeys.has(key);
  });

  // O esqueleto NÃO passa pela expansão de receita (slots têm qtd 0; expandi-los só
  // geraria OPs-fantasma de MPI com 0 kg). Vai direto, junto com os itens expandidos.
  const { productionOrders, opsByOrderId, opCodeByPlanningKey } = buildProductionOrdersFromPlannedItems(
    [...expandedItems, ...skeletonItems],
    referenceDate,
  );
  const orderItemsWithOpCodes = [...orderItems, ...skeletonItems].map((item) => {
    const planningKey = getPlanningKey(item);
    return {
      ...item,
      opCode: planningKey ? opCodeByPlanningKey.get(planningKey) ?? null : null,
    };
  });

  // FIX MPI — conjunto COMPLETO de itens de planejamento (inclui os itens de
  // sub-receita/MPI expandidos), com opCode pela mesma chave de planejamento que
  // o motor usou. `orderItems` (exibição) NÃO contém os itens MPI; sem este
  // conjunto, `applyFactoryWorkflowState` reconstruía as OPs só dos itens de
  // exibição e a OP do MPI sumia ao liberar o pedido.
  const productionPlanItems = [...expandedItems, ...skeletonItems].map((item) => {
    const planningKey = getPlanningKey(item);
    return {
      ...item,
      opCode: planningKey ? opCodeByPlanningKey.get(planningKey) ?? null : null,
    };
  });

  const orderItemsByOrderId = groupOrderItemsByOrderId(orderItemsWithOpCodes);
  const orders = buildOrders(input.storeOrders, orderItemsByOrderId, storeById, opsByOrderId, source.settings);
  const orderByCode = new Map(orders.map((order) => [order.code, order]));
  const expedition = buildExpeditionRows(input.storeOrders, orderItemsByOrderId, storeById, orderByCode, source.settings);
  const expeditionItems = buildExpeditionItems(expedition);

  return {
    referenceDate,
    orders,
    orderItems: orderItemsWithOpCodes,
    productionPlanItems,
    productionOrders,
    expedition,
    expeditionItems,
    productionDates: Array.from(
      new Set(orderItemsWithOpCodes.map((item) => item.productionDate).filter((value): value is string => Boolean(value))),
    ).sort(compareDateKeys),
    deliveryDates: Array.from(new Set(orders.map((order) => order.deliveryDate))).sort(compareDateKeys),
  };
}

export function getProductById(productId: string, products: ProductionProduct[]): ProductionProduct | undefined {
  return products.find((product) => product.id === productId);
}
