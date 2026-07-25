import { Fragment } from "react";

import type { PrintIngredientRow, buildProductionSheetDocument } from "@/lib/printing-documents";
import { groupPrintRowsByStage } from "@/lib/printing-documents";
import { formatKgValue, formatLocaleNumber } from "@/lib/utils";

type ProductionSheetDocument = ReturnType<typeof buildProductionSheetDocument>;

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

/**
 * Seções por produto de uma folha de produção de uma OP. Extraído para ser reutilizado
 * tanto na impressão individual (`/impressao/producao/[opId]`) quanto na impressão em
 * lote do dia (`/impressao/producao-dia/[date]` — XPAN-5).
 */
export function ProductionSheetSections({ document }: { document: ProductionSheetDocument }) {
  return (
    <section className="space-y-4 print:space-y-1.5">
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
            {groupPrintRowsByStage(
              [
                ...section.items.filter((item) => item.sectionKind !== "additional"),
                ...section.items
                  .filter((item) => item.sectionKind === "additional")
                  .map((item) => ({ ...item, isAdditional: true })),
              ],
              // A sequência dos blocos é a que a ficha do produto definiu.
              section.recipeStageConfig,
            ).map((group) => (
              // Receita não migrada = um grupo só, sem cabeçalho: a folha sai idêntica à de hoje.
              <Fragment key={group.stage}>
                {group.showStageHeader ? (
                  <div className="border-b border-stone-300 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-600">
                    {group.label}
                  </div>
                ) : null}
                {/* Modo de preparo DESTE bloco — o padeiro lê junto dos ingredientes da fase.
                    Etapa sem instrução não imprime nada (nem rótulo, nem espaço). */}
                {group.instructions ? (
                  <div className="border border-stone-300 bg-stone-100 px-3 py-2 text-xs leading-snug text-stone-700">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                      Modo de preparo
                    </span>
                    <span className="whitespace-pre-line">{group.instructions}</span>
                  </div>
                ) : null}
                <RecipeTable rows={group.rows} />
              </Fragment>
            ))}
            {section.items.length === 0 ? (
              <div className="border border-dashed border-stone-300 px-3 py-3 text-sm text-stone-500">
                Este produto não possui receita cadastrada para a folha de produção.
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
