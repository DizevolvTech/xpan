"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import { ProductionSheetSections } from "@/components/printing/production-sheet";
import { buildProductionSheetDocument } from "@/lib/printing-documents";
import { getProductionOrderNavKey } from "@/lib/factory-kanban";
import { getTodayDateKey } from "@/lib/order-planning";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

export default function ProducaoPrintPage() {
  const params = useParams<{ opId: string }>();
  const searchParams = useSearchParams();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { planningData, isLoading: isPlanningLoading } = useFactoryPlanningSnapshot(referenceDate);
  const { snapshot, isLoading: isMasterDataLoading } = useMasterDataSnapshot();

  const op = useMemo(() => {
    const decoded = decodeURIComponent(opId);
    return (
      planningData.productionOrders.find((item) => getProductionOrderNavKey(item) === decoded) ??
      planningData.productionOrders.find((item) => item.id === opId) ??
      null
    );
  }, [opId, planningData.productionOrders]);
  const document = useMemo(
    () =>
      op
        ? buildProductionSheetDocument(op, {
            products: snapshot.products,
            ingredients: snapshot.ingredients,
          })
        : null,
    [op, snapshot.ingredients, snapshot.products],
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
        title="Preparando folha de produção"
        subtitle="Carregando os dados da ordem de produção para impressão."
      />
    );
  }

  if (!op || !document) {
    return <PrintDocument title="Folha de produção não encontrada" subtitle="Nenhuma OP foi localizada." />;
  }

  return (
    <PrintDocument
      title={op.lineName}
      variant="industrial"
      autoPrint
      meta={`Produção · ${op.code} · Produzir ${op.productionDateLabel} · Entregar ${deliveryDateLabel}`}
    >
      <ProductionSheetSections document={document} />
    </PrintDocument>
  );
}
