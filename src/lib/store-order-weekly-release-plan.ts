/* -------------------------------------------------------------------------------------------------
 * FEATURE A10 — planejamento da liberação SEMANAL de pedidos a partir do cronograma (lógica pura).
 *
 * Regra do cliente: o cronograma da fábrica define o que cada loja pede POR DIA da semana.
 * A fábrica audita e LIBERA os pedidos da semana — um pedido `aberto` por DIA que a loja
 * recebe E que tem cobertura real do cronograma ativo mapeando para aquela data de entrega.
 * A loja só seleciona um pedido liberado e preenche (não cria do zero nem duplica).
 *
 * "Semana" = horizonte rolante de 7 dias a partir de `referenceDate`
 * (reuso `SCHEDULE_SKELETON_HORIZON_DAYS` / `buildScheduleSkeletonItems`).
 *
 * Este módulo é PURO (sem `server-only`/env) — testável com `tsx --test`. Espelha
 * `store-order-open-plan.ts`. Ver migration 20260603120000 e ADR_modelo_fabrica_abre_pedido.
 * -----------------------------------------------------------------------------------------------*/

import {
  buildActiveScheduleByLine,
  buildScheduleSkeletonItems,
  getDeliveryDateByStoreRule,
  getWeekDayKey,
  resolvePlanningSource,
  SCHEDULE_SKELETON_HORIZON_DAYS,
  type StoreProfile,
} from "@/lib/order-planning";
import {
  getEnabledReceivingDays,
  type OperationalSettings,
  type ProductionIngredient,
  type ProductionLine,
  type ProductionProduct,
  type ProductionSector,
  type ProductionWeekDay,
  type WeeklyProductionSchedule,
} from "@/lib/production-planning";

export interface WeeklyStoreOrderReleasePlanInput {
  /** Data operacional de referência (YYYY-MM-DD). Início do horizonte rolante de 7 dias. */
  referenceDate: string;
  /** Lojas-alvo (já filtradas pelo caller — ex.: ativas e no escopo do gestor). */
  stores: StoreProfile[];
  schedules: WeeklyProductionSchedule[];
  products: ProductionProduct[];
  sectors: ProductionSector[];
  lines: ProductionLine[];
  settings: OperationalSettings;
  /** Consumido só pela montagem do source (opcional, sem efeito na liberação). */
  ingredients?: ProductionIngredient[];
  /** Pares "storeId|deliveryDate" que já têm pedido ATIVO (idempotência). */
  existingActiveByStoreDate: Set<string>;
}

export interface WeeklyStoreOrderRelease {
  storeId: string;
  /** Data de entrega (YYYY-MM-DD) para a qual o pedido será aberto. */
  deliveryDate: string;
  /** Dia-da-semana (pt-BR) da data de entrega — materializado em store_orders.delivery_weekday. */
  deliveryWeekday: ProductionWeekDay;
  /** Ids dos cronogramas (linhas) cuja cobertura justificou abrir este pedido. */
  sourceScheduleIds: string[];
}

export type WeeklyStoreOrderSkipReason =
  | "sem-recebimento"
  | "sem-cobertura"
  | "ja-ativo";

export interface WeeklyStoreOrderSkip {
  storeId: string;
  deliveryDate?: string;
  reason: WeeklyStoreOrderSkipReason;
}

export interface WeeklyStoreOrderReleasePlan {
  toOpen: WeeklyStoreOrderRelease[];
  skipped: WeeklyStoreOrderSkip[];
}

export function activeStoreDateKey(storeId: string, deliveryDate: string): string {
  return `${storeId}|${deliveryDate}`;
}

/**
 * A10: deriva os pedidos da semana (um por dia que a loja recebe) a partir do cronograma ativo.
 *
 * Lógica:
 *  1. Monta o cronograma ATIVO por linha + o `source` (lookups produto/linha/setor).
 *  2. `buildScheduleSkeletonItems(referenceDate, 7)` materializa os slots produto×linha×dia
 *     de PRODUÇÃO no horizonte (cobertura real do cronograma).
 *  3. Para cada loja, mapeia cada DATA DE PRODUÇÃO do esqueleto para a DATA DE ENTREGA da loja
 *     via `getDeliveryDateByStoreRule`, mantendo só as datas de entrega cujo dia-da-semana está
 *     em `getEnabledReceivingDays(store)` e dentro da janela rolante de 7 dias.
 *  4. Para cada (loja × deliveryDate) DISTINTA não presente em `existingActiveByStoreDate`,
 *     emite uma liberação com os `sourceScheduleIds` que a justificaram.
 */
