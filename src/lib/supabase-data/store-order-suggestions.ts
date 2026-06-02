import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertSupabaseResult, isUuid, type SupabaseDataClient } from "@/lib/supabase-data/common";

export type WeekdayKey = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export type WeekdaySuggestion = Record<WeekdayKey, number>;

/** productId (legacy id, igual ao catálogo) -> média sugerida por dia da semana. */
export type StoreOrderSuggestionMap = Record<string, WeekdaySuggestion>;

// delivery_date é YYYY-MM-DD; derivamos o dia da semana sem fuso (meio-dia UTC
// evita virar o dia em fusos negativos). 0 = domingo, ... 6 = sábado.
const WEEKDAY_BY_JS_DAY: WeekdayKey[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function weekdayKeyFromDeliveryDate(deliveryDate: string): WeekdayKey | null {
  const parsed = new Date(`${deliveryDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return WEEKDAY_BY_JS_DAY[parsed.getUTCDay()];
}

function emptyAccumulator(): Record<WeekdayKey, { sum: number; count: number }> {
  return {
    seg: { sum: 0, count: 0 },
    ter: { sum: 0, count: 0 },
    qua: { sum: 0, count: 0 },
    qui: { sum: 0, count: 0 },
    sex: { sum: 0, count: 0 },
    sab: { sum: 0, count: 0 },
    dom: { sum: 0, count: 0 },
  };
}

const WEEKDAY_KEYS: WeekdayKey[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

type StoreRow = { id: string; legacy_id: string | null };
type ProductRow = { id: string; legacy_id: string | null };
type OrderRow = { id: string; delivery_date: string };
type ItemRow = { order_id: string; product_id: string; requested_quantity: number };

/**
 * 2.7-C — sugestão ADVISORY de quantidade por dia da semana.
 *
 * Calcula, por produto e por dia da semana, a MÉDIA de `requested_quantity` nos
 * pedidos históricos da loja (janela: últimas 8 semanas). O dia da semana é
 * derivado de `delivery_date`. Retorna um mapa `productId(legacy) -> {seg..dom}`
 * com quantidades arredondadas. Produtos sem histórico são omitidos.
 *
 * Agregação feita em TS (e não via RPC) para seguir o padrão das fontes de
 * dados vizinhas (`listFactoryStoreOrders` etc.), que buscam linhas e agregam
 * em memória. A janela é filtrada por loja + data no banco para manter eficiência.
 */
export async function getStoreOrderWeekdaySuggestions(
  options: {
    storeId: string;
    /** Referência "agora" (ISO) — janela = últimas 8 semanas a partir daqui. */
    now?: string;
    weeks?: number;
  },
  supabase: SupabaseDataClient = createSupabaseAdminClient(),
): Promise<StoreOrderSuggestionMap> {
  const weeks = options.weeks ?? 8;
  const now = options.now ? new Date(options.now) : new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - weeks * 7);
  const windowStartDate = windowStart.toISOString().slice(0, 10);

  // Resolve o id de banco da loja a partir do id legado (igual ao catálogo).
  const storesResult = await supabase.from("stores").select("id, legacy_id");
  const storeRows = assertSupabaseResult(storesResult, "Failed to load stores for suggestions") as StoreRow[];
  const storeRow = storeRows.find((row) =>
    isUuid(options.storeId) ? row.id === options.storeId : row.legacy_id === options.storeId,
  );

  if (!storeRow) {
    return {};
  }

  // Pedidos da loja na janela. Filtro por loja + data no banco (índice
  // idx_store_orders_store_date), só pedidos ativos.
  const ordersResult = await supabase
    .from("store_orders")
    .select("id, delivery_date")
    .eq("store_id", storeRow.id)
    .eq("management_status", "ativo")
    .gte("delivery_date", windowStartDate);

  const orderRows = assertSupabaseResult(ordersResult, "Failed to load store orders for suggestions") as OrderRow[];

  if (orderRows.length === 0) {
    return {};
  }

  const weekdayByOrderId = new Map<string, WeekdayKey>();
  for (const order of orderRows) {
    const weekday = weekdayKeyFromDeliveryDate(order.delivery_date);
    if (weekday) {
      weekdayByOrderId.set(order.id, weekday);
    }
  }

  const orderIds = Array.from(weekdayByOrderId.keys());
  if (orderIds.length === 0) {
    return {};
  }

  const [itemsResult, productsResult] = await Promise.all([
    supabase
      .from("store_order_items")
      .select("order_id, product_id, requested_quantity")
      .in("order_id", orderIds),
    supabase.from("products").select("id, legacy_id"),
  ]);

  const itemRows = assertSupabaseResult(itemsResult, "Failed to load store order items for suggestions") as ItemRow[];
  const productRows = assertSupabaseResult(productsResult, "Failed to load products for suggestions") as ProductRow[];
  const productLegacyById = new Map(productRows.map((row) => [row.id, row.legacy_id ?? row.id]));

  // productId(legacy) -> acumulador por dia da semana.
  const accumulators = new Map<string, ReturnType<typeof emptyAccumulator>>();

  for (const item of itemRows) {
    const weekday = weekdayByOrderId.get(item.order_id);
    if (!weekday) {
      continue;
    }
    const quantity = Number(item.requested_quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }
    const productLegacyId = productLegacyById.get(item.product_id) ?? item.product_id;
    let accumulator = accumulators.get(productLegacyId);
    if (!accumulator) {
      accumulator = emptyAccumulator();
      accumulators.set(productLegacyId, accumulator);
    }
    accumulator[weekday].sum += quantity;
    accumulator[weekday].count += 1;
  }

  const suggestions: StoreOrderSuggestionMap = {};

  for (const [productId, accumulator] of accumulators) {
    let hasHistory = false;
    const weekdaySuggestion: WeekdaySuggestion = {
      seg: 0,
      ter: 0,
      qua: 0,
      qui: 0,
      sex: 0,
      sab: 0,
      dom: 0,
    };

    for (const key of WEEKDAY_KEYS) {
      const { sum, count } = accumulator[key];
      if (count > 0) {
        weekdaySuggestion[key] = Math.round(sum / count);
        hasHistory = true;
      }
    }

    if (hasHistory) {
      suggestions[productId] = weekdaySuggestion;
    }
  }

  return suggestions;
}
