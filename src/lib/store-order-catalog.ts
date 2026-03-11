import type { LineType } from "@/lib/production-planning";
import { getOperationalOrderWindow, resolveProductionDateInWindow } from "@/lib/order-planning";
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

  const { baseDate, deliveryDate } = getOperationalOrderWindow(options.orderedAt, store, snapshot.operationalSettings);
  const sectorById = new Map(snapshot.sectors.map((sector) => [sector.id, sector]));
  const lineById = new Map(snapshot.lines.map((line) => [line.id, line]));
  const productById = new Map(snapshot.products.map((product) => [product.id, product]));
  const entries = new Map<string, ApprovedCatalogEntry>();

  snapshot.schedules
    .filter((schedule) => schedule.status === "ativo")
    .forEach((schedule) => {
      const line = lineById.get(schedule.lineId);
      if (!line || line.status !== "ativo") {
        return;
      }

      const sector = sectorById.get(line.sectorId);
      if (!sector || sector.status !== "ativo") {
        return;
      }

      schedule.items.forEach((scheduleItem) => {
        const product = productById.get(scheduleItem.productId);

        if (!product || !product.active || !product.availableForOrdering) {
          return;
        }

        const planning = resolveProductionDateInWindow(baseDate, deliveryDate, product.productionDays);
        if (!planning.date || planning.delayed) {
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
