"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { buildDayLabels } from "@/lib/day-packaging-labels";
import { getTodayDateKey } from "@/lib/order-planning";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { formatLocaleNumber } from "@/lib/utils";

function sanitizeDateKey(raw: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

/**
 * Etiquetas do DIA programado: uma por produto/sabor, com a quantidade total programada. Não há
 * validade nem lote no sistema, então a etiqueta traz nome, código do cliente, data de produção,
 * quantidade e o peso da etiqueta quando o teste de laboratório o tem.
 */
export default function EtiquetasDiaPrintPage() {
  const params = useParams<{ date: string }>();
  const date = sanitizeDateKey(typeof params.date === "string" ? params.date : "");
  const { planningData, isLoading: isPlanningLoading } = useFactoryPlanningSnapshot(date);
  const { snapshot, isLoading: isMasterDataLoading } = useMasterDataSnapshot();

  const dayOps = useMemo(
    () => planningData.productionOrders.filter((op) => op.productionDate === date && op.hasDemand !== false),
    [planningData.productionOrders, date],
  );
  const labels = useMemo(
    () => buildDayLabels(dayOps, { products: snapshot.products, ingredients: snapshot.ingredients }),
    [dayOps, snapshot.ingredients, snapshot.products],
  );
  const dayLabel = dayOps[0]?.productionDateLabel ?? date;

  if (isPlanningLoading || isMasterDataLoading) {
    return <PrintDocument title="Preparando etiquetas do dia" subtitle="Carregando as ordens de produção do dia." />;
  }
  if (labels.length === 0) {
    return <PrintDocument title="Nenhuma etiqueta no dia" subtitle={`Não há produtos programados para ${dayLabel}.`} />;
  }

  return (
    <PrintDocument
      title={`Etiquetas do dia · ${dayLabel}`}
      variant="industrial"
      autoPrint
      meta={`${labels.length} produto(s) · Produzir ${dayLabel}`}
    >
      <div className="grid grid-cols-2 gap-3 print:gap-2">
        {labels.map((label) => (
          <article
            key={`${label.productId}-${label.unit}`}
            className="flex min-h-40 flex-col justify-between border-2 border-stone-800 p-3 print:break-inside-avoid"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">{label.code}</p>
              <h2 className="text-lg font-bold uppercase leading-tight text-stone-900">{label.productName}</h2>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase text-stone-500">Quantidade</p>
                <p className="text-3xl font-bold tabular-nums leading-none text-stone-900">
                  {formatLocaleNumber(label.quantity)} <span className="text-base font-semibold">{label.unit}</span>
                </p>
              </div>
              <div className="text-right text-xs text-stone-700">
                <p>Produção: {dayLabel}</p>
                {label.labelWeightKg ? <p>Peso: {formatLocaleNumber(label.labelWeightKg)} kg</p> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </PrintDocument>
  );
}
