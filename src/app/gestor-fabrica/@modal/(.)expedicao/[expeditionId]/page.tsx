import { RouteModal } from "@/components/shared/route-modal";

import ExpedicaoDetailsPage from "../../../expedicao/[expeditionId]/page";

export default function ExpedicaoModal() {
  return (
    <RouteModal title="Pedido · Expedição">
      <ExpedicaoDetailsPage />
    </RouteModal>
  );
}
