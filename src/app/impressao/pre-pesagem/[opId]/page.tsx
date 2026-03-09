"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { applyFactoryWorkflowState, useFactoryWorkflowState } from "@/lib/factory-order-status";
import { buildFactoryPlanningData, getTodayDateKey } from "@/lib/order-planning";
import { buildPreWeighingDocument } from "@/lib/printing-documents";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </article>
  );
}

export default function PrePesagemPrintPage() {
  const params = useParams<{ opId: string }>();
  const searchParams = useSearchParams();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const workflow = useFactoryWorkflowState(referenceDate);

  const planningData = useMemo(
    () =>
      applyFactoryWorkflowState(buildFactoryPlanningData(referenceDate), {
        isReleased: workflow.isReleased,
        resolveProductionItemStatus: workflow.resolveProductionItemStatus,
      }),
    [referenceDate, workflow.isReleased, workflow.resolveProductionItemStatus],
  );

  const op = useMemo(
    () => planningData.productionOrders.find((item) => item.id === opId) ?? null,
    [opId, planningData.productionOrders],
  );
  const document = useMemo(() => (op ? buildPreWeighingDocument(op) : null), [op]);

  if (!op || !document) {
    return (
      <PrintDocument title="Pré-pesagem não encontrada" subtitle="Nenhuma OP foi localizada para esta impressão." />
    );
  }

  return (
    <PrintDocument
      title={`Pré-pesagem · ${op.code}`}
      subtitle="Agrupamento por produto e bases/MPI compartilhados para separar insumos antes da produção."
      meta={
        <>
          <MetaCard label="Produção" value={op.productionDateLabel} />
          <MetaCard label="Categoria / Subcategoria" value={`${op.sectorName} / ${op.lineName}`} />
          <MetaCard label="Linha executora" value={op.scheduleName} />
        </>
      }
    >
      {document.sharedPreparations.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Bases e MPI compartilhados</h2>
          <div className="overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full border-collapse">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Base / MPI</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Qtd estimada</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Usado por</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Observação</th>
                </tr>
              </thead>
              <tbody>
                {document.sharedPreparations.map((item) => (
                  <tr key={item.key}>
                    <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-900">{item.label}</td>
                    <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                      {item.estimatedQuantity} {item.unit}
                    </td>
                    <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.usedBy.join(", ")}</td>
                    <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-600">{item.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900">Separação por produto</h2>
        {document.productGroups.map((group) => (
          <article key={group.productId} className="overflow-hidden rounded-xl border border-stone-200">
            <header className="flex items-center justify-between gap-3 bg-stone-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  {group.productCode} · {group.productName}
                </p>
                <p className="text-xs text-stone-600">Carga planejada: {group.plannedKg} Kg</p>
              </div>
              <div className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-stone-700">
                Conferido
              </div>
            </header>

            <table className="w-full border-collapse">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Ingrediente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Qtd estimada</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Observação</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.key}>
                    <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-900">{item.label}</td>
                    <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                      {item.estimatedQuantity} {item.unit}
                    </td>
                    <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                      {item.sourceType === "produto" ? "MPI / Base" : "Ingrediente"}
                    </td>
                    <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-600">{item.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </section>
    </PrintDocument>
  );
}
