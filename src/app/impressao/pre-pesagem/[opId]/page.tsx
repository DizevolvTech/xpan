"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PrintDocument } from "@/components/printing/print-document";
import type { PrintIngredientRow } from "@/lib/printing-documents";
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

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-stone-300 bg-stone-100 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </article>
  );
}

function RecipeTable({ rows }: { rows: (PrintIngredientRow & { isAdditional?: boolean })[] }) {
  if (rows.length === 0) {
    return null;
  }

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
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function PrePesagemPrintPage() {
  const params = useParams<{ opId: string }>();
  const searchParams = useSearchParams();
  const opId = typeof params.opId === "string" ? params.opId : "";
  const referenceDate = sanitizeDateKey(searchParams.get("ref"));
  const { planningData, isLoading: isPlanningLoading, refresh } = useFactoryPlanningSnapshot(referenceDate);
  const { snapshot, isLoading: isMasterDataLoading } = useMasterDataSnapshot();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const sendBatch = useCallback(
    async (
      productionItemKey: string,
      action: "complete-production-batch" | "undo-production-batch",
      batchCount: number,
    ) => {
      setPendingKey(productionItemKey);
      try {
        const res = await fetch("/api/factory-planning/workflow", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "complete-production-batch"
              ? { action, productionItemKey, batchCount }
              : { action, productionItemKey },
          ),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? "Falha ao atualizar a batida.");
        }
        await refresh();
      } finally {
        setPendingKey(null);
      }
    },
    [refresh],
  );

  const op = useMemo(() => {
    const decoded = decodeURIComponent(opId);
    return (
      planningData.productionOrders.find((item) => getProductionOrderNavKey(item) === decoded) ??
      planningData.productionOrders.find((item) => item.id === opId) ??
      null
    );
  }, [opId, planningData.productionOrders]);
  const batchKgByProductId = useMemo(() => {
    const map: Record<string, number> = {};
    if (!op) return map;
    for (const item of op.items) {
      // Só produto batido e ainda não concluído: escala a receita pela batida atual.
      if (item.batchCount <= 1 || item.batchesDone >= item.batchCount) continue;
      const currentIdx = Math.min(item.batchesDone, item.batchCount - 1);
      const currentSize = item.batchSizes[currentIdx] ?? 0;
      const product = snapshot.products.find((p) => p.id === item.productId);
      if (product) {
        map[item.productId] = currentSize * product.salesToKgFactor;
      }
    }
    return map;
  }, [op, snapshot.products]);

  const document = useMemo(
    () =>
      op
        ? buildPreWeighingDocument(
            op,
            { products: snapshot.products, ingredients: snapshot.ingredients },
            batchKgByProductId,
          )
        : null,
    [op, snapshot.ingredients, snapshot.products, batchKgByProductId],
  );
  const itemByProduct = useMemo(() => {
    const map = new Map<string, NonNullable<typeof op>["items"][number]>();
    op?.items.forEach((it) => map.set(it.productId, it));
    return map;
  }, [op]);

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
      title={op.sectorName}
      subtitle={op.lineName}
      variant="industrial"
      autoPrint
      meta={
        <>
          <MetaCard label="Documento" value={`Pré-pesagem · ${op.code}`} />
          <MetaCard label="Produzir" value={op.productionDateLabel} />
          <MetaCard label="Para entregar" value={deliveryDateLabel} />
        </>
      }
    >
      {document.ingredientProducts.length > 0 ? (
        <section className="space-y-3">
          {document.ingredientProducts.map((section) => (
            <article key={section.productId} className="overflow-hidden border border-stone-400">
              <header className="grid grid-cols-[132px_84px_1fr_180px] border-b border-stone-400 bg-stone-300 text-stone-900">
                <div className="border-r border-stone-400 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Produto Ingrediente
                </div>
                <div className="border-r border-stone-400 px-3 py-2 text-lg font-bold leading-none">{section.productCode}</div>
                <div className="border-r border-stone-400 px-3 py-2 text-sm font-semibold">{section.productName}</div>
                <div className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
                  <div>Peso finalizado: {formatKgValue(section.requiredKg, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</div>
                </div>
              </header>

              <div className="space-y-2 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.08em] text-stone-500">
                  Usado por: {section.usedBy.join(", ")}
                </div>
                <RecipeTable rows={section.items} />
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
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

            {(() => {
              const opItem = itemByProduct.get(section.productId);
              if (!opItem || opItem.batchCount <= 1) return null;
              const done = opItem.batchesDone;
              const currentIdx = Math.min(done, opItem.batchCount - 1);
              const currentSize = opItem.batchSizes[currentIdx] ?? 0;
              const product = snapshot.products.find((p) => p.id === section.productId);
              const currentKg = product ? currentSize * product.salesToKgFactor : 0;
              const isDone = done >= opItem.batchCount;
              const busy = pendingKey === opItem.productionItemKey;
              return (
                <div className="flex items-center justify-between gap-3 border-b border-stone-400 bg-stone-100 px-3 py-2 print:hidden">
                  <div className="text-sm font-semibold text-stone-900">
                    {isDone
                      ? `Todas as ${opItem.batchCount} batidas concluídas`
                      : `Batida ${done + 1} de ${opItem.batchCount}`}
                    {!isDone ? (
                      <span className="ml-2 font-normal text-stone-600">
                        {currentSize} {opItem.batchUnitLabel} · {currentKg.toFixed(3)} kg
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {done > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void sendBatch(opItem.productionItemKey, "undo-production-batch", opItem.batchCount)}
                      >
                        Desfazer
                      </Button>
                    ) : null}
                    {!isDone ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void sendBatch(opItem.productionItemKey, "complete-production-batch", opItem.batchCount)}
                      >
                        Concluir batida {done + 1}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2 px-3 py-3">
              <RecipeTable
                rows={[
                  ...section.baseIngredients,
                  ...section.additionalIngredients.map((row) => ({ ...row, isAdditional: true })),
                ]}
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
