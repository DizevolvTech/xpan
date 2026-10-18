import { RouteModal } from "@/components/shared/route-modal";

import PedidoDetailsPage from "../../../pedidos/[orderId]/page";

export default function PedidoModal() {
  return (
    <RouteModal title="Detalhe do pedido">
      <PedidoDetailsPage />
    </RouteModal>
  );
}
