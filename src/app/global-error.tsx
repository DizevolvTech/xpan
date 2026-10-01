"use client";

import { ErrorFallback } from "@/components/shared/error-fallback";

// Último recurso: erro no próprio layout raiz. Precisa renderizar <html>/<body> por conta própria.
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#faf7f2" }}>
        <ErrorFallback {...props} />
      </body>
    </html>
  );
}
