/* -------------------------------------------------------------------------------------------------
 * XPAN-5 — Rastreamento (best-effort) de quais dias já tiveram as folhas de produção enviadas
 * para impressão, para avisar sobre REIMPRESSÃO ("cuide para não duplicar produção").
 *
 * Persistência em localStorage (por navegador). Limitação conhecida: não é compartilhado entre
 * operadores/máquinas — cobre o caso comum de o MESMO operador reimprimir após uma falha de
 * impressora. Um registro no banco daria visibilidade cross-operador (evolução futura).
 * -----------------------------------------------------------------------------------------------*/

const STORAGE_PREFIX = "xpan.production-sheets-printed";

/** Chave de storage do dia (pura/testável). */
export function dayPrintStorageKey(date: string): string {
  return `${STORAGE_PREFIX}.${date}`;
}

export function getDayPrintedAt(date: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(dayPrintStorageKey(date));
  } catch {
    return null;
  }
}

export function wasDayPrinted(date: string): boolean {
  return getDayPrintedAt(date) !== null;
}

export function markDayPrinted(date: string, atIso: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(dayPrintStorageKey(date), atIso);
  } catch {
    // Quota/segurança: o aviso de reimpressão é best-effort — falhar aqui não pode
    // impedir a impressão em si.
  }
}
