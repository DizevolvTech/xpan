import { RouteModal } from "@/components/shared/route-modal";

import ChaoExpedicaoDetailsPage from "../../../expedicao/[expeditionId]/page";

export default function ChaoExpedicaoModal() {
  return (
    <RouteModal title="Pedido · Expedição">
      <ChaoExpedicaoDetailsPage />
    </RouteModal>
  );
}
