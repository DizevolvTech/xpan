"use client";

import { useEffect, useState } from "react";

import { NAVIGATION_START_EVENT } from "@/lib/navigation-progress";

function isInternalNavigationClick(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Mesma página (ou só âncora #): não há navegação.
  return url.pathname + url.search !== window.location.pathname + window.location.search;
}

/**
 * Barra fina no topo que aparece NO CLIQUE e some quando a nova tela abre (reunião 22/10,
 * bloco 5). Sem dependência do roteador: observa a URL enquanto ativa (máx. 10 s).
 */
export function NavigationProgress() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let startHref = "";
    let poll: number | undefined;
    let giveUp: number | undefined;
    const stop = () => {
      window.clearInterval(poll);
      window.clearTimeout(giveUp);
      setActive(false);
    };
    const start = () => {
      startHref = window.location.href;
      window.clearInterval(poll);
      window.clearTimeout(giveUp);
      setActive(true);
      poll = window.setInterval(() => {
        if (window.location.href !== startHref) stop();
      }, 80);
      giveUp = window.setTimeout(stop, 10_000);
    };
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigationClick(event)) start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATION_START_EVENT, start);
    window.addEventListener("popstate", stop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATION_START_EVENT, start);
      window.removeEventListener("popstate", stop);
      stop();
    };
  }, []);

  return (
    <div
      aria-hidden={!active}
      role={active ? "progressbar" : undefined}
      aria-label={active ? "Abrindo a tela" : undefined}
      data-testid="navigation-progress"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] overflow-hidden transition-opacity duration-150 ${active ? "opacity-100" : "opacity-0"}`}
    >
      <div className="h-full w-1/3 animate-[xpan-nav-progress_1.1s_ease-in-out_infinite] rounded-full bg-primary motion-reduce:animate-none motion-reduce:w-full" />
    </div>
  );
}
