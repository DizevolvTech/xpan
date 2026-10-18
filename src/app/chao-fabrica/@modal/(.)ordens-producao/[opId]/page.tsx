import { RouteModal } from "@/components/shared/route-modal";

import OrdemProducaoDetailsPage from "../../../ordens-producao/[opId]/page";

export default function OrdemProducaoModal() {
  return (
    <RouteModal title="Detalhe da ordem de produção">
      <OrdemProducaoDetailsPage />
    </RouteModal>
  );
}
