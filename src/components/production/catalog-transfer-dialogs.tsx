"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileUp, Upload } from "lucide-react";

import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toggleSelection } from "@/lib/catalog-transfer/review";
import { CATALOG_MAX_FILE_BYTES, CATALOG_MAX_PRODUCTS, type CatalogReview, type ReviewProduct } from "@/lib/catalog-transfer/types";
import { useCurrentProfile } from "@/lib/use-current-profile";

/**
 * Cartão #241 — botões "Exportar cadastros" e "Importar cadastros" (administrador e master).
 * O servidor confere o papel de novo (403); aqui só se esconde o botão de quem não pode.
 */

type ExportableProduct = { id: string; name: string; code: string; externalCode?: string | null; active: boolean };

async function readMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

const ACTION_LABEL: Record<ReviewProduct["action"], string> = { novo: "Novo", atualizar: "Vai atualizar", igual: "Igual" };
const ACTION_STYLE: Record<ReviewProduct["action"], string> = {
  novo: "bg-success/15 text-success-foreground",
  atualizar: "bg-primary/15 text-primary",
  igual: "bg-secondary text-muted-foreground",
};

function ExportDialog({ open, onOpenChange, products }: { open: boolean; onOpenChange: (open: boolean) => void; products: ExportableProduct[] }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => `${p.name} ${p.code} ${p.externalCode ?? ""}`.toLowerCase().includes(term));
  }, [products, search]);
  const selectedIds = products.filter((p) => !unchecked.has(p.id)).map((p) => p.id);

  function setMany(ids: string[], checked: boolean) {
    setUnchecked((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function download() {
    setBusy(true);
    try {
      const response = await fetch("/api/master-data/catalog-transfer/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedIds }),
      });
      if (!response.ok) {
        toast.error(await readMessage(response, "Falha ao exportar os cadastros."));
        return;
      }
      const total = response.headers.get("X-Catalog-Products");
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "xpan-cadastros.json";
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Arquivo ${name} baixado${total ? ` (${total} produtos, contando os MPIs usados)` : ""}.`);
      onOpenChange(false);
    } catch {
      toast.error("Erro inesperado ao exportar os cadastros.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Exportar cadastros</DialogTitle>
          <DialogDescription>
            Gera um arquivo com os produtos escolhidos, as fichas técnicas completas, os insumos usados, os MPIs usados
            (mesmo sem marcar) e as etapas cadastradas. Depois é só importar no outro ambiente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código ou nome..." aria-label="Buscar produto para exportar" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button type="button" variant="outline" size="sm" onClick={() => setMany(visible.map((p) => p.id), true)}>Marcar todos</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setMany(visible.map((p) => p.id), false)}>Desmarcar todos</Button>
            <span className="text-muted-foreground">{selectedIds.length} de {products.length} produtos marcados</span>
          </div>
          <ul className="max-h-[45vh] divide-y overflow-y-auto rounded-md border" aria-label="Produtos para exportar">
            {visible.map((product) => (
              <li key={product.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-secondary/50">
                  <Checkbox checked={!unchecked.has(product.id)} onCheckedChange={(value) => setMany([product.id], value === true)} />
                  <span className="flex-1 font-medium">{product.name}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">{product.externalCode || product.code}</span>
                  {!product.active ? <span className="text-xs text-muted-foreground">inativo</span> : null}
                </label>
              </li>
            ))}
            {visible.length === 0 ? <li className="px-3 py-4 text-sm text-muted-foreground">Nenhum produto encontrado.</li> : null}
          </ul>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={busy || selectedIds.length === 0} onClick={() => void download()}>
            <Download className="size-4" />
            {busy ? "Gerando arquivo..." : "Baixar arquivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ParsedUpload = { fileName: string; file: unknown };

function ProductReviewRow({ item, checked, onToggle }: { item: ReviewProduct; checked: boolean; onToggle: (on: boolean) => void }) {
  const selectable = !item.blocked && item.action !== "igual";
  return (
    <li className="space-y-1 px-3 py-2 text-sm">
      <label className="flex items-center gap-3">
        <Checkbox checked={checked} disabled={!selectable} onCheckedChange={(value) => onToggle(value === true)} aria-label={`Importar ${item.name}`} />
        <span className="flex-1 font-medium">
          {item.name}
          {item.includedAsIngredient ? <span className="ml-2 text-xs font-normal text-muted-foreground">MPI usado como ingrediente</span> : null}
        </span>
        <span className="tabular-nums text-xs text-muted-foreground">{item.externalCode || item.code}</span>
        {item.blocked ? (
          <span className="rounded px-2 py-0.5 text-xs font-medium bg-danger/20 text-danger-foreground">Conflito</span>
        ) : (
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${ACTION_STYLE[item.action]}`}>{ACTION_LABEL[item.action]}</span>
        )}
      </label>
      {item.conflicts.map((text) => (
        <p key={text} className="pl-7 text-xs text-danger-foreground">{text}</p>
      ))}
      {item.notes.map((text) => (
        <p key={text} className="pl-7 text-xs text-muted-foreground">{text}</p>
      ))}
      {item.action === "atualizar" && !item.blocked ? (
        <div className="space-y-0.5 pl-7 text-xs text-muted-foreground">
          {item.changes.map((change) => (
            <p key={change.field}><strong className="font-medium text-foreground">{change.label}:</strong> {change.from} → {change.to}</p>
          ))}
          {item.recipeChanges.map((change) => (
            <p key={change.text}><strong className="font-medium text-foreground">Receita:</strong> {change.text}</p>
          ))}
        </div>
      ) : null}
      {item.action === "novo" && !item.blocked ? (
        <p className="pl-7 text-xs text-muted-foreground">{item.recipeLineCount} linhas na ficha técnica</p>
      ) : null}
    </li>
  );
}

