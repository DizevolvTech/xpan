import { getProductionOrderNavKey } from "@/lib/factory-kanban";

/**
 * Cartão #238: localiza a OP de uma URL de impressão/detalhe.
 *
 * A chave de navegação é `data|setor|linha|cronograma`. O id do cronograma MUDA quando alguém edita
 * um produto (inclusive a receita de um MPI): o cadastro reabre/ativa uma nova revisão do
 * cronograma da linha e a OP, que continua a mesma, passa a ter outra chave. Uma impressão aberta
 * com a chave antiga (aba aberta, botão da lista antes de recarregar, link salvo) caía em
 * "Folha de produção não encontrada" — para as OPs já em produção que usam o MPI editado.
 *
 * Ordem: chave exata → id da OP → mesma data|setor|linha (ignora o cronograma). Se a mesma
 * data|setor|linha tiver mais de uma OP, vale a de mais itens (a que a chave antiga mais
 * provavelmente apontava); a escolha é estável.
 */
type NavigableOp = {
  id: string;
  productionDate: string | null;
  sectorId: string;
  lineId: string;
  scheduleId: string | null;
  items?: unknown[];
};

export function findProductionOrderByNavParam<T extends NavigableOp>(orders: T[], rawParam: string): T | null {
  let decoded = rawParam;
  try {
    decoded = decodeURIComponent(rawParam);
  } catch {
    // parâmetro já decodificado ou malformado: segue com o texto cru
  }

  const exact =
    orders.find((order) => getProductionOrderNavKey(order) === decoded) ??
    orders.find((order) => order.id === rawParam || order.id === decoded);
  if (exact) {
    return exact;
  }

  const parts = decoded.split("|");
  if (parts.length < 3) {
    return null;
  }
  const [date, sectorId, lineId] = parts;
  const sameSlot = orders.filter(
    (order) => (order.productionDate ?? "sem-data") === date && order.sectorId === sectorId && order.lineId === lineId,
  );
  if (sameSlot.length === 0) {
    return null;
  }
  return [...sameSlot].sort((a, b) => (b.items?.length ?? 0) - (a.items?.length ?? 0))[0];
}
