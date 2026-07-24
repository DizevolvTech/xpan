"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { ProductionSheetSections } from "@/components/printing/production-sheet";
import { buildProductionSheetDocument } from "@/lib/printing-documents";
import { getTodayDateKey } from "@/lib/order-planning";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

function sanitizeDateKey(raw: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

/**
 * XPAN-5 — Impressão EM LOTE de todas as folhas de produção de um dia. Cada OP do dia
 * (com demanda real) é uma folha própria, separada por quebra de página, para o chão
 * distribuir uma por operador. Reutiliza `ProductionSheetSections` (mesma folha da
 * impressão individual). `autoPrint` dispara o diálogo de impressão único do navegador.
 */
export default function ProducaoDiaPrintPage() {
  const params = useParams<{ date: string }>();
  const date = sanitizeDateKey(typeof params.date === "string" ? params.date : "");
  const { planningData, isLoading: isPlanningLoading } = useFactoryPlanningSnapshot(date);
  const { snapshot, isLoading: isMasterDataLoading } = useMasterDataSnapshot();

  const dayOps = useMemo(
    () =>
      planningData.productionOrders
        // Só OPs do dia COM demanda real (esqueleto do cronograma não gera folha).
        .filter((op) => op.productionDate === date && op.hasDemand !== false)
        .slice()
        .sort((a, b) => a.lineName.localeCompare(b.lineName) || a.code.localeCompare(b.code)),
    [planningData.productionOrders, date],
  );

  const sheets = useMemo(
    () =>
      dayOps.map((op) => ({
        op,
        document: buildProductionSheetDocument(op, {
          products: snapshot.products,
          ingredients: snapshot.ingredients,
        }),
        deliveryDateLabel: Array.from(new Set(op.sourceItems.map((item) => item.deliveryDateLabel))).join(" · "),
      })),
    [dayOps, snapshot.ingredients, snapshot.products],
  );

  const dayLabel = dayOps[0]?.productionDateLabel ?? date;

  if (isPlanningLoading || isMasterDataLoading) {
    return (
      <PrintDocument
        title="Preparando folhas do dia"
        subtitle="Carregando as ordens de produção do dia para impressão."
      />
    );
  }

  if (sheets.length === 0) {
    return (
      <PrintDocument
        title="Nenhuma folha para o dia"
        subtitle={`Não há ordens de produção com demanda para ${dayLabel}.`}
      />
    );
  }

  return (
    <PrintDocument
      title={`Folhas de produção · ${dayLabel}`}
      variant="industrial"
      autoPrint
      meta={`${sheets.length} folha(s) de produção · Produzir ${dayLabel}`}
    >
      <div className="space-y-4">
        {sheets.map(({ op, document, deliveryDateLabel }, index) => (
          <section
            key={op.id}
            className={index > 0 ? "break-before-page" : undefined}
          >
            <header className="mb-2 border-b-2 border-stone-700 pb-1">
              <h2 className="text-lg font-bold uppercase leading-none text-stone-900">{op.lineName}</h2>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-stone-500">
                {op.code} · Produzir {op.productionDateLabel} · Entregar {deliveryDateLabel}
              </p>
            </header>
            <ProductionSheetSections document={document} />
          </section>
        ))}
      </div>
    </PrintDocument>
  );
}
