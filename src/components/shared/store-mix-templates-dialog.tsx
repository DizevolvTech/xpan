"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { ProductChecklist, type StoreProductMixOption } from "@/components/shared/store-product-mix-field";
import type { StoreProductMixTemplate } from "@/lib/store-product-mix";

type Draft = { id: string | null; name: string; productIds: string[] };

/**
 * Cartão #602: cadastro dos modelos de mix (ex.: "Loja de rua", "Quiosque"). Um modelo é uma
 * lista de produtos usada por várias lojas; mudar o modelo muda na hora o que essas lojas veem
 * nos lotes de pedidos.
 */
export function StoreMixTemplatesDialog({
  open,
  onOpenChange,
  templates,
  options,
  storesByTemplateId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: StoreProductMixTemplate[];
  options: StoreProductMixOption[];
  storesByTemplateId: Map<string, string[]>;
  onChanged: () => Promise<void> | void;
}) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => new Set(draft?.productIds ?? []), [draft?.productIds]);
  const nameById = useMemo(() => new Map(options.map((option) => [option.id, option.name])), [options]);

  async function call(method: "POST" | "PATCH" | "DELETE", body?: unknown, query = "") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/master-data/store-mix-templates${query}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Falha ao salvar o modelo de mix.");
      }
      await onChanged();
      return true;
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : "Falha ao salvar o modelo de mix.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) return setError("Informe o nome do modelo.");
    if (draft.productIds.length === 0) return setError("Marque ao menos um produto no modelo.");
    const ok = draft.id
      ? await call("PATCH", { id: draft.id, name: draft.name, productIds: draft.productIds })
      : await call("POST", { name: draft.name, productIds: draft.productIds });
    if (ok) setDraft(null);
  }

  async function remove(template: StoreProductMixTemplate) {
    const ok = await confirm({ title: `Apagar o modelo "${template.name}"?`, confirmLabel: "Apagar", tone: "destructive" });
    if (!ok) return;
    await call("DELETE", undefined, `?id=${encodeURIComponent(template.id)}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDraft(null);
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Modelos de mix de produtos</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Um modelo é uma lista de produtos que várias lojas vendem. No cadastro da loja, escolha &quot;Usar um modelo
          de mix&quot;. Mudar os produtos de um modelo muda o que todas as lojas dele veem nos lotes.
        </p>

        {error ? (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
            {error}
          </p>
        ) : null}

        {draft ? (
          <div className="space-y-3" data-testid="store-mix-template-form">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nome do modelo</span>
              <Input
                value={draft.name}
                maxLength={60}
                placeholder="Ex.: Loja de rua, Quiosque"
                aria-label="Nome do modelo"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <ProductChecklist
              options={options}
              selected={selected}
              label="Buscar produto no modelo"
              onChange={(productIds) => setDraft({ ...draft, productIds })}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(null)}>
                Voltar
              </Button>
              <Button type="button" disabled={busy} onClick={() => void saveDraft()}>
                {draft.id ? "Salvar modelo" : "Criar modelo"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                Nenhum modelo ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border/70 rounded-lg border border-border/70">
                {templates.map((template) => {
                  const stores = storesByTemplateId.get(template.id) ?? [];
                  return (
                    <li key={template.id} className="flex flex-wrap items-start gap-3 px-3 py-2" data-testid="store-mix-template-row">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-semibold text-foreground">{template.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {template.productIds.length} produtos:{" "}
                          {template.productIds
                            .map((id) => nameById.get(id))
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stores.length > 0 ? `Lojas: ${stores.join(", ")}` : "Nenhuma loja usa este modelo."}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          aria-label={`Editar modelo ${template.name}`}
                          onClick={() => {
                            setError(null);
                            setDraft({ id: template.id, name: template.name, productIds: template.productIds });
                          }}
                        >
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          aria-label={`Apagar modelo ${template.name}`}
                          onClick={() => void remove(template)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {!draft ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setDraft({ id: null, name: "", productIds: [] });
              }}
            >
              <Plus className="size-4" />
              Novo modelo
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
