"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { aggregateOrderItems } from "@/lib/order-item-aggregation";
import { getTodayDateKey } from "@/lib/order-planning";
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

export default function PedidoLojaPrintPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { planningData, isLoading } = useFactoryPlanningSnapshot(referenceDate);

  const planningOrder = useMemo(
    () => planningData.orders.find((item) => item.id === orderId) ?? null,
    [orderId, planningData.orders],
  );
  const planningItems = useMemo(
    () => aggregateOrderItems(planningData.orderItems.filter((item) => item.orderId === orderId)),
    [orderId, planningData.orderItems],
  );

  if (isLoading) {
    return (
      <PrintDocument
        title="Preparando pedido da loja"
        subtitle="Carregando os dados do pedido para impressão."
      />
    );
  }

  if (!planningOrder) {
    return (
      <PrintDocument title="Pedido não encontrado" subtitle="Nenhum pedido foi localizado para esta impressão.">
        <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Verifique o identificador do pedido e a data de referência utilizada na abertura da impressão.
        </p>
      </PrintDocument>
    );
  }

  return (
    <PrintDocument
      title={`Pedido da Loja · ${planningOrder.code}`}
      subtitle="Espelho do pedido solicitado pela loja, sem roteirização e sem nota de transferência."
      autoPrint
      meta={
        <>
          <MetaCard label="Loja" value={planningOrder.storeName} />
          <MetaCard label="Recebimento" value={planningOrder.deliveryDateLabel} />
          <MetaCard label="Status" value={`${planningOrder.workflowProgress.toFixed(1)}% · ${planningOrder.status}`} />
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-stone-200">
        <table className="w-full border-collapse">
          <thead className="bg-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Produto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Qtd solicitada</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Kg interno</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Produção</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Linha</th>
            </tr>
          </thead>
          <tbody>
            {planningItems.map((item) => (
              <tr key={item.aggregationKey}>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-900">
                  {item.productCode} · {item.productName}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                  {item.requestedQuantity} {item.requestedUnit}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.internalKg}</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                  {item.productionDate ?? "Sem agenda"}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.scheduleName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintDocument>
  );
}
