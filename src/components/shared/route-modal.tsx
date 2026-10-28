"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Janela sobreposta para rotas interceptadas (feedback 4 do cliente): o detalhe de OP/pedido
 * abre por cima da lista, que continua montada por baixo — por isso a rolagem e os filtros
 * voltam intactos ao fechar. Fechar = voltar no histórico. O endereço direto da rota
 * (QR Code, link salvo, F5) continua abrindo a página inteira.
 */
export function RouteModal({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : router.back())}>
      {/* Coluna única minmax(0,1fr): tabela larga rola dentro da sua caixa e não alarga a janela (D16, 390 px). */}
      <DialogContent size="full" className="grid-cols-[minmax(0,1fr)] p-4 sm:p-6">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
