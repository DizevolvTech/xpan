/**
 * Feedback 10 do cliente — fila de OPs agrupada por DIA DE PRODUÇÃO.
 *
 * - "atrasada": dia de produção já passou e a OP ainda não terminou (destaque amarelo/vermelho);
 * - "hoje": dia de produção é hoje;
 * - "futura": dia de produção ainda não chegou — escondida por padrão ("Exibir futuras").
 *
 * Só apresentação: nada aqui muda dado nem regra. Lógica pura e testável.
 */

export type OpDayKind = "atrasada" | "hoje" | "futura" | "encerrada";

export interface OpDayGroup<T> {
  date: string;
  kind: OpDayKind;
  /** Dias de atraso (só para "atrasada"). */
  daysLate: number;
  ops: T[];
}

function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function classifyOpDay(productionDate: string, today: string, finished: boolean): OpDayKind {
  if (productionDate > today) return "futura";
  if (productionDate === today) return "hoje";
  return finished ? "encerrada" : "atrasada";
}

/**
 * Agrupa por dia de produção PRESERVANDO a ordem de chegada das OPs (a ordenação é feita antes).
 * Com `showFuture=false`, OPs de dias futuros saem da lista e são contadas em `hiddenFuture`.
 */
export function groupOpsByProductionDay<T extends { productionDate: string }>(
  ops: readonly T[],
  today: string,
  options: { showFuture: boolean; isFinished: (op: T) => boolean },
): { groups: OpDayGroup<T>[]; hiddenFuture: number } {
  const groups: OpDayGroup<T>[] = [];
  const byDate = new Map<string, OpDayGroup<T>>();
  let hiddenFuture = 0;

  for (const op of ops) {
    const kind = classifyOpDay(op.productionDate, today, options.isFinished(op));
    if (kind === "futura" && !options.showFuture) {
      hiddenFuture += 1;
      continue;
    }
    let group = byDate.get(op.productionDate);
    if (!group) {
      group = {
        date: op.productionDate,
        kind,
        daysLate: kind === "atrasada" ? dayDiff(op.productionDate, today) : 0,
        ops: [],
      };
      byDate.set(op.productionDate, group);
      groups.push(group);
    } else if (group.kind === "encerrada" && kind === "atrasada") {
      // o dia tem OP encerrada e OP atrasada: o dia inteiro conta como atrasado
      group.kind = "atrasada";
      group.daysLate = dayDiff(op.productionDate, today);
    }
    group.ops.push(op);
  }
  return { groups, hiddenFuture };
}

/** Resumo de datas (entrega/venda) de uma OP: a única, ou a mais próxima + "+N". */
export function summarizeOpDates(
  sourceItems: ReadonlyArray<{ date: string; label: string }>,
): string | null {
  const labelByDate = new Map<string, string>();
  for (const entry of sourceItems) {
    if (entry.date) labelByDate.set(entry.date, entry.label);
  }
  if (labelByDate.size === 0) return null;
  const sorted = [...labelByDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const [, first] = sorted[0];
  return sorted.length === 1 ? first : `${first} +${sorted.length - 1}`;
}
