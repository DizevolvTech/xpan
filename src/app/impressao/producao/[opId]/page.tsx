"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { applyFactoryWorkflowState, useFactoryWorkflowState } from "@/lib/factory-order-status";
import { buildFactoryPlanningData, getTodayDateKey } from "@/lib/order-planning";

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

export default function ProducaoPrintPage() {
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

  if (!op) {
    return <PrintDocument title="Folha de produção não encontrada" subtitle="Nenhuma OP foi localizada." />;
  }

  return (
    <PrintDocument
      title={`Produção · ${op.code}`}
      subtitle="Folha operacional da linha executora, consolidada por produto."
      meta={
        <>
          <MetaCard label="Data de produção" value={op.productionDateLabel} />
          <MetaCard label="Categoria / Subcategoria" value={`${op.sectorName} / ${op.lineName}`} />
          <MetaCard label="Linha executora" value={op.scheduleName} />
        </>
      }
    >
      <section className="overflow-hidden rounded-xl border border-stone-200">
        <table className="w-full border-collapse">
          <thead className="bg-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Produto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Carga (Kg)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Progresso atual</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Conferência</th>
            </tr>
          </thead>
          <tbody>
            {op.items.map((item) => (
              <tr key={item.productId}>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-900">
                  {item.productCode} · {item.productName}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.totalKg}</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.progress.toFixed(1)}%</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.status}</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-400">______________________</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">Pedidos atendidos por esta OP</h2>
        <div className="overflow-hidden rounded-xl border border-stone-200">
          <table className="w-full border-collapse">
            <thead className="bg-stone-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Pedido</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Loja</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Qtd loja</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Kg</th>
              </tr>
            </thead>
            <tbody>
              {op.sourceItems.map((item) => (
                <tr key={item.id}>
                  <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-900">{item.orderCode}</td>
                  <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.storeName}</td>
                  <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                    {item.productCode} · {item.productName}
                  </td>
                  <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                    {item.requestedQuantity} {item.requestedUnit}
                  </td>
                  <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.internalKg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PrintDocument>
  );
}
