"use client";

import { useSyncExternalStore } from "react";

import { isTestEnvironmentHost } from "@/lib/test-environment";

const subscribe = () => () => {};

/** Faixa fixa no topo do sistema de teste: o que se faz aqui não afeta a operação real. */
export function TestEnvironmentBanner() {
  const isTest = useSyncExternalStore(
    subscribe,
    () => isTestEnvironmentHost(window.location.hostname),
    () => false,
  );
  if (!isTest) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[60] w-full bg-amber-400 px-3 py-1 text-center text-xs font-semibold text-amber-950"
    >
      Sistema de TESTE — cópia dos dados reais. O que for feito aqui não afeta a fábrica nem as lojas.
    </div>
  );
}
