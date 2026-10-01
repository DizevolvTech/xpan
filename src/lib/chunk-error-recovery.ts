/* -------------------------------------------------------------------------------------------------
 * Recuperação de falha ao carregar um pedaço (chunk) do app.
 *
 * Depois de uma nova publicação, uma aba que ficou aberta (ou um navegador com cache antigo) ainda
 * aponta para arquivos que não existem mais. O Next lança ChunkLoadError / "Loading chunk N failed"
 * e a tela quebra. Recarregar UMA vez resolve; recarregar em loop não — por isso a trava.
 * -----------------------------------------------------------------------------------------------*/

import { safeStorageGet, safeStorageSet } from "@/lib/safe-storage";

const RELOAD_GUARD_KEY = "xpan.chunk-reload-at";
const RELOAD_GUARD_WINDOW_MS = 60_000;

type ErrorLike = { name?: unknown; message?: unknown } | null | undefined;

export function isChunkLoadError(error: unknown): boolean {
  const candidate = error as ErrorLike;
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  const message = typeof candidate?.message === "string" ? candidate.message : "";

  return (
    name === "ChunkLoadError" ||
    /loading chunk [^\s]+ failed/i.test(message) ||
    /failed to load chunk/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message)
  );
}

/** Decide (puro/testável) se ainda é seguro recarregar automaticamente. */
export function shouldAutoReload(lastReloadAt: string | null, now: number): boolean {
  if (!lastReloadAt) {
    return true;
  }

  const last = Number(lastReloadAt);
  if (!Number.isFinite(last)) {
    return true;
  }

  return now - last > RELOAD_GUARD_WINDOW_MS;
}

/** Recarrega a página uma única vez por janela. Devolve `true` se disparou o reload. */
export function reloadOnceForChunkError(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const now = Date.now();
  if (!shouldAutoReload(safeStorageGet(RELOAD_GUARD_KEY, "session"), now)) {
    return false;
  }

  // Sem conseguir gravar a trava, NÃO recarrega: sem ela o reload poderia virar loop.
  if (!safeStorageSet(RELOAD_GUARD_KEY, String(now), "session")) {
    return false;
  }

  window.location.reload();
  return true;
}
