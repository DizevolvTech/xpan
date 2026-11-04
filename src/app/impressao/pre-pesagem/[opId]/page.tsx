"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { BatchOpSheets } from "@/components/printing/batch-op-sheet";
import { PrintDocument } from "@/components/printing/print-document";
import { getTodayDateKey } from "@/lib/order-planning";
import { buildPreWeighingDocument } from "@/lib/printing-documents";
import { buildBatchTickets, buildPreWeighingBatchSections } from "@/lib/printing/batch-tickets";
import { findProductionOrderByNavParam } from "@/lib/printing/find-production-order";
import { usePrintWeightUnit } from "@/lib/use-weight-display-unit";
import { WeightUnitToggle } from "@/components/shared/weight-unit-toggle";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

export default function PrePesagemPrintPage() {
  const params = useParams<{ opId: string }>();
  const searchParams = useSearchParams();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { planningData, isLoading: isPlanningLoading } = useFactoryPlanningSnapshot(referenceDate);
  const { snapshot, isLoading: isMasterDataLoading } = useMasterDataSnapshot();
  const { unit: weightUnit, setUnit: setWeightUnit } = usePrintWeightUnit();

  const op = useMemo(
    () => findProductionOrderByNavParam(planningData.productionOrders, opId),
    [opId, planningData.productionOrders],
  );

  const document = useMemo(
    () =>
      op
        ? buildPreWeighingDocument(op, { products: snapshot.products, ingredients: snapshot.ingredients })
        : null,
    [op, snapshot.ingredients, snapshot.products],
  );

  const tickets = useMemo(
    () => (document ? buildBatchTickets(buildPreWeighingBatchSections(document), op?.code ?? "") : []),
    [document, op?.code],
  );

  const deliveryDateLabel = useMemo(() => {
    if (!op) {
      return "-";
    }
    const labels = Array.from(new Set(op.sourceItems.map((item) => item.deliveryDateLabel)));
    return labels.join(" · ");
  }, [op]);

  if (isPlanningLoading || isMasterDataLoading) {
    return (
      <PrintDocument
        title="Preparando pré-pesagem"
        subtitle="Carregando os dados da ordem de produção para impressão."
      />
    );
  }

  if (!op || !document) {
    return (
      <PrintDocument title="Pré-pesagem não encontrada" subtitle="Nenhuma OP foi localizada para esta impressão." />
    );
  }

  return (
    <PrintDocument
      title={op.lineName}
      variant="industrial"
      autoPrint
      toolbar={<WeightUnitToggle value={weightUnit} onChange={setWeightUnit} />}
      meta={`Pré-pesagem · ${op.code} · Produzir ${op.productionDateLabel} · Entregar ${deliveryDateLabel}`}
    >
      <BatchOpSheets tickets={tickets} variant="prepesagem" weight={weightUnit} />
    </PrintDocument>
  );
}
