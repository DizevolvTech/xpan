"use client";

import { useEffect } from "react";

import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-error-recovery";

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Tela de recuperação para exceções de cliente. Substitui o genérico "Application error: a
 * client-side exception has occurred" por algo que o operador consegue usar (tentar de novo /
 * recarregar) e que a equipe consegue diagnosticar (mensagem + código ficam na tela e no console).
 * Estilos inline de propósito: precisa funcionar mesmo se o CSS/tema for a causa da falha.
 */
export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  useEffect(() => {
    // Mantém o erro original visível no console para diagnóstico.
    console.error("[xpan] erro de cliente capturado:", error);

    if (isChunkLoadError(error)) {
      reloadOnceForChunkError();
    }
  }, [error]);

  const detail = [error?.name, error?.message].filter(Boolean).join(": ");

  return (
    <main
      role="alert"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: "#1f2937",
      }}
    >
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Algo deu errado nesta tela</h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 20px", color: "#4b5563" }}>
          Seus dados estão salvos. Tente novamente; se continuar, recarregue a página.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid transparent",
              background: "#111827",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Recarregar a página
          </button>
        </div>
        {detail || error?.digest ? (
          <p style={{ marginTop: 24, fontSize: 12, color: "#6b7280", wordBreak: "break-word" }}>
            Informe este código ao suporte:{" "}
            <code>{[detail, error?.digest ? `ref ${error.digest}` : ""].filter(Boolean).join(" · ").slice(0, 240)}</code>
          </p>
        ) : null}
      </div>
    </main>
  );
}
