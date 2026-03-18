import type { LineType } from "@/lib/production-planning";
import { getOperationalTimeline } from "@/lib/order-planning";
import type { MasterDataSnapshot } from "@/lib/supabase-data/master-data";
import type { StoreOrderCatalogProduct } from "@/lib/store-order-types";

type ApprovedCatalogEntry = {
  productId: string;
  code: string;
  name: string;
  unit: StoreOrderCatalogProduct["unit"];
  category: string;
  sectorName: string;
  lineName: string;
  lineType: LineType;
  scheduleName: string;
  productionDays: StoreOrderCatalogProduct["productionDays"];
};

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
  },
) {
  const store = snapshot.stores.find((entry) => entry.id === options.storeId);
  if (!store) {
    throw new Error("Store not found");
  }

  const sectorById = new Map(snapshot.sectors.map((sector) => [sector.id, sector]));
  const lineById = new Map(snapshot.lines.map((line) => [line.id, line]));
  const activeScheduleByLineId = new Map(
    snapshot.schedules
      .filter((schedule) => schedule.status === "ativo")
      .map((schedule) => [schedule.lineId, schedule]),
  );
  const entries = new Map<string, ApprovedCatalogEntry>();

  snapshot.products.forEach((product) => {
    if (!product.active || !product.availableForOrdering || !product.operationalLineId) {
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

    const schedule = activeScheduleByLineId.get(line.id);
    if (!schedule) {
      return;
    }

    const timeline = getOperationalTimeline(
      options.orderedAt,
      store,
      snapshot.operationalSettings,
      product.productionDays,
      product.saleLeadDays ?? 0,
    );
    if (!timeline.productionDate || timeline.delayed) {
      return;
    }

    const key = `${schedule.id}|${product.id}`;
    if (entries.has(key)) {
      return;
    }

    entries.set(key, {
      productId: product.id,
      code: product.code,
      name: product.name,
      unit: product.salesUnit,
      category: sector.name,
      sectorName: sector.name,
      lineName: line.name,
      lineType: line.type,
      scheduleName: schedule.name,
      productionDays: product.productionDays,
    });
  });

  return Array.from(entries.values())
    .map<StoreOrderCatalogProduct>((entry) => {
      const row: StoreOrderCatalogProduct = {
        id: `${entry.productId}-${entry.scheduleName}`,
        productId: entry.productId,
        code: entry.code,
        name: entry.name,
        unit: entry.unit,
        category: entry.category,
        sectorName: entry.sectorName,
        lineName: entry.lineName,
        lineType: entry.lineType,
        scheduleName: entry.scheduleName,
        productionDays: entry.productionDays,
        available: true,
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
