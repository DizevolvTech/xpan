import type { LineType } from "@/lib/production-planning";
import { getUnitDefinition } from "@/lib/factory-planning/units";
import {
  getOperationalOrderWindow,
  getOperationalTimeline,
  resolveScheduledProductAvailability,
} from "@/lib/order-planning";
import type { MasterDataSnapshot } from "@/lib/supabase-data/master-data";
import type { StoreOrderCatalogProduct } from "@/lib/store-order-types";

type ApprovedCatalogEntry = {
  scheduleId: string | null;
  productId: string;
  code: string;
  name: string;
  unit: StoreOrderCatalogProduct["unit"];
  unitKind: StoreOrderCatalogProduct["unitKind"];
  salesToKgFactor: number;
  category: string;
  sectorName: string;
  lineName: string;
  lineType: LineType;
  scheduleName: string;
  productionDays: StoreOrderCatalogProduct["productionDays"];
  minimumProductionKg: number;
  baseDate: string;
  deliveryDate: string;
  productionDate: string | null;
  saleDate: string;
  available: boolean;
  blockedReason: string | null;
};

function buildLatestScheduleByLineId(
  schedules: Pick<MasterDataSnapshot, "schedules">["schedules"],
  status: "ativo" | "pendente",
) {
  const latestByLineId = new Map<string, (typeof schedules)[number]>();

  schedules
    .filter((schedule) => schedule.status === status)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach((schedule) => {
      if (!latestByLineId.has(schedule.lineId)) {
        latestByLineId.set(schedule.lineId, schedule);
      }
    });

  return latestByLineId;
}

function calculateTotal(
  product: Pick<StoreOrderCatalogProduct, "sex" | "sab" | "dom" | "seg" | "ter" | "qua" | "qui">,
) {
  return product.sex + product.sab + product.dom + product.seg + product.ter + product.qua + product.qui;
}

export function buildStoreOrderCatalog(
  snapshot: Pick<MasterDataSnapshot, "operationalSettings" | "stores" | "sectors" | "lines" | "products" | "schedules">,
  options: {
    storeId: string;
    orderedAt: string;
    /**
     * AJ-A10: data de entrega COMPROMETIDA (X) do pedido que a loja está preenchendo
     * (aberto pela fábrica p/ data futura). Quando informada, a disponibilidade e a
     * timeline ancoram em X em vez da próxima janela operacional. Ausente/null →
     * comportamento legado.
     */
    targetDeliveryDate?: string | null;
  },
) {
  const store = snapshot.stores.find((entry) => entry.id === options.storeId);
  if (!store) {
    throw new Error("Store not found");
  }

  const sectorById = new Map(snapshot.sectors.map((sector) => [sector.id, sector]));
  const lineById = new Map(snapshot.lines.map((line) => [line.id, line]));
  const activeScheduleByLineId = buildLatestScheduleByLineId(snapshot.schedules, "ativo");
  const entries = new Map<string, ApprovedCatalogEntry>();

  snapshot.products.forEach((product) => {
    // XPAN-9: MPI (canBeIngredient) só se movimenta indiretamente, via expansão da
    // receita do produto que o consome — nunca aparece como item pedível direto.
    if (
      !product.active ||
      !product.availableForOrdering ||
      !product.operationalLineId ||
      product.canBeIngredient
    ) {
      return;
    }

    const line = lineById.get(product.operationalLineId);
    if (!line || line.status !== "ativo") {
      return;
    }

    const sector = sectorById.get(line.sectorId);
    if (!sector || sector.status !== "ativo") {
      return;
    }

    const activeSchedule = activeScheduleByLineId.get(line.id) ?? null;
    // Always use the active schedule for availability — a pending revision
    // should not block products that are already in the active schedule.
    const schedule = activeSchedule;
    const scheduleItem = schedule?.items.find((item) => item.productId === product.id) ?? null;
    const orderWindow = getOperationalOrderWindow(options.orderedAt, store, snapshot.operationalSettings);
    const availability = schedule
      ? resolveScheduledProductAvailability(
          options.orderedAt,
          store,
          snapshot.operationalSettings,
          {
            productProductionDays: product.productionDays,
            productExpeditionLeadDays: product.expeditionLeadDays,
            scheduleItem,
            targetDeliveryDate: options.targetDeliveryDate ?? null,
          },
        )
      : null;
    const timeline = getOperationalTimeline(
      options.orderedAt,
      store,
      snapshot.operationalSettings,
      product.productionDays,
      snapshot.operationalSettings.saleLeadDays,
      product.expeditionLeadDays,
      options.targetDeliveryDate ?? null,
    );

    const key = `${schedule?.id ?? line.id}|${product.id}`;
    if (entries.has(key)) {
      return;
    }

    entries.set(key, {
      scheduleId: schedule?.id ?? null,
      productId: product.id,
      code: product.code,
      name: product.name,
      unit: product.salesUnit,
      unitKind: getUnitDefinition(product.salesUnit).kind,
      salesToKgFactor: product.salesToKgFactor,
      category: sector.name,
      sectorName: sector.name,
      lineName: line.name,
      lineType: line.type,
      scheduleName: schedule?.name ?? "Sem cronograma ativo",
      productionDays: availability?.matchingDays ?? [],
      minimumProductionKg: product.minimumProductionKg,
      baseDate: availability?.baseDate ?? orderWindow.baseDate,
      // AJ-A10: sem availability (linha sem cronograma), o fallback de entrega também
      // respeita a data comprometida X quando informada.
      deliveryDate: availability?.deliveryDate ?? options.targetDeliveryDate ?? orderWindow.deliveryDate,
      productionDate: availability?.productionDate ?? timeline.productionDate,
      saleDate: timeline.saleDate,
      available: availability?.available ?? false,
      blockedReason: availability
        ? availability.blockedReason
        : "Linha de produção sem cronograma ativo.",
    });
  });

  return Array.from(entries.values())
    .map<StoreOrderCatalogProduct>((entry) => {
      const row: StoreOrderCatalogProduct = {
        id: `${entry.productId}-${entry.scheduleName}`,
        scheduleId: entry.scheduleId,
        productId: entry.productId,
        code: entry.code,
        name: entry.name,
        unit: entry.unit,
        unitKind: entry.unitKind,
        salesToKgFactor: entry.salesToKgFactor,
        category: entry.category,
        sectorName: entry.sectorName,
        lineName: entry.lineName,
        lineType: entry.lineType,
        scheduleName: entry.scheduleName,
        productionDays: entry.productionDays,
        minimumProductionKg: entry.minimumProductionKg,
        available: entry.available,
        blockedReason: entry.blockedReason,
        baseDate: entry.baseDate,
        deliveryDate: entry.deliveryDate,
        productionDate: entry.productionDate,
        saleDate: entry.saleDate,
        sex: 0,
        sab: 0,
        dom: 0,
        seg: 0,
        ter: 0,
        qua: 0,
        qui: 0,
        total: 0,
      };

      row.total = calculateTotal(row);
      return row;
    })
    .sort((a, b) => {
      if (a.available !== b.available) {
        return a.available ? -1 : 1;
      }

      const byCategory = a.category.localeCompare(b.category);
      if (byCategory !== 0) {
        return byCategory;
      }

      const byLine = a.lineName.localeCompare(b.lineName);
      if (byLine !== 0) {
        return byLine;
      }

      return a.code.localeCompare(b.code);
    });
}
