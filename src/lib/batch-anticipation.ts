/**
 * Quadro #234 (Lucas, 04/11): antecipar a liberação do lote (ex.: feriado) antes do prazo das
 * lojas. Exceção ao bloqueio do quadro #4, só para o superusuário = administrador da empresa e
 * administrador master. Gestor de fábrica, chão e loja nunca veem o botão e o servidor recusa (403).
 */
export function canAnticipateBatchRelease(role: string | null | undefined): boolean {
  return role === "administrador" || role === "administrador-master";
}

export const BATCH_ANTICIPATION_FORBIDDEN_MESSAGE =
  "Só o administrador pode antecipar a liberação do lote antes do prazo das lojas.";

/** Decisão do servidor: null = pode; senão status e mensagem da recusa. */
export function checkBatchAnticipation(role: string | null | undefined): { status: 403; message: string } | null {
  return canAnticipateBatchRelease(role) ? null : { status: 403, message: BATCH_ANTICIPATION_FORBIDDEN_MESSAGE };
}

/** Texto do botão na linha do lote (só aguardando_lojas, dentro do prazo). */
export function anticipateButtonLabel(pendingOrders: number): string {
  return `Antecipar liberação (${pendingOrders})`;
}

export function buildAnticipationConfirmation(input: {
  deliveryLabel: string;
  pendingOrders: number;
  missingStoreNames: string[];
}): { title: string; description: string } {
  const missing = input.missingStoreNames.length;
  const who =
    missing === 0
      ? "Todas as lojas já pediram."
      : `${missing === 1 ? "1 loja ainda não pediu" : `${missing} lojas ainda não pediram`} (${input.missingStoreNames.join(", ")}) e ${
          missing === 1 ? "não poderá" : "não poderão"
        } mais pedir para essa entrega.`;
  return {
    title: `Antecipar a liberação da entrega de ${input.deliveryLabel}?`,
    description: `O prazo das lojas ainda não acabou. ${input.pendingOrders} pedido(s) vão para a produção agora. ${who} A antecipação fica registrada no histórico de cada pedido.`,
  };
}
