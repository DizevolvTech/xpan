import { useCallback } from "react";

import { useConfirm } from "@/components/shared/confirm-dialog";
import { ReleaseOrderBlockedError } from "@/lib/use-factory-planning";

/**
 * Override de gestor para a TRAVA de data futura (produção concluída).
 *
 * Quando o servidor bloqueia a conclusão de produção em data futura, ele responde
 * 400 com `reason: "production_in_future"` e `forceable` refletindo o PAPEL
 * (true só para gestor-fabrica/administrador; o chão recebe false). O `readJson`
 * converte isso em `ReleaseOrderBlockedError`.
 *
 * Este hook centraliza o fluxo de "forçar mesmo assim": se o erro for esse bloqueio
 * E `forceable` for true, pede confirmação e refaz a ação com `force: true`. Retorna
 * `true` se TRATOU o erro (forçou ou o usuário cancelou) — nesse caso o caller NÃO
 * deve mostrar o erro padrão; retorna `false` se o erro não é o bloqueio overridable
 * e deve cair no tratamento padrão do caller.
 *
 * A autorização de QUEM pode forçar é sempre do servidor (via `forceable`); aqui só
 * espelhamos a flag — nunca consultamos o papel no cliente.
 */
export function useFutureDateOverride() {
  const confirm = useConfirm();

  return useCallback(
    async (
      error: unknown,
      retryForced: () => Promise<void>,
      onForceError?: (message: string) => void,
    ): Promise<boolean> => {
      if (
        !(error instanceof ReleaseOrderBlockedError) ||
        !error.forceable ||
        error.reason !== "production_in_future"
      ) {
        return false;
      }

      const confirmed = await confirm({
        title: "Concluir produção em data futura?",
        description: error.message,
        tone: "default",
        confirmLabel: "Concluir mesmo assim",
        cancelLabel: "Cancelar",
      });
      if (confirmed) {
        try {
          await retryForced();
        } catch (forceError) {
          onForceError?.(
            forceError instanceof Error ? forceError.message : "Falha ao concluir a produção.",
          );
        }
      }
      return true;
    },
    [confirm],
  );
}
