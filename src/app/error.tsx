"use client";

import { ErrorFallback } from "@/components/shared/error-fallback";

// Fronteira de erro das rotas: mantém o layout raiz (providers) e troca só o conteúdo quebrado.
export default function RouteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback {...props} />;
}
