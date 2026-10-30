"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useInRouteModal } from "@/components/shared/route-modal";

/**
 * "Voltar para ..." do detalhe. Aberto como janela sobre a lista, voltar = fechar a janela
 * (histórico), senão o endereço mudava para a lista e a janela continuava aberta por cima
 * (quadro #42, 29/10). Aberto como página (link direto, F5), segue o link normal.
 */
export function BackToListLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const inModal = useInRouteModal();
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (!inModal) return;
        event.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
