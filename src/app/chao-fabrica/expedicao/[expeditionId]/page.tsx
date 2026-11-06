"use client";

import { useParams } from "next/navigation";

import { OrderUnifiedView, resolveOrderIdFromExpeditionParam } from "@/components/orders/order-unified-view";

/** Pedido aberto pela Expedição ou por Entregas do chão: entra na aba Expedição (quadro #317). */
export default function ChaoExpedicaoDetailsPage() {
  const params = useParams<{ expeditionId: string }>();
  const expeditionParam = typeof params.expeditionId === "string" ? decodeURIComponent(params.expeditionId) : "";
  return (
    <OrderUnifiedView
      area="chao-fabrica"
      orderId={resolveOrderIdFromExpeditionParam(expeditionParam)}
      initialTab="expedicao"
    />
  );
}
