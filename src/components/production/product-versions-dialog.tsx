"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type VersionEntry = {
  id: string;
  version_number: number;
  change_description: string | null;
  changed_by_name: string | null;
  created_at: string;
  snapshot_data: { changedFields?: Array<{ label?: string; from?: string; to?: string }> } | null;
  restorable: boolean;
};

type ProductVersionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  /** Só quem pode editar o produto restaura; quem só visualiza vê o histórico. */
  canRestore: boolean;
  onRestore: (versionNumber: number) => Promise<void> | void;
};

function formatWhen(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

export function ProductVersionsDialog({
  open,
  onOpenChange,
  productId,
  productName,
  canRestore,
  onRestore,
}: ProductVersionsDialogProps) {
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setVersions(null);
    setError(null);
    fetch(`/api/master-data/products/${encodeURIComponent(productId)}/changelog`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as VersionEntry[] | { message?: string } | null;
        if (!response.ok || !Array.isArray(body)) {
          throw new Error((body as { message?: string } | null)?.message ?? "Falha ao carregar as versões.");
        }
        if (!cancelled) {
          setVersions(body);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar as versões.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  async function handleRestore(versionNumber: number) {
    setRestoring(versionNumber);
    try {
      await onRestore(versionNumber);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Versões de {productName}</DialogTitle>
          <DialogDescription>
            Cada alteração salva vira uma versão. Restaurar carrega a versão escolhida no formulário; ela só vale
            depois de você salvar, e o histórico anterior continua guardado.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto py-1">
          {error ? (
            <p className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">{error}</p>
          ) : versions === null ? (
            <p className="text-sm text-muted-foreground">Carregando versões…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este produto ainda não tem versões registradas. A próxima alteração salva cria a primeira.
            </p>
          ) : (
            versions.map((version) => {
              const changed = version.snapshot_data?.changedFields ?? [];
              return (
                <div key={version.id} className="rounded-lg border border-border/70 bg-card px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Versão {version.version_number}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {formatWhen(version.created_at)}
                          {version.changed_by_name ? ` · ${version.changed_by_name}` : ""}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-foreground">{version.change_description || "Sem descrição."}</p>
                      {changed.length > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Mudou: {changed.map((field) => field.label).filter(Boolean).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    {canRestore ? (
                      version.restorable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={restoring !== null}
                          onClick={() => void handleRestore(version.version_number)}
                        >
                          {restoring === version.version_number ? "Carregando…" : "Restaurar"}
                        </Button>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">Sem cópia do cadastro</span>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