export function planWeeklyStoreOrderReleases(
  input: WeeklyStoreOrderReleasePlanInput,
): WeeklyStoreOrderReleasePlan {
  const horizon = SCHEDULE_SKELETON_HORIZON_DAYS;
  const scheduleByLineId = buildActiveScheduleByLine(input.schedules);

  const toOpen: WeeklyStoreOrderRelease[] = [];
  const skipped: WeeklyStoreOrderSkip[] = [];

  // Sem cronograma ativo → nada a liberar (não polui com dias sem cobertura).
  if (scheduleByLineId.size === 0) {
    for (const store of input.stores) {
      skipped.push({ storeId: store.id, reason: "sem-cobertura" });
    }
    return { toOpen, skipped };
  }

  const source = resolvePlanningSource({
    stores: input.stores,
    storeOrders: [],
    settings: input.settings,
    sectors: input.sectors,
    lines: input.lines,
    products: input.products,
    schedules: input.schedules,
    ingredients: input.ingredients,
  });

  // Datas de PRODUÇÃO cobertas pelo cronograma no horizonte (distintas).
  const skeletonItems = buildScheduleSkeletonItems(
    { scheduleByLineId, source },
    input.referenceDate,
    horizon,
  );
  const productionDates = Array.from(
    new Set(
      skeletonItems
        .map((item) => item.productionDate)
        .filter((date): date is string => Boolean(date)),
    ),
  );

  // Limite superior (exclusivo) do horizonte rolante de 7 dias para a data de ENTREGA.
  const horizonEnd = addDaysKey(input.referenceDate, horizon);

  for (const store of input.stores) {
    const receivingDays = getEnabledReceivingDays(store);
    if (receivingDays.length === 0) {
      skipped.push({ storeId: store.id, reason: "sem-recebimento" });
      continue;
    }
    const receivingDaySet = new Set<ProductionWeekDay>(receivingDays);

    // deliveryDate (YYYY-MM-DD) → conjunto de cronogramas que a justificaram.
    const scheduleIdsByDelivery = new Map<string, Set<string>>();

    for (const productionDate of productionDates) {
      const deliveryDate = getDeliveryDateByStoreRule(productionDate, store, input.settings);

      // Fora da janela rolante de 7 dias a partir da referência → ignora.
      if (deliveryDate < input.referenceDate || deliveryDate >= horizonEnd) {
        continue;
      }
      // Dia de entrega que a loja não recebe (ou bloqueado) → ignora.
      if (!receivingDaySet.has(getWeekDayKey(deliveryDate))) {
        continue;
      }

      // Cronogramas que produzem nessa data de produção (justificam a entrega).
      const justifying = skeletonItems
        .filter((item) => item.productionDate === productionDate)
        .map((item) => item.scheduleId)
        .filter((id): id is string => Boolean(id));

      const set = scheduleIdsByDelivery.get(deliveryDate) ?? new Set<string>();
      for (const id of justifying) {
        set.add(id);
      }
      scheduleIdsByDelivery.set(deliveryDate, set);
    }

    if (scheduleIdsByDelivery.size === 0) {
      skipped.push({ storeId: store.id, reason: "sem-cobertura" });
      continue;
    }

    // Emite uma liberação por data de entrega DISTINTA, em ordem cronológica.
    const deliveryDates = Array.from(scheduleIdsByDelivery.keys()).sort();
    for (const deliveryDate of deliveryDates) {
      if (input.existingActiveByStoreDate.has(activeStoreDateKey(store.id, deliveryDate))) {
        skipped.push({ storeId: store.id, deliveryDate, reason: "ja-ativo" });
        continue;
      }
      toOpen.push({
        storeId: store.id,
        deliveryDate,
        deliveryWeekday: getWeekDayKey(deliveryDate),
        sourceScheduleIds: Array.from(scheduleIdsByDelivery.get(deliveryDate)!).sort(),
      });
    }
  }

  return { toOpen, skipped };
}

/**
 * Soma `days` a uma data YYYY-MM-DD (cálculo local, sem dependência do engine — mantém
 * este módulo enxuto e idêntico ao `addDays` interno do engine para o mesmo input).
 */
function addDaysKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
