"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { aggregateOrderItems } from "@/lib/order-item-aggregation";
import { getTodayDateKey } from "@/lib/order-planning";
import type { StoreOrderDetail } from "@/lib/store-order-types";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useStoreOrderDetail } from "@/lib/use-store-orders";

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

type FallbackPrintRow = {
  key: string;
  productCode: string;
  productName: string;
  requestedQuantity: number;
  requestedUnit: string;
  internalKgLabel: string;
  productionLabel: string;
  lineLabel: string;
};

function buildFallbackRows(order: StoreOrderDetail | null): FallbackPrintRow[] {
  if (!order) {
    return [];
  }

  const groupedItems = new Map<string, FallbackPrintRow>();

  order.items.forEach((item) => {
    const key = `${item.code}|${item.unit}|${item.category}`;
    const existing = groupedItems.get(key);

    if (existing) {
      existing.requestedQuantity = Number((existing.requestedQuantity + item.quantity).toFixed(2));
      return;
    }

    groupedItems.set(key, {
      key,
      productCode: item.code,
      productName: item.name,
      requestedQuantity: item.quantity,
      requestedUnit: item.unit,
      internalKgLabel: "-",
      productionLabel: "Sem agenda na referência",
      lineLabel: item.category,
    });
  });

  return Array.from(groupedItems.values()).sort((left, right) => left.productCode.localeCompare(right.productCode));
}

export default function PedidoLojaPrintPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { planningData, isLoading } = useFactoryPlanningSnapshot(referenceDate);
  const {
    order: persistedOrder,
    isLoading: isDetailLoading,
  } = useStoreOrderDetail(orderId, referenceDate);

  const planningOrder = useMemo(
    () => planningData.orders.find((item) => item.id === orderId) ?? null,
    [orderId, planningData.orders],
  );
  const planningItems = useMemo(
    () => aggregateOrderItems(planningData.orderItems.filter((item) => item.orderId === orderId)),
    [orderId, planningData.orderItems],
  );
  const fallbackRows = useMemo(() => buildFallbackRows(persistedOrder), [persistedOrder]);
  const rows = planningItems.length > 0
    ? planningItems.map((item) => ({
        key: item.aggregationKey,
        productCode: item.productCode,
        productName: item.productName,
        requestedQuantity: item.requestedQuantity,
        requestedUnit: item.requestedUnit,
        internalKgLabel: String(item.internalKg),
        productionLabel: item.productionDate ?? "Sem agenda",
        lineLabel: item.scheduleName,
      }))
    : fallbackRows;
  const meta = useMemo(() => {
    const storeName = planningOrder?.storeName ?? persistedOrder?.store ?? "-";
    const deliveryLabel = planningOrder?.deliveryDateLabel ?? persistedOrder?.deliveryDate ?? "-";
    const statusLabel = planningOrder
      ? `${planningOrder.workflowProgress.toFixed(1)}% · ${planningOrder.status}`
      : persistedOrder
        ? "Pedido persistido"
        : "-";

    return {
      code: planningOrder?.code ?? persistedOrder?.code ?? orderId,
      storeName,
      deliveryLabel,
      statusLabel,
    };
  }, [orderId, persistedOrder, planningOrder]);

  if (isLoading || isDetailLoading) {
    return (
      <PrintDocument
        title="Preparando pedido da loja"
        subtitle="Carregando os dados do pedido para impressão."
      />
    );
  }

  if (!planningOrder && !persistedOrder) {
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
      title={`Pedido da Loja · ${meta.code}`}
      subtitle="Espelho do pedido solicitado pela loja, sem roteirização e sem nota de transferência."
      autoPrint
      meta={
        <>
          <MetaCard label="Loja" value={meta.storeName} />
          <MetaCard label="Recebimento" value={meta.deliveryLabel} />
          <MetaCard label="Status" value={meta.statusLabel} />
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
            {rows.map((item) => (
              <tr key={item.key}>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-900">
                  {item.productCode} · {item.productName}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                  {item.requestedQuantity} {item.requestedUnit}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.internalKgLabel}</td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">
                  {item.productionLabel}
                </td>
                <td className="border-t border-stone-200 px-4 py-3 text-sm text-stone-700">{item.lineLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintDocument>
  );
}