function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; onDone: () => Promise<void> | void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<ParsedUpload | null>(null);
  const [review, setReview] = useState<CatalogReview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  function reset() {
    setUpload(null);
    setReview(null);
    setSelected([]);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    reset();
    if (file.size > CATALOG_MAX_FILE_BYTES) {
      setError("O arquivo passa de 10 MB. Exporte menos produtos por vez.");
      return;
    }
    setBusy(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        setError("Não foi possível ler o arquivo. Escolha um .json exportado pelo botão Exportar cadastros.");
        return;
      }
      const response = await fetch("/api/master-data/catalog-transfer/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, file: parsed }),
      });
      if (!response.ok) {
        setError(await readMessage(response, "Falha ao comparar o arquivo com o cadastro atual."));
        return;
      }
      const data = (await response.json()) as { review: CatalogReview; defaultSelected: string[] };
      setUpload({ fileName: file.name, file: parsed });
      setReview(data.review);
      setSelected(data.defaultSelected);
    } catch {
      setError("Erro inesperado ao ler o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!upload) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/master-data/catalog-transfer/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: upload.fileName, file: upload.file, selected }),
      });
      if (!response.ok) {
        setError(await readMessage(response, "Falha ao importar os cadastros. Nada foi gravado."));
        return;
      }
      const data = (await response.json()) as { created: number; updated: number };
      setResult(data);
      toast.success(`Importação concluída: ${data.created} criados, ${data.updated} atualizados.`);
      await onDone();
    } catch {
      setError("Erro inesperado ao importar. Confira a lista de produtos antes de tentar de novo.");
    } finally {
      setBusy(false);
    }
  }

  const newIngredients = review?.ingredients.filter((i) => i.status === "novo") ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Importar cadastros</DialogTitle>
          <DialogDescription>
            Suba o arquivo exportado de outro ambiente. Você confere tudo antes de gravar. Limite: {CATALOG_MAX_PRODUCTS.toLocaleString("pt-BR")} produtos e 10 MB.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-2 rounded-md border border-success/40 bg-success/10 p-4 text-sm" role="status">
            <p className="font-semibold">Importação concluída</p>
            <p>{result.created} produtos criados e {result.updated} atualizados. Cada um ganhou uma versão no histórico (&quot;Importado de {upload?.fileName}&quot;), então dá para voltar pela tela de versões.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={inputRef} type="file" accept=".json,application/json" className="sr-only" id="catalog-import-file" onChange={(event) => void handleFile(event.target.files?.[0])} />
              <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
                <FileUp className="size-4" />
                {upload ? "Escolher outro arquivo" : "Escolher arquivo"}
              </Button>
              {upload ? <span className="text-sm text-muted-foreground">{upload.fileName}</span> : null}
              {busy && !review ? <span className="text-sm text-muted-foreground">Lendo o arquivo...</span> : null}
            </div>
            {error ? <div className="rounded-md border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground" role="alert">{error}</div> : null}

            {review ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Arquivo de <strong className="text-foreground">{review.source.companyName || "empresa não informada"}</strong>
                  {review.source.exportedAt ? `, exportado em ${new Date(review.source.exportedAt).toLocaleDateString("pt-BR")}` : ""}.
                  {" "}{review.summary.novos} novos, {review.summary.atualizar} para atualizar, {review.summary.iguais} iguais, {review.summary.bloqueados} com conflito.
                </p>
                <ul className="max-h-[40vh] divide-y overflow-y-auto rounded-md border" aria-label="Produtos do arquivo">
                  {review.products.map((item) => (
                    <ProductReviewRow
                      key={item.key}
                      item={item}
                      checked={selected.includes(item.key)}
                      onToggle={(on) => setSelected((current) => toggleSelection(review, current, item.key, on))}
                    />
                  ))}
                </ul>
                <div className="grid gap-3 md:grid-cols-2">
                  <section className="rounded-md border p-3 text-sm">
                    <h3 className="mb-1 font-semibold">Insumos</h3>
                    <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
                      {review.ingredients.map((ingredient) => (
                        <li key={ingredient.code}>
                          <span className="tabular-nums">{ingredient.code}</span> {ingredient.name} —{" "}
                          <strong>{ingredient.conflicts.length > 0 ? "Conflito" : ingredient.status === "novo" ? "Novo" : "Existe"}</strong>
                          {ingredient.conflicts.map((text) => <span key={text} className="block text-danger-foreground">{text}</span>)}
                        </li>
                      ))}
                      {review.ingredients.length === 0 ? <li className="text-muted-foreground">Nenhum insumo no arquivo.</li> : null}
                    </ul>
                    {newIngredients.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">{newIngredients.length} insumos novos serão criados.</p> : null}
                  </section>
                  <section className="rounded-md border p-3 text-sm">
                    <h3 className="mb-1 font-semibold">Etapas da ficha técnica</h3>
                    <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
                      {review.stages.map((stage) => (
                        <li key={stage.key}>{stage.label} — <strong>{stage.status === "nova" ? "Nova" : "Existe"}</strong></li>
                      ))}
                      {review.stages.length === 0 ? <li className="text-muted-foreground">Nenhuma etapa cadastrada no arquivo.</li> : null}
                    </ul>
                  </section>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button type="button" disabled={busy || !review || selected.length === 0} onClick={() => void confirmImport()}>
                <Upload className="size-4" />
                {busy && review ? "Importando..." : `Importar ${selected.length} ${selected.length === 1 ? "produto" : "produtos"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CatalogTransferButtons({ products, onImported }: { products: ExportableProduct[]; onImported: () => Promise<void> | void }) {
  const { profile } = useCurrentProfile();
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  if (profile?.role !== "administrador" && profile?.role !== "administrador-master") return null;

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
        <Download className="size-4" />
        Exportar cadastros
      </Button>
      <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
        <Upload className="size-4" />
        Importar cadastros
      </Button>
      {exportOpen ? <ExportDialog open={exportOpen} onOpenChange={setExportOpen} products={products} /> : null}
      {importOpen ? <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={onImported} /> : null}
    </>
  );
}
