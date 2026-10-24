"use client";

import { useEffect, useSyncExternalStore } from "react";

import { isTestEnvironmentHost } from "@/lib/test-environment";

const subscribe = () => () => {};

/** Faixa fixa no topo do sistema de teste: o que se faz aqui não afeta a operação real. */
export function TestEnvironmentBanner() {
  const isTest = useSyncExternalStore(
    subscribe,
    () => isTestEnvironmentHost(window.location.hostname),
    () => false,
  );
  // Botões fixos no topo (menu do celular) descem a altura da faixa para não ficarem cobertos.
  useEffect(() => {
    if (!isTest) return;
    const root = document.documentElement;
    root.style.setProperty("--test-banner-h", "1.5rem");
    return () => {
      root.style.removeProperty("--test-banner-h");
    };
  }, [isTest]);
  if (!isTest) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex h-6 w-full items-center justify-center overflow-hidden bg-amber-400 px-3 text-center text-[11px] font-semibold leading-tight text-amber-950"
    >
      Sistema de TESTE — cópia dos dados reais. O que for feito aqui não afeta a fábrica nem as lojas.
    </div>
  );
}
