import { BatchOpSheets } from "@/components/printing/batch-op-sheet";
import type { ProductionSheetDocument } from "@/lib/printing-documents";
import { buildBatchTickets, buildProductionBatchSections } from "@/lib/printing/batch-tickets";
import type { WeightDisplayUnit } from "@/lib/weight-display";

/**
 * Folha de produção A4 de uma OP: UMA OP POR BATIDA (cartão #237), MPI primeiro (batido antes de os
 * produtos o consumirem) e depois cada produto — o mesmo padrão da ficha 80 mm. Reutilizada na
 * impressão individual (`/impressao/producao/[opId]`) e na do dia (`/impressao/producao-dia/[date]`).
 */
export function ProductionSheetSections({
  document,
  weight = "kg",
  opCode = "",
}: {
  document: ProductionSheetDocument;
  /** Unidade de exibição do peso (kg ou g). Só apresentação; padrão kg. */
  weight?: WeightDisplayUnit;
  opCode?: string;
}) {
  const tickets = buildBatchTickets(buildProductionBatchSections(document), opCode);
  return <BatchOpSheets tickets={tickets} variant="producao" weight={weight} />;
}
