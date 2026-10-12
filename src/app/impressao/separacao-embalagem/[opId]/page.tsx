"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { WeightUnitToggle } from "@/components/shared/weight-unit-toggle";
import { getProductionOrderNavKey } from "@/lib/factory-kanban";
import { getTodayDateKey } from "@/lib/order-planning";
import { buildPackagingSeparationDocument } from "@/lib/printing-documents";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { usePrintWeightUnit } from "@/lib/use-weight-display-unit";
import { formatDisplayQuantity } from "@/lib/weight-display";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

/**
 * Separação de embalagens da OP: só os insumos da receita marcados com esse destino, somados entre
 * os produtos. É uma vista de impressão — consumo, peso e custo continuam vindo da receita.
 */
export default function SeparacaoEmbalagemPrintPage() {
  const params = useParams<{ opId: string }>();
  const searchParams = useSearchParams();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { planningData, isLoading: isPlanningLoading } = useFactoryPlanningSnapshot(referenceDate);
  const { snapshot, isLoading: isMasterDataLoading } = useMasterDataSnapshot();
  const { unit: weightUnit, setUnit: setWeightUnit } = usePrintWeightUnit();

  const op = useMemo(() => {
    const decoded = decodeURIComponent(opId);
    return (
      planningData.productionOrders.find((item) => getProductionOrderNavKey(item) === decoded) ??
      planningData.productionOrders.find((item) => item.id === opId) ??
      null
    );
  }, [opId, planningData.productionOrders]);

  const document = useMemo(
    () =>
      op
        ? buildPackagingSeparationDocument(op, { products: snapshot.products, ingredients: snapshot.ingredients })
        : null,
    [op, snapshot.ingredients, snapshot.products],
  );

  const deliveryDateLabel = useMemo(() => {
    if (!op) {
      return "-";
    }
    return Array.from(new Set(op.sourceItems.map((item) => item.deliveryDateLabel))).join(" · ");
  }, [op]);

  if (isPlanningLoading || isMasterDataLoading) {
    return (
      <PrintDocument
        title="Preparando separação de embalagens"
        subtitle="Carregando os dados da ordem de produção para impressão."
      />
    );
  }

  if (!op || !document) {
    return <PrintDocument title="Separação não encontrada" subtitle="Nenhuma OP foi localizada para esta impressão." />;
  }

  return (
    <PrintDocument
      title={op.lineName}
      variant="industrial"
      autoPrint
      toolbar={<WeightUnitToggle value={weightUnit} onChange={setWeightUnit} />}
      meta={`Separação de embalagens · ${op.code} · Produzir ${op.productionDateLabel} · Entregar ${deliveryDateLabel}`}
    >
      {document.lines.length === 0 ? (
        <p className="border border-stone-300 px-4 py-6 text-sm text-stone-700">
          Nenhum insumo desta OP está marcado para <strong>Separação de embalagens</strong>. A marcação é feita
          em cada linha da ficha técnica do produto, na coluna &ldquo;Imprime em&rdquo;.
        </p>
      ) : (
        <section className="overflow-hidden border border-stone-300">
          <table className="w-full border-collapse">
            <thead className="bg-stone-300">
              <tr>
                <th className="w-12 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
                  OK
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
                  Embalagem / material
                </th>
                <th className="w-40 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
                  Separar
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
                  Usado em
                </th>
              </tr>
            </thead>
            <tbody>
              {document.lines.map((line) => (
                <tr key={line.key} className="print:break-inside-avoid">
                  <td className="border-t border-stone-200 px-3 py-2 align-top text-lg">□</td>
                  <td className="border-t border-stone-200 px-3 py-2 align-top text-sm font-semibold text-stone-900">
                    {line.label}
                  </td>
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
                      .map(
                        (entry) =>
                          `${entry.productName} (${formatDisplayQuantity(entry.quantity, line.unit, weightUnit, { maximumFractionDigits: 3 })})`,
                      )
                      .join(" · ")}
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
