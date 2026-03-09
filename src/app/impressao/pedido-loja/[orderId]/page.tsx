"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { aggregateOrderItems } from "@/lib/order-item-aggregation";
import { applyFactoryWorkflowState, useFactoryWorkflowState } from "@/lib/factory-order-status";
import { buildFactoryPlanningData, getTodayDateKey } from "@/lib/order-planning";
import { getStoreOrderById } from "@/lib/store-orders-mock";

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
  const workflow = useFactoryWorkflowState(referenceDate);

  const planningData = useMemo(
    () =>
      applyFactoryWorkflowState(buildFactoryPlanningData(referenceDate), {
        isReleased: workflow.isReleased,
        resolveProductionItemStatus: workflow.resolveProductionItemStatus,
      }),
    [referenceDate, workflow.isReleased, workflow.resolveProductionItemStatus],
  );

  const planningOrder = useMemo(
    () => planningData.orders.find((item) => item.id === orderId) ?? null,
    [orderId, planningData.orders],
  );
  const planningItems = useMemo(
    () => aggregateOrderItems(planningData.orderItems.filter((item) => item.orderId === orderId)),
    [orderId, planningData.orderItems],
  );
  const storeOrder = useMemo(() => getStoreOrderById(orderId), [orderId]);

  if (!planningOrder && !storeOrder) {
    return (
      <PrintDocument title="Pedido não encontrado" subtitle="Nenhum pedido foi localizado para esta impressão.">
        <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Verifique o identificador do pedido e a data de referência utilizada na abertura da impressão.
        </p>
      </PrintDocument>
    );
  }

  if (planningOrder) {
    return (
      <PrintDocument
        title={`Pedido da Loja · ${planningOrder.code}`}
        subtitle="Espelho do pedido solicitado pela loja, sem roteirização e sem nota de transferência."
        meta={
          <>
            <MetaCard label="Loja" value={planningOrder.storeName} />
            <MetaCard label="Recebimento" value={planningOrder.deliveryDateLabel} />
            <MetaCard label="Status" value={`${planningOrder.workflowProgress.toFixed(1)}% · ${planningOrder.status}`} />
          </>
        }
      >
        <section className="space-y-3">
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            <strong className="text-stone-900">Referência operacional:</strong> {referenceDate}. Os itens abaixo refletem a
            quantidade pedida pela loja e a conversão interna calculada para a fábrica.
          </div>

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
        </section>
      </PrintDocument>
    );
  }

  return (
    <PrintDocument
      title={`Pedido da Loja · ${storeOrder!.code}`}
      subtitle="Espelho do pedido solicitado pela loja."
      meta={
        <>
          <MetaCard label="Loja" value={storeOrder!.store} />
          <MetaCard label="Entrega" value={storeOrder!.deliveryDate} />
          <MetaCard label="Status" value={storeOrder!.status} />
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-stone-200">
        <table className="w-full border-collapse">
          <thead className="bg-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Código</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Produto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Categoria</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Unidade</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-stone-500">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {storeOrder!.items.map((item) => (
              <tr key={item.id}>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-900">{item.code}</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.name}</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.category}</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.unit}</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintDocument>
  );
}
