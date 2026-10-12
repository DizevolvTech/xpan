import {
  buildPackagingSeparationDocument,
  buildProductionSheetDocument,
  type PackagingSeparationLine,
} from "@/lib/printing-documents";
import { getProductDisplayCode } from "@/lib/product-identity";
import type { ProductionIngredient, ProductionProduct } from "@/lib/production-planning";
import type { ProductionOrderRow } from "@/lib/order-planning";
import type { UnitCode } from "@/lib/factory-planning/units";
import { isMassOrVolumeUnit } from "@/lib/factory-planning/units";

type Source = { products: ProductionProduct[]; ingredients: ProductionIngredient[] };

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export type DayPackagingLine = PackagingSeparationLine & {
  /** Em quantas OPs do dia a embalagem aparece (a soma é feita sobre todas). */
  opCount: number;
};

/**
 * Embalagens do DIA programado: o mesmo insumo na mesma unidade, vindo de várias OPs e produtos, vira
 * UMA linha pela quantidade TOTAL. O arredondamento de unidade contada (Un sobe para o inteiro) é feito
 * UMA vez no total do dia — arredondar OP a OP separaria 0,4 + 0,4 em 1 + 1 = 2 caixas em vez de 1.
 * É só apresentação: consumo, peso e custo continuam vindo da receita.
 */
export function buildDayPackagingSeparation(ops: ProductionOrderRow[], source: Source): DayPackagingLine[] {
  const byKey = new Map<string, DayPackagingLine>();
  for (const op of ops) {
    for (const line of buildPackagingSeparationDocument(op, source).lines) {
      const current = byKey.get(line.key);
      if (!current) {
        byKey.set(line.key, { ...line, usedBy: line.usedBy.map((entry) => ({ ...entry })), opCount: 1 });
        continue;
      }
      current.exactQuantity = round3(current.exactQuantity + line.exactQuantity);
      current.opCount += 1;
      for (const entry of line.usedBy) {
        const same = current.usedBy.find((used) => used.productName === entry.productName);
        if (same) same.quantity = round3(same.quantity + entry.quantity);
        else current.usedBy.push({ ...entry });
      }
    }
  }
  return Array.from(byKey.values())
    .map((line) => ({
      ...line,
      quantity: isMassOrVolumeUnit(line.unit) ? line.exactQuantity : Math.ceil(line.exactQuantity - 1e-9),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export type DayLabel = {
  productId: string;
  productName: string;
  /** Código que o cliente reconhece (ERP ou GTIN), como nas demais impressões. */
  code: string;
  /** Quantidade programada do produto no dia, somando todas as OPs, na unidade do pedido. */
  quantity: number;
  unit: UnitCode;
  /** Peso da etiqueta (Inmetro), só quando o teste de laboratório do produto o traz. */
  labelWeightKg: number | null;
  opCodes: string[];
};

/**
 * Uma etiqueta por PRODUTO/sabor com a quantidade total programada no dia. Produto igual em duas OPs
 * (batidas ou linhas diferentes) soma na mesma etiqueta; unidades diferentes (Un e Kg) nunca se somam.
 */
export function buildDayLabels(ops: ProductionOrderRow[], source: Source): DayLabel[] {
  const productsById = new Map(source.products.map((product) => [product.id, product]));
  const byKey = new Map<string, DayLabel>();
  for (const op of ops) {
    const document = buildProductionSheetDocument(op, source);
    for (const section of document.productSections) {
      const key = `${section.productId}::${section.requestedUnit}`;
      const product = productsById.get(section.productId);
      const current = byKey.get(key);
      if (current) {
        current.quantity = round3(current.quantity + section.requestedQuantity);
        if (!current.opCodes.includes(op.code)) current.opCodes.push(op.code);
        continue;
      }
      byKey.set(key, {
        productId: section.productId,
        productName: section.productName,
        code: product ? getProductDisplayCode(product) : section.productCode,
        quantity: round3(section.requestedQuantity),
        unit: section.requestedUnit,
        labelWeightKg: product?.labTest?.labelWeightKg ?? null,
        opCodes: [op.code],
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR"));
}
