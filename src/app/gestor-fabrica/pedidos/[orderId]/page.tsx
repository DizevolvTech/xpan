"use client";

import { useParams } from "next/navigation";

import { OrderUnifiedView } from "@/components/orders/order-unified-view";

/** Pedido aberto por Pedidos: entra no Resumo (aba Expedição ao lado, quadro #317). */
export default function PedidoDetailsPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = typeof params.orderId === "string" ? decodeURIComponent(params.orderId) : "";
  return <OrderUnifiedView area="gestor-fabrica" orderId={orderId} initialTab="resumo" />;
}
