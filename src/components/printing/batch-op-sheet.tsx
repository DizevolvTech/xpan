import { Fragment } from "react";

import type { PrintIngredientRow } from "@/lib/printing-documents";
import { groupPrintRowsByStage } from "@/lib/printing-documents";
import type { BatchTicket } from "@/lib/printing/batch-tickets";
import { defaultRecipeStage } from "@/lib/production-planning";
import { formatLocaleNumber } from "@/lib/utils";
import { formatDisplayQuantity, type WeightDisplayUnit } from "@/lib/weight-display";

/**
 * Cartão #237: folha A4 com UMA OP POR BATIDA (pré-pesagem e produção), o mesmo padrão da 80 mm.
 * Cada batida é um bloco próprio (`break-inside-avoid`: a tabela não é cortada no meio) com:
 * produto/MPI + "Batida n de N", rendimento previsto, UM campo em branco para o rendimento real
 * e "Pesar o bloco com ___ g". A coluna "Unidades" não existe mais (ver `ProductionSheetRow`).
 */
export type BatchSheetVariant = "producao" | "prepesagem";

const SHEET_FRACTION = { minimumFractionDigits: 3, maximumFractionDigits: 3 } as const;

const TH = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700";

function formatQuantity(value: number | null | undefined, unit: string, weight: WeightDisplayUnit) {
  return formatDisplayQuantity(value, unit, weight, SHEET_FRACTION);
}

/** MPI: peso de insumo (converte kg/g); produto: quantidade da OP, que não se converte. */
function formatYield(ticket: BatchTicket, weight: WeightDisplayUnit) {
  return ticket.kind === "ingredient"
    ? formatDisplayQuantity(ticket.quantity, ticket.unit, weight, { maximumFractionDigits: 3 })
    : `${formatLocaleNumber(ticket.quantity, { maximumFractionDigits: 3 })} ${ticket.unit}`;
}

function BlankField({ width = "w-24" }: { width?: string }) {
  return <span className={`inline-block h-4 ${width} border-b border-stone-700 align-bottom`} aria-hidden="true" />;
}

