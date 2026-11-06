"use client";

import { useParams } from "next/navigation";

import { OrderUnifiedView, resolveOrderIdFromExpeditionParam } from "@/components/orders/order-unified-view";

/** Pedido aberto pela Expedição: entra direto na aba Expedição, com o checklist (quadro #317). */
export default function ExpedicaoDetailsPage() {
  const params = useParams<{ expeditionId: string }>();
  const expeditionParam = typeof params.expeditionId === "string" ? decodeURIComponent(params.expeditionId) : "";
  return (
    <OrderUnifiedView
      area="gestor-fabrica"
      orderId={resolveOrderIdFromExpeditionParam(expeditionParam)}
      initialTab="expedicao"
    />
  );
}
