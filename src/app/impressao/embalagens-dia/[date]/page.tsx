"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { WeightUnitToggle } from "@/components/shared/weight-unit-toggle";
import { buildDayPackagingSeparation } from "@/lib/day-packaging-labels";
import { getTodayDateKey } from "@/lib/order-planning";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { usePrintWeightUnit } from "@/lib/use-weight-display-unit";
import { formatDisplayQuantity } from "@/lib/weight-display";

function sanitizeDateKey(raw: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

/**
 * Embalagens do DIA programado: o mesmo insumo (mesma unidade) vindo de todas as OPs do dia vira
 * UMA linha pela quantidade total. Só apresentação — consumo e custo continuam vindo da receita.
 */
export default function EmbalagensDiaPrintPage() {
  const params = useParams<{ date: string }>();
  const date = sanitizeDateKey(typeof params.date === "string" ? params.date : "");
  const { planningData, isLoading: isPlanningLoading } = useFactoryPlanningSnapshot(date);
  const { snapshot, isLoading: isMasterDataLoading } = useMasterDataSnapshot();
  const { unit: weightUnit, setUnit: setWeightUnit } = usePrintWeightUnit();

  const dayOps = useMemo(
    () => planningData.productionOrders.filter((op) => op.productionDate === date && op.hasDemand !== false),
    [planningData.productionOrders, date],
  );
  const lines = useMemo(
    () => buildDayPackagingSeparation(dayOps, { products: snapshot.products, ingredients: snapshot.ingredients }),
    [dayOps, snapshot.ingredients, snapshot.products],
  );
  const dayLabel = dayOps[0]?.productionDateLabel ?? date;

  if (isPlanningLoading || isMasterDataLoading) {
    return <PrintDocument title="Preparando embalagens do dia" subtitle="Carregando as ordens de produção do dia." />;
  }
  if (dayOps.length === 0) {
    return <PrintDocument title="Nenhuma OP no dia" subtitle={`Não há ordens de produção com demanda para ${dayLabel}.`} />;
  }

  return (
    <PrintDocument
      title={`Embalagens do dia · ${dayLabel}`}
      variant="industrial"
      autoPrint
      toolbar={<WeightUnitToggle value={weightUnit} onChange={setWeightUnit} />}
      meta={`${dayOps.length} OP(s) somadas · Produzir ${dayLabel}`}
    >
      {lines.length === 0 ? (
        <p className="border border-stone-300 px-4 py-6 text-sm text-stone-700">
          Nenhum insumo das OPs deste dia está marcado para <strong>Separação de embalagens</strong>. A marcação é
          feita em cada linha da ficha técnica do produto, na coluna &ldquo;Imprime em&rdquo;.
        </p>
      ) : (
        <section className="overflow-hidden border border-stone-300">
          <table className="w-full border-collapse">
            <thead className="bg-stone-300">
              <tr>
                <th className="w-12 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">OK</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">Embalagem / material</th>
                <th className="w-40 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">Total do dia</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">Usado em</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="print:break-inside-avoid">
                  <td className="border-t border-stone-200 px-3 py-2 align-top text-lg">□</td>
                  <td className="border-t border-stone-200 px-3 py-2 align-top text-sm font-semibold text-stone-900">{line.label}</td>
                  <td className="border-t border-stone-200 px-3 py-2 text-right align-top text-sm font-semibold tabular-nums text-stone-900">
                    {formatDisplayQuantity(line.quantity, line.unit, weightUnit, { maximumFractionDigits: 3 })}
                    {line.quantity !== line.exactQuantity ? (
                      <span className="block text-[11px] font-normal text-stone-500">
                        calculado {formatDisplayQuantity(line.exactQuantity, line.unit, weightUnit, { maximumFractionDigits: 3 })}
                      </span>
                    ) : null}
                  </td>
                  <td className="border-t border-stone-200 px-3 py-2 align-top text-xs leading-snug text-stone-600">
                    {line.usedBy
                      .map((entry) => `${entry.productName} (${formatDisplayQuantity(entry.quantity, line.unit, weightUnit, { maximumFractionDigits: 3 })})`)
                      .join(" · ")}
                    {line.opCount > 1 ? <span className="block font-semibold text-stone-500">{line.opCount} OPs somadas</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </PrintDocument>
  );
}
