import { RouteModal } from "@/components/shared/route-modal";

import PedidoLojaDetailsPage from "../../../pedidos/[orderId]/page";

export default function PedidoLojaModal() {
  return (
    <RouteModal title="Detalhe do pedido">
      <PedidoLojaDetailsPage />
    </RouteModal>
  );
}
