"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import type { PrintIngredientRow } from "@/lib/printing-documents";
import { buildProductionSheetDocument } from "@/lib/printing-documents";
import { getTodayDateKey } from "@/lib/order-planning";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-stone-300 bg-stone-100 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </article>
  );
}

function RecipeTable({
  title,
  rows,
}: {
  title: string;
  rows: PrintIngredientRow[];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden border border-stone-300">
      <header className="bg-stone-300 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-700">{title}</p>
      </header>
      <table className="w-full border-collapse">
        <thead className="bg-white">
          <tr>
            <th className="w-40 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
              Pré pesagem
            </th>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
              Ingredientes
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="border-t border-stone-200 px-3 py-2 text-sm font-semibold text-stone-900">
                {row.estimatedQuantity.toFixed(3)} {row.unit}
              </td>
              <td className="border-t border-stone-200 px-3 py-2 text-sm text-stone-700">
                <div>{row.label}</div>
                {row.notes ? <div className="mt-1 text-xs text-stone-500">{row.notes}</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function ProducaoPrintPage() {
  const params = useParams<{ opId: string }>();
  const searchParams = useSearchParams();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { planningData, isLoading: isPlanningLoading } = useFactoryPlanningSnapshot(referenceDate);
  const { snapshot, isLoading: isMasterDataLoading } = useMasterDataSnapshot();

  const op = useMemo(
    () => planningData.productionOrders.find((item) => item.id === opId) ?? null,
    [opId, planningData.productionOrders],
  );
  const document = useMemo(
    () =>
      op
        ? buildProductionSheetDocument(op, {
            products: snapshot.products,
            ingredients: snapshot.ingredients,
          })
        : null,
    [op, snapshot.ingredients, snapshot.products],
  );
  const deliveryDateLabel = useMemo(() => {
    if (!op) {
      return "-";
    }
    const labels = Array.from(new Set(op.sourceItems.map((item) => item.deliveryDateLabel)));
    return labels.join(" · ");
  }, [op]);

  if (isPlanningLoading || isMasterDataLoading) {
    return (
      <PrintDocument
        title="Preparando folha de produção"
        subtitle="Carregando os dados da ordem de produção para impressão."
      />
    );
  }

  if (!op || !document) {
    return <PrintDocument title="Folha de produção não encontrada" subtitle="Nenhuma OP foi localizada." />;
  }

  return (
    <PrintDocument
      title={op.sectorName}
      subtitle={`${op.lineName} - Padeiro`}
      variant="industrial"
      autoPrint
      meta={
        <>
          <MetaCard label="Documento" value={`Produção · ${op.code}`} />
          <MetaCard label="Produzir" value={op.productionDateLabel} />
          <MetaCard label="Para entregar" value={deliveryDateLabel} />
        </>
      }
    >
      <section className="space-y-4">
        {document.productSections.map((section) => (
          <article key={section.productId} className="overflow-hidden border border-stone-400">
            <header className="grid grid-cols-[96px_84px_1fr_120px_160px] border-b border-stone-400 bg-stone-300 text-stone-900">
              <div className="border-r border-stone-400 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Produto
              </div>
              <div className="border-r border-stone-400 px-3 py-2 text-lg font-bold leading-none">{section.productCode}</div>
              <div className="border-r border-stone-400 px-3 py-2 text-sm font-semibold">{section.productName}</div>
              <div className="border-r border-stone-400 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
                <div>Pedido</div>
                <div className="mt-1 text-base font-bold text-stone-900">
                  {section.requestedQuantity.toFixed(0)} {section.requestedUnit}
                </div>
              </div>
              <div className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
                <div>Carga planejada: {section.plannedKg.toFixed(3)} kg</div>
                <div className="mt-1">Peso unitário: {section.unitWeightKg.toFixed(3)} kg</div>
              </div>
            </header>

            <div className="space-y-2 px-3 py-3">
              <RecipeTable
                title="Ingredientes Base"
                rows={section.items.filter((item) => item.sectionKind !== "additional")}
              />
              <RecipeTable
                title="Ingredientes Adicionais"
                rows={section.items.filter((item) => item.sectionKind === "additional")}
              />
              {section.items.length === 0 ? (
                <div className="border border-dashed border-stone-300 px-3 py-3 text-sm text-stone-500">
                  Este produto não possui receita cadastrada para a folha de produção.
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </PrintDocument>
  );
}
