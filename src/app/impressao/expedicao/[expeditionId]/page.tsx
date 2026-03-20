"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { PrintDocument } from "@/components/printing/print-document";
import { aggregateExpeditionItems } from "@/lib/expedition-aggregation";
import { useDeliveryExecution } from "@/lib/delivery-execution";
import { getTodayDateKey } from "@/lib/order-planning";
import { formatKgLabel, formatKgValue } from "@/lib/utils";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";

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

function getChecklistItemKey(item: ReturnType<typeof aggregateExpeditionItems>[number]) {
  return `${item.productId}|${item.requestedUnit}|${item.expeditionUnit}`;
}

export default function ExpedicaoPrintPage() {
  const params = useParams<{ expeditionId: string }>();
  const searchParams = useSearchParams();
  const expeditionId = typeof params.expeditionId === "string" ? params.expeditionId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { planningData, isLoading } = useFactoryPlanningSnapshot(referenceDate);
  const deliveryExecutionState = useDeliveryExecution(referenceDate);

  const expedition = useMemo(
    () => planningData.expedition.find((item) => item.id === expeditionId) ?? null,
    [expeditionId, planningData.expedition],
  );
  const aggregatedItems = useMemo(() => aggregateExpeditionItems(expedition?.items ?? []), [expedition?.items]);
  const execution = useMemo(
    () =>
      expedition
        ? deliveryExecutionState.resolveExecution(expedition.orderId, expedition.status === "aguardando_expedicao")
        : null,
    [deliveryExecutionState, expedition],
  );
  const checkedCount = useMemo(
    () =>
      aggregatedItems.filter((item) => {
        if (execution?.status && execution.status !== "aguardando_expedicao") {
          return true;
        }

        return execution?.checklistState[getChecklistItemKey(item)] === true;
      }).length,
    [aggregatedItems, execution],
  );

  if (isLoading || !deliveryExecutionState.isHydrated) {
    return (
      <PrintDocument
        title="Preparando checklist de expedição"
        subtitle="Carregando os dados do pedido e o status da conferência para impressão."
      />
    );
  }

  if (!expedition) {
    return <PrintDocument title="Checklist de expedição não encontrado" subtitle="Nenhum pedido foi localizado." />;
  }

  return (
    <PrintDocument
      title={`Expedição · ${expedition.orderCode}`}
      subtitle="Checklist por loja e pedido, sem roteirização e sem nota de transferência."
      autoPrint
      meta={
        <>
          <MetaCard label="Loja" value={expedition.storeName} />
          <MetaCard label="Recebimento" value={expedition.deliveryDateLabel} />
          <MetaCard label="Carga" value={formatKgLabel(expedition.totalKg)} />
          <MetaCard label="Conferidos" value={`${checkedCount}/${aggregatedItems.length} itens`} />
        </>
      }
    >
      <section className="overflow-hidden rounded-xl border border-stone-200">
        <table className="w-full border-collapse">
          <thead className="bg-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Produto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Qtd pedida</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Kg interno</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Qtd expedição</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Conferido</th>
            </tr>
          </thead>
          <tbody>
            {aggregatedItems.map((item) => (
              <tr key={`${item.productId}-${item.requestedUnit}-${item.expeditionUnit}`}>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-900">
                  {item.productCode} · {item.productName}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                  {item.requestedQuantity} {item.requestedUnit}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{formatKgValue(item.internalKg)}</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                  {item.expeditionQuantity} {item.expeditionUnit}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm">
                  {execution?.status !== "aguardando_expedicao" ||
                  execution?.checklistState[getChecklistItemKey(item)] === true ? (
                    <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                      <CheckCircle2 className="size-4" />
                      Conferido
                    </span>
                  ) : (
                    <span className="text-stone-400">______________________</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PrintDocument>
  );
}
