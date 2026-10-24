/**
 * Reunião 22/10 (bloco 5): "clico e demora, parece que não funcionou". Sinal imediato de que
 * a navegação começou. Links internos são detectados sozinhos (NavigationProgress); para
 * `router.push` use `pushWithProgress`.
 */
export const NAVIGATION_START_EVENT = "xpan:navigation-start";

export function startNavigationProgress() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT));
}

export function pushWithProgress(router: { push: (href: string) => void }, href: string) {
  if (typeof window !== "undefined") {
    const target = new URL(href, window.location.href);
    if (target.href !== window.location.href) startNavigationProgress();
  }
  router.push(href);
}
