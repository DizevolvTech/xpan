import { Fragment } from "react";

import type {
  PrintIngredientRow,
  PrintIngredientStageGroup,
  ProductIngredientSection,
  ProductionSheetDocument,
  ProductionSheetProductSection,
} from "@/lib/printing-documents";
import { groupPrintRowsByStage, sumStageQuantityPerUnitKg } from "@/lib/printing-documents";
import { defaultRecipeStage } from "@/lib/production-planning";
import { formatKgValue, formatLocaleNumber } from "@/lib/utils";

/**
 * Linha da tabela da folha. `quantityPerUnit` é opcional porque a seção do MPI não tem
 * "por unidade" — o MPI é batido uma vez para a OP inteira, não por cuca.
 */
type SheetTableRow = PrintIngredientRow & {
  quantityPerUnit?: number | null;
  isAdditional?: boolean;
};

function formatQuantityCell(value: number | null | undefined, unit: string) {
  if (value == null) {
    return null;
  }
  return `${formatLocaleNumber(value, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${unit}`;
}

function formatKgCell(value: number) {
  // "Kg" com K maiúsculo: é o rótulo de unidade que as linhas da receita usam (`row.unit`), e
  // o subtotal do bloco fica na MESMA coluna — minúsculo destoava na folha.
  return `${formatKgValue(value, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} Kg`;
}

/** Quantidade pedida: inteiro sai inteiro (6), fracionada mostra até 3 casas (12,5). */
function formatOrderedQuantity(value: number) {
  return formatLocaleNumber(value, { maximumFractionDigits: 3 });
}

/**
 * A tabela de ingredientes da ficha do cliente: UMA tabela por seção, com os blocos de etapa
 * separados por uma LINHA DENTRO da própria tabela ("Ingredientes cobertura:"), não por uma
 * tabela nova. Quatro colunas fixas para as seções ficarem alinhadas na folha inteira:
 *
 *   Pré pesagem | Ingredientes | Unidades | Observação
 *
 * - "Pré pesagem" é o total a pesar para a carga inteira.
 * - "Unidades" é o quanto vai em CADA unidade produzida (vazia na seção do MPI, como na ficha).
 * - "Observação" é a nota da linha ("Raspas", "6 Unid"), que antes ficava embaixo do nome.
 */