function RowsTable({
  ticket,
  variant,
  weight,
}: {
  ticket: BatchTicket;
  variant: BatchSheetVariant;
  weight: WeightDisplayUnit;
}) {
  const groups = groupPrintRowsByStage<PrintIngredientRow>(ticket.items, ticket.recipeStageConfig);
  if (groups.every((group) => group.rows.length === 0)) {
    return null;
  }
  const isProduction = variant === "producao";
  const colSpan = isProduction ? 3 : 2;

  return (
    <table className="w-full border-collapse border border-stone-300">
      <thead className="bg-stone-300">
        <tr>
          <th className={`w-36 border-r border-stone-400 ${TH}`}>Pré pesagem</th>
          <th className={`${isProduction ? "border-r border-stone-400 " : ""}${TH}`}>Insumos</th>
          {isProduction ? <th className={`w-48 ${TH}`}>Observação</th> : null}
        </tr>
      </thead>
      <tbody>
        {groups.map((group, groupIndex) => (
          <Fragment key={group.stage}>
            {group.showStageHeader && !(groupIndex === 0 && group.stage === defaultRecipeStage) ? (
              <tr className="bg-stone-100">
                <td
                  colSpan={colSpan}
                  className="border-t-2 border-stone-400 px-3 py-1.5 text-sm font-bold text-stone-900"
                >
                  Insumos {group.label.toLocaleLowerCase("pt-BR")}:
                </td>
              </tr>
            ) : null}
            {/* O modo de preparo é lido na folha de produção; a pré-pesagem é a folha da balança. */}
            {isProduction && group.instructions ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="border-t border-stone-200 bg-stone-100 px-3 py-1.5 text-xs leading-snug text-stone-700"
                >
                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                    Modo de preparo
                  </span>
                  <span className="whitespace-pre-line">{group.instructions}</span>
                </td>
              </tr>
            ) : null}
            {group.rows.map((row) => (
              <tr key={row.key} className="print:break-inside-avoid">
                <td className="border-t border-stone-200 px-3 py-2 align-top text-sm font-semibold text-stone-900">
                  {formatQuantity(row.estimatedQuantity, row.unit, weight)}
                </td>
                <td className="border-t border-stone-200 px-3 py-2 align-top text-sm text-stone-700">
                  <div className="flex items-baseline gap-2">
                    <span>{row.label}</span>
                    {row.isAdditional ? (
                      <span className="shrink-0 border border-stone-400 px-1 text-[9px] font-semibold uppercase tracking-wide text-stone-500">
                        Adic.
                      </span>
                    ) : null}
                  </div>
                  {!isProduction && row.notes ? <div className="mt-1 text-xs text-stone-500">{row.notes}</div> : null}
                </td>
                {isProduction ? (
                  <td className="border-t border-stone-200 px-3 py-2 align-top text-xs leading-snug text-stone-600">
                    {row.notes}
                    {row.alsoPrintedOn ? (
                      <span className="block font-semibold text-stone-500">Também em: {row.alsoPrintedOn}</span>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

export function BatchOpBlock({
  ticket,
  variant,
  weight,
}: {
  ticket: BatchTicket;
  variant: BatchSheetVariant;
  weight: WeightDisplayUnit;
}) {
  const isMpi = ticket.kind === "ingredient";
  return (
    <article
      className="overflow-hidden border border-stone-400 print:break-inside-avoid"
      data-batch-ticket={ticket.key}
    >
      <header className="grid grid-cols-[110px_100px_1fr_215px] border-b border-stone-400 bg-stone-300 text-stone-900">
        <div className="border-r border-stone-400 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
          {isMpi ? "Produto MPI" : "Produto"}
        </div>
        <div className="border-r border-stone-400 px-3 py-2 text-base font-bold leading-none whitespace-nowrap">{ticket.productCode}</div>
        <div className="border-r border-stone-400 px-3 py-2 text-sm font-semibold">
          {ticket.productName}
          {ticket.stageLabel ? (
            <span className="ml-2 border border-stone-400 px-1 text-[9px] font-semibold uppercase tracking-wide text-stone-600">
              {ticket.stageLabel}
            </span>
          ) : null}
          {isMpi && ticket.usedBy && ticket.usedBy.length > 0 ? (
            <div className="mt-0.5 text-[10px] font-normal uppercase tracking-[0.06em] text-stone-600">
              Usado por: {ticket.usedBy.join(", ")}
            </div>
          ) : null}
        </div>
        <div className="whitespace-nowrap px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
          <div className="text-sm font-bold normal-case tracking-normal text-stone-900">
            Batida {ticket.number} de {ticket.count}
            {ticket.complementary ? " (Parcial)" : ""}
          </div>
          <div className="mt-1">Carga da batida: {formatQuantity(ticket.batchKg, "Kg", weight)}</div>
        </div>
      </header>

      <div className="flex items-baseline justify-between gap-x-4 whitespace-nowrap border-b border-stone-300 px-3 py-2 text-sm text-stone-800 print:break-inside-avoid">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
            Rendimento previsto:{" "}
          </span>
          <strong>{formatYield(ticket, weight)}</strong>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
            Rendimento real:{" "}
          </span>
          <BlankField />
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
            Pesar o bloco com{" "}
          </span>
          {ticket.rawBlockWeightG != null ? (
            <strong>{formatLocaleNumber(ticket.rawBlockWeightG, { maximumFractionDigits: 1 })}</strong>
          ) : (
            <BlankField width="w-12" />
          )}{" "}
          g
        </div>
      </div>

      <div className="px-3 py-3">
        <RowsTable ticket={ticket} variant={variant} weight={weight} />
        {ticket.items.length === 0 ? (
          <div className="border border-dashed border-stone-300 px-3 py-3 text-sm text-stone-500">
            {variant === "producao"
              ? "Este produto não possui receita cadastrada para a folha de produção."
              : "Este produto consome somente produto MPI destacado acima."}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function BatchOpSheets({
  tickets,
  variant,
  weight = "kg",
}: {
  tickets: BatchTicket[];
  variant: BatchSheetVariant;
  weight?: WeightDisplayUnit;
}) {
  return (
    <section className="space-y-4 print:space-y-3">
      {tickets.map((ticket) => (
        <BatchOpBlock key={ticket.key} ticket={ticket} variant={variant} weight={weight} />
      ))}
    </section>
  );
}
