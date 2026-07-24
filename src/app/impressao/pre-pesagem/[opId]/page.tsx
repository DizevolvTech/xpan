"use client";

import { Fragment, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PrintDocument } from "@/components/printing/print-document";
import type { PrintIngredientRow } from "@/lib/printing-documents";
import { groupPrintRowsByStage } from "@/lib/printing-documents";
import type { PreWeighBatchSplit } from "@/lib/production-batches";
import { getProductionOrderNavKey } from "@/lib/factory-kanban";
import { getTodayDateKey } from "@/lib/order-planning";
import { buildPreWeighingDocument } from "@/lib/printing-documents";
import { formatKgValue, formatLocaleNumber } from "@/lib/utils";
import { useFactoryPlanningSnapshot } from "@/lib/use-factory-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

function sanitizeDateKey(raw: string | null) {
  if (!raw) {
    return getTodayDateKey();
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getTodayDateKey();
}

type RecipeTableRow = PrintIngredientRow & { isAdditional?: boolean };

function IngredientCell({ row }: { row: RecipeTableRow }) {
  return (
    <td className="border-t border-stone-200 px-3 py-2 text-sm text-stone-700">
      <div className="flex items-baseline gap-2">
        <span>{row.label}</span>
        {row.isAdditional ? (
          <span className="shrink-0 border border-stone-400 px-1 text-[9px] font-semibold uppercase tracking-wide text-stone-500">
            Adic.
          </span>
        ) : null}
      </div>
      {row.notes ? <div className="mt-1 text-xs text-stone-500">{row.notes}</div> : null}
    </td>
  );
}

function formatWeightCell(value: number | undefined, unit: string) {
  if (value == null) {
    return "—";
  }
  return `${formatLocaleNumber(value, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${unit}`;
}

function RecipeTable({
  rows,
  batchSplit,
}: {
  rows: RecipeTableRow[];
  batchSplit?: PreWeighBatchSplit | null;
}) {
  if (rows.length === 0) {
    return null;
  }

  const isBatched = Boolean(batchSplit?.batched);
  const showBatchColumn = isBatched && (batchSplit?.fullBatchCount ?? 0) > 0;
  const showPartialColumn = isBatched && (batchSplit?.partialUnits ?? 0) > 0;

  if (!isBatched) {
    return (
      <section className="overflow-hidden border border-stone-300">
        <table className="w-full border-collapse">
          <thead className="bg-stone-300">
            <tr>
              <th className="w-40 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
                Pré pesagem
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
                Ingredientes
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="border-t border-stone-200 px-3 py-2 text-sm font-semibold text-stone-900">
                  {formatLocaleNumber(row.estimatedQuantity, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {row.unit}
                </td>
                <IngredientCell row={row} />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  return (
    <section className="overflow-hidden border border-stone-300">
      <table className="w-full border-collapse">
        <thead className="bg-stone-300">
          <tr>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
              Ingredientes
            </th>
            {showBatchColumn ? (
              <th className="w-40 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
                Batida ×{batchSplit?.fullBatchCount}
              </th>
            ) : null}
            {showPartialColumn ? (
              <th className="w-40 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
                Parcial
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <IngredientCell row={row} />
              {showBatchColumn ? (
                <td className="border-t border-stone-200 px-3 py-2 text-sm font-semibold text-stone-900">
                  {formatWeightCell(row.batchQuantity, row.unit)}
                </td>
              ) : null}
              {showPartialColumn ? (
                <td className="border-t border-stone-200 px-3 py-2 text-sm font-semibold text-stone-900">
                  {formatWeightCell(row.partialQuantity, row.unit)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Blocos da receita por ETAPA, na ordem canônica. Receita não migrada volta como um
 * único grupo sem cabeçalho — a impressão sai idêntica à de hoje.
 */
function StagedRecipeTables({
  rows,
  batchSplit,
}: {
  rows: RecipeTableRow[];
  batchSplit?: PreWeighBatchSplit | null;
}) {
  return (
    <>
      {groupPrintRowsByStage(rows).map((group) => (
        <Fragment key={group.stage}>
          {group.showStageHeader ? (
            <div className="border-b border-stone-300 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-600">
              {group.label}
            </div>
          ) : null}
          <RecipeTable rows={group.rows} batchSplit={batchSplit} />
        </Fragment>
      ))}
    </>
  );
}

function formatBatchLegend(split: PreWeighBatchSplit) {
  const fullKg = formatKgValue(split.fullBatchKg, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const partialKg = formatKgValue(split.partialKg, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const hasPartial = split.partialUnits > 0;

  if (split.fullBatchCount === 0) {
    return `1 parcial de ${partialKg} kg`;
  }

  const fullPart = `${split.fullBatchCount} ${split.fullBatchCount === 1 ? "cheia" : "cheias"} de ${fullKg} kg`;
  if (!hasPartial) {
    return fullPart;
  }
  return `${fullPart} + 1 parcial de ${partialKg} kg`;
}

export default function PrePesagemPrintPage() {
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
        ? buildPreWeighingDocument(op, { products: snapshot.products, ingredients: snapshot.ingredients })
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
      meta={`Pré-pesagem · ${op.code} · Produzir ${op.productionDateLabel} · Entregar ${deliveryDateLabel}`}
    >
      {document.ingredientProducts.length > 0 ? (
        <section className="space-y-3 print:space-y-1.5">
          {document.ingredientProducts.map((section) => (
            // Chave inclui a etapa: o mesmo MPI pode render duas seções (ex.: recheio e cobertura).
            <article
              key={`${section.productId}-${section.stage}`}
              className="overflow-hidden border border-stone-400"
            >
              <header className="grid grid-cols-[132px_84px_1fr_180px] border-b border-stone-400 bg-stone-300 text-stone-900">
                <div className="border-r border-stone-400 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Produto Ingrediente
                </div>
                <div className="border-r border-stone-400 px-3 py-2 text-lg font-bold leading-none">{section.productCode}</div>
                <div className="border-r border-stone-400 px-3 py-2 text-sm font-semibold">
                  {section.productName}
                  {section.stageLabel ? (
                    <span className="ml-2 border border-stone-400 px-1 text-[9px] font-semibold uppercase tracking-wide text-stone-600">
                      {section.stageLabel}
                    </span>
                  ) : null}
                </div>
                <div className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
                  <div>Peso finalizado: {formatKgValue(section.requiredKg, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</div>
                </div>
              </header>

              <div className="space-y-2 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.08em] text-stone-500">
                  Usado por: {section.usedBy.join(", ")}
                </div>
                <StagedRecipeTables rows={section.items} />
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="space-y-3 print:space-y-1.5">
        {document.productSections.map((section) => (
          <article key={section.productId} className="overflow-hidden border border-stone-400">
            <header className="grid grid-cols-[96px_84px_1fr_120px_160px] border-b border-stone-400 bg-stone-300 text-stone-900">
              <div className="border-r border-stone-400 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Produto
              </div>
              <div className="border-r border-stone-400 px-3 py-2 text-lg font-bold leading-none">{section.productCode}</div>
              <div className="border-r border-stone-400 px-3 py-2 text-sm font-semibold">{section.productName}</div>
              <div className="border-r border-stone-400 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
                <div>Pedido</div>
                <div className="mt-1 text-base font-bold text-stone-900">
                  {section.requestedQuantity.toFixed(0)} {section.requestedUnit}
                </div>
              </div>
              <div className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
                <div>Carga planejada: {formatKgValue(section.plannedKg, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</div>
                <div className="mt-1">Peso unitário: {formatKgValue(section.unitWeightKg, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</div>
              </div>
            </header>

            <div className="space-y-2 px-3 py-3">
              {section.batchSplit?.batched ? (
                <div className="text-[11px] uppercase tracking-[0.08em] text-stone-500">
                  {formatBatchLegend(section.batchSplit)}
                </div>
              ) : null}
              <StagedRecipeTables
                rows={[
                  ...section.baseIngredients,
                  ...section.additionalIngredients.map((row) => ({ ...row, isAdditional: true })),
                ]}
                batchSplit={section.batchSplit}
              />
              {section.baseIngredients.length === 0 && section.additionalIngredients.length === 0 ? (
                <div className="border border-dashed border-stone-300 px-3 py-3 text-sm text-stone-500">
                  Este produto consome somente produto ingrediente destacado abaixo.
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </PrintDocument>
  );
}
