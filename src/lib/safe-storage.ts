/* -------------------------------------------------------------------------------------------------
 * Acesso defensivo a localStorage/sessionStorage.
 *
 * `window.localStorage` pode LANÇAR (não só devolver null) quando o navegador bloqueia o
 * armazenamento do site: Safari com "bloquear todos os cookies", navegador embutido de app
 * (WebView), modo restrito/corporativo, cota cheia. Sem proteção, a exceção acontece durante a
 * renderização e derruba a página inteira com "Application error: a client-side exception".
 * Preferências de tela (loja ativa, período) são best-effort: falhar aqui nunca pode ser fatal.
 * -----------------------------------------------------------------------------------------------*/

type StorageKind = "local" | "session";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function resolveStorage(kind: StorageKind): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    // O próprio acesso à propriedade pode lançar SecurityError.
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function safeStorageGet(key: string, kind: StorageKind = "local"): string | null {
  const storage = resolveStorage(kind);
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Devolve `true` somente se o valor foi realmente gravado. */
export function safeStorageSet(key: string, value: string, kind: StorageKind = "local"): boolean {
  const storage = resolveStorage(kind);
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
