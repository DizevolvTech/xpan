import type { UnitCode } from "@/lib/factory-planning/units";
import {
  linesById,
  productsById,
  sectorsById,
  weeklySchedules,
  type LineType,
  type ProductionWeekDay,
  type ProductionProduct,
} from "@/lib/production-planning";

export type StoreOrderProduct = {
  id: string;
  code: string;
  name: string;
  unit: UnitCode;
  category: string;
  sectorName: string;
  lineName: string;
  lineType: LineType;
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

type ApprovedCatalogEntry = {
  product: ProductionProduct;
  sectorName: string;
  lineName: string;
  lineType: LineType;
  scheduleName: string;
  productionDays: ProductionWeekDay[];
};

const variantLabels = [
  "Tradicional",
  "Especial",
  "Integral",
  "Premium",
  "Leve",
  "Mini",
  "Max",
  "Casa",
  "Classico",
  "Familiar",
  "Express",
  "Selecionado",
];

function getApprovedCatalogEntries(): ApprovedCatalogEntry[] {
  const entries = new Map<string, ApprovedCatalogEntry>();

  weeklySchedules
    .filter((schedule) => schedule.status === "ativo")
    .forEach((schedule) => {
      const line = linesById.get(schedule.lineId);
      if (!line || line.status !== "ativo") {
        return;
      }

      const sector = sectorsById.get(line.sectorId);
      if (!sector || sector.status !== "ativo") {
        return;
      }

      schedule.items.forEach((scheduleItem) => {
        const product = productsById.get(scheduleItem.productId);
        if (!product || !product.active || !product.availableForOrdering) {
          return;
        }

        const key = `${schedule.id}|${product.id}`;
        if (!entries.has(key)) {
          entries.set(key, {
            product,
            sectorName: sector.name,
            lineName: line.name,
            lineType: line.type,
            scheduleName: schedule.name,
            productionDays: scheduleItem.productionDays,
          });
        }
      });
    });

  return Array.from(entries.values()).sort((a, b) => {
    const bySector = a.sectorName.localeCompare(b.sectorName);
    if (bySector !== 0) {
      return bySector;
    }
    const byLine = a.lineName.localeCompare(b.lineName);
    if (byLine !== 0) {
      return byLine;
    }
    return a.product.code.localeCompare(b.product.code);
  });
}

function calculateTotal(product: Pick<StoreOrderProduct, "sex" | "sab" | "dom" | "seg" | "ter" | "qua" | "qui">) {
  return product.sex + product.sab + product.dom + product.seg + product.ter + product.qua + product.qui;
}

export function buildStoreOrderProductsMock(targetSize = 132): StoreOrderProduct[] {
  const approvedEntries = getApprovedCatalogEntries();
  if (approvedEntries.length === 0) {
    return [];
  }

  const variantsPerEntry = Math.max(1, Math.ceil(targetSize / approvedEntries.length));
  const rows: StoreOrderProduct[] = [];

  for (const entry of approvedEntries) {
    for (let variantIndex = 0; variantIndex < variantsPerEntry; variantIndex += 1) {
      if (rows.length >= targetSize) {
        break;
      }

      const suffix = variantLabels[variantIndex % variantLabels.length];
      const isBaseVariant = variantIndex === 0;
      const codeSuffix = String(variantIndex + 1).padStart(2, "0");

      const row: StoreOrderProduct = {
        id: `${entry.product.id}-${codeSuffix}`,
        code: `${entry.product.code}-${codeSuffix}`,
        name: isBaseVariant ? entry.product.name : `${entry.product.name} ${suffix}`,
        unit: entry.product.salesUnit,
        category: entry.sectorName,
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
      rows.push(row);
    }
  }

  return rows.sort((a, b) => {
    const byType = a.lineType.localeCompare(b.lineType);
    if (byType !== 0) {
      return byType;
    }
    const byLine = a.lineName.localeCompare(b.lineName);
    if (byLine !== 0) {
      return byLine;
    }
    return a.code.localeCompare(b.code);
  });
}
