"use client";

import { PrintDocument } from "@/components/printing/print-document";

/**
 * Impressão que não conseguiu ler os dados (sessão vencida, servidor fora): diz o motivo em vez de
 * "não encontrada" — que faz o usuário achar que a OP sumiu (cartão #238).
 */
export function isSessionExpiredMessage(message: string | null | undefined) {
  return Boolean(message && /sess[aã]o inv[aá]lida|status 401/i.test(message));
}

export function PrintLoadError({ message }: { message: string }) {
  const expired = isSessionExpiredMessage(message);
  const next = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
  return (
    <PrintDocument
      title={expired ? "Sua sessão expirou" : "Não foi possível carregar a impressão"}
      subtitle={expired ? "Entre de novo para abrir esta impressão." : `${message} Tente de novo em instantes.`}
    >
      <p className="mt-4 text-sm">
        {expired ? (
          <a className="font-semibold underline" href={`/login?next=${encodeURIComponent(next)}`}>Entrar de novo</a>
        ) : (
          <a className="font-semibold underline" href={next}>Tentar de novo</a>
        )}
      </p>
    </PrintDocument>
  );
}