function IngredientTable({
  groups,
  unitColumnLabel,
}: {
  groups: PrintIngredientStageGroup<SheetTableRow>[];
  unitColumnLabel: string;
}) {
  if (groups.every((group) => group.rows.length === 0)) {
    return null;
  }

  return (
    <table className="w-full border-collapse border border-stone-300">
      <thead className="bg-stone-300">
        <tr>
          <th className="w-32 border-r border-stone-400 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
            Pré pesagem
          </th>
          <th className="border-r border-stone-400 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
            Ingredientes
          </th>
          <th className="w-28 border-r border-stone-400 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
            {unitColumnLabel}
          </th>
          <th className="w-36 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-700">
            Observação
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group, groupIndex) => {
          const subtotalPerUnit = sumStageQuantityPerUnitKg(group.rows);

          return (
            <Fragment key={group.stage}>
              {/* R1: na ficha do cliente o primeiro bloco não tem sub-cabeçalho. O motivo é que
                  ali ele é a MASSA — a base implícita do produto, que dispensa rótulo. Então a
                  regra é "é a base?", não "é o primeiro?": um pão que começa pela esponja precisa
                  ver "Ingredientes esponja / pré-fermento:", senão o padeiro lê as linhas do
                  pré-fermento achando que são da massa. Receita não migrada volta como um grupo
                  só (`showStageHeader` falso) e sai idêntica à de hoje. */}
              {group.showStageHeader && !(groupIndex === 0 && group.stage === defaultRecipeStage) ? (
                // A régua grossa + o negrito é o que separa um bloco do outro: sem cor, o
                // contraste tem que sair de peso de fonte e traço.
                <tr className="bg-stone-100">
                  <td className="border-t-2 border-stone-400 px-3 py-1.5" />
                  <td className="border-t-2 border-stone-400 px-3 py-1.5 text-sm font-bold text-stone-900">
                    Ingredientes {group.label.toLocaleLowerCase("pt-BR")}:
                  </td>
                  {/* Subtotal por unidade do bloco (o "0,165 kg" da ficha). */}
                  <td className="border-t-2 border-stone-400 px-3 py-1.5 text-sm font-semibold text-stone-900">
                    {unitColumnLabel && subtotalPerUnit != null ? formatKgCell(subtotalPerUnit) : null}
                  </td>
                  <td className="border-t-2 border-stone-400 px-3 py-1.5" />
                </tr>
              ) : null}
              {/* Modo de preparo DESTE bloco — o padeiro lê junto dos ingredientes da fase.
                  Etapa sem instrução não imprime nada (nem rótulo, nem espaço). */}
              {group.instructions ? (
                <tr>
                  <td
                    colSpan={4}
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
                <tr key={row.key}>
                  <td className="border-t border-stone-200 px-3 py-2 align-top text-sm font-semibold text-stone-900">
                    {formatQuantityCell(row.estimatedQuantity, row.unit)}
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
                  </td>
                  <td className="border-t border-stone-200 px-3 py-2 align-top text-sm font-semibold text-stone-900">
                    {formatQuantityCell(row.quantityPerUnit, row.unit)}
                  </td>
                  <td className="border-t border-stone-200 px-3 py-2 align-top text-xs leading-snug text-stone-600">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Seção do MPI: vem ANTES dos produtos porque o MPI é batido UMA vez, agregando o consumo de
 * todos os produtos da folha. A coluna "Unidades" fica sem título (e sem valor) — o MPI não
 * tem "por unidade", ele tem peso finalizado.
 */
function IngredientProductSection({ section }: { section: ProductIngredientSection }) {
  return (
    <article className="overflow-hidden border border-stone-400">
      <header className="grid grid-cols-[132px_84px_1fr_180px] border-b border-stone-400 bg-stone-300 text-stone-900 print:break-inside-avoid">
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
          <div className="mt-0.5 text-[10px] font-normal uppercase tracking-[0.06em] text-stone-600">
            Usado por: {section.usedBy.join(", ")}
          </div>
        </div>
        {/* Mesma razão da faixa do produto: sem `nowrap` o "Kg" desgruda do número e a faixa
            ganha uma segunda linha só para ele. Ver a prova de impressão de 25/07. */}
        <div className="whitespace-nowrap px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
          <div>Peso finalizado: {formatKgCell(section.requiredKg)}</div>
        </div>
      </header>

      <div className="px-3 py-3">
        {/* Ficha do próprio MPI: os blocos DELE saem na sequência que ele definiu. */}
        <IngredientTable
          groups={groupPrintRowsByStage<SheetTableRow>(section.items, section.recipeStageConfig)}
          unitColumnLabel=""
        />
      </div>
    </article>
  );
}

/** Bloco de um produto final: faixa com código/nome/pedido/pesos + a tabela de ingredientes. */
function ProductSection({ section }: { section: ProductionSheetProductSection }) {
  const rows: SheetTableRow[] = [
    ...section.items.filter((item) => item.sectionKind !== "additional"),
    ...section.items
      .filter((item) => item.sectionKind === "additional")
      .map((item) => ({ ...item, isAdditional: true })),
  ];

  return (
    <article className="overflow-hidden border border-stone-400">
      {/* Faixa do produto: código, nome, unidade de venda + quantidade pedida e o peso unitário. */}
      <header className="grid grid-cols-[96px_84px_1fr_120px_190px] border-b border-stone-400 bg-stone-300 text-stone-900 print:break-inside-avoid">
        <div className="border-r border-stone-400 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
          Produto
        </div>
        <div className="border-r border-stone-400 px-3 py-2 text-lg font-bold leading-none">{section.productCode}</div>
        <div className="border-r border-stone-400 px-3 py-2 text-sm font-semibold">{section.productName}</div>
        <div className="border-r border-stone-400 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
          <div>Pedido · {section.requestedUnit}</div>
          <div className="mt-1 text-base font-bold text-stone-900">
            {formatOrderedQuantity(section.requestedQuantity)}
          </div>
        </div>
        {/* Rótulos CURTOS + `whitespace-nowrap`: na prova de impressão de 25/07 o texto longo
            ("CARGA PLANEJADA: 150,800 KG") ora quebrava em duas linhas, ora era CORTADO no meio
            ("150,8"), que é pior — perde o número. Encurtar o rótulo é o que faz caber de fato
            na largura da coluna; o nowrap só garante que o "Kg" não desgruda do valor. */}
        <div className="whitespace-nowrap px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-600">
          <div>Peso un.: {formatKgCell(section.unitWeightKg)}</div>
          <div className="mt-1">Carga: {formatKgCell(section.plannedKg)}</div>
        </div>
      </header>

      <div className="px-3 py-3">
        <IngredientTable
          groups={groupPrintRowsByStage<SheetTableRow>(
            rows,
            // A sequência dos blocos é a que a ficha do produto definiu.
            section.recipeStageConfig,
          )}
          unitColumnLabel="Unidades"
        />
        {section.items.length === 0 ? (
          <div className="border border-dashed border-stone-300 px-3 py-3 text-sm text-stone-500">
            Este produto não possui receita cadastrada para a folha de produção.
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Folha de produção de uma OP, no formato da ficha que o cliente já usa: a seção do MPI
 * primeiro (batido uma vez para a OP inteira) e depois um bloco por produto final. Extraída
 * para ser reutilizada tanto na impressão individual (`/impressao/producao/[opId]`) quanto na
 * impressão em lote do dia (`/impressao/producao-dia/[date]` — XPAN-5).
 */
export function ProductionSheetSections({ document }: { document: ProductionSheetDocument }) {
  return (
    <section className="space-y-4 print:space-y-1.5">
      {document.ingredientSections.map((section) => (
        // Chave inclui a etapa: o mesmo MPI pode render duas seções (ex.: recheio e cobertura).
        <IngredientProductSection key={`${section.productId}-${section.stage}`} section={section} />
      ))}
      {document.productSections.map((section) => (
        <ProductSection key={section.productId} section={section} />
      ))}
    </section>
  );
}
