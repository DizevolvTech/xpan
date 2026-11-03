"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { PageLayout } from "@/components/shared/page-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getRecipeStageLabel,
  isCustomRecipeStage,
  recipeStageBehaviorDescriptions,
  recipeStageLabels,
  recipeStages,
  type BuiltinRecipeStage,
  type RecipeStage,
  type RecipeStageDefinition,
} from "@/lib/production-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

/**
 * Cartão #173: etapas da ficha técnica da empresa. As padrão têm nome fixo (os cálculos
 * dependem delas) e podem sair da lista de "Adicionar etapa"; as cadastradas (ex.: Embalagem)
 * seguem uma etapa padrão nos cálculos.
 */
type StageRow = {
  key: RecipeStage;
  label: string;
  baseStage: BuiltinRecipeStage;
  active: boolean;
  custom: boolean;
};

async function readError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? fallback;
}

export default function EtapasFichaTecnicaPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const toast = useToast();
  const confirm = useConfirm();
  const [newName, setNewName] = useState("");
  const [newBase, setNewBase] = useState<BuiltinRecipeStage>("operacional");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const rows = useMemo<StageRow[]>(() => {
    const definitions: RecipeStageDefinition[] = snapshot.recipeStageDefinitions ?? [];
    const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
    const list: StageRow[] = [];
    for (const builtin of recipeStages) {
      list.push({
        key: builtin,
        label: recipeStageLabels[builtin],
        baseStage: builtin,
        active: byKey.get(builtin)?.active ?? true,
        custom: false,
      });
      definitions
        .filter((definition) => isCustomRecipeStage(definition.key) && definition.baseStage === builtin)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .forEach((definition) =>
          list.push({
            key: definition.key,
            label: definition.label || getRecipeStageLabel(definition.key),
            baseStage: definition.baseStage,
            active: definition.active,
            custom: true,
          }),
        );
    }
    return list;
  }, [snapshot.recipeStageDefinitions]);

  async function send(method: string, body?: unknown, query = "") {
    const response = await fetch(`/api/master-data/recipe-stages${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar a etapa."));
  }

  async function run(key: string, action: () => Promise<void>, success: string) {
    setBusyKey(key);
    try {
      await action();
      await refresh(true);
      toast.success(success);
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Não foi possível salvar a etapa.");
    } finally {
      setBusyKey(null);
    }
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      toast.error("Informe o nome da etapa.");
      return;
    }
    void run("new", async () => {
      await send("POST", { name, baseStage: newBase });
      setNewName("");
    }, `Etapa "${name}" cadastrada.`);
  }

  function handleRename(row: StageRow) {
    const label = (drafts[row.key] ?? row.label).trim();
    if (!label || label === row.label) return;
    void run(row.key, async () => {
      await send("PATCH", { key: row.key, label });
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.key];
        return next;
      });
    }, "Nome da etapa salvo.");
  }

  function handleToggle(row: StageRow, active: boolean) {
    void run(row.key, () => send("PATCH", { key: row.key, active }), active ? "Etapa volta a aparecer nas opções." : "Etapa não aparece mais nas opções.");
  }

  async function handleDelete(row: StageRow) {
    const accepted = await confirm({
      title: "Apagar etapa",
      description: `Apagar a etapa "${row.label}"? Só dá para apagar etapa que nenhuma ficha técnica usa.`,
      confirmLabel: "Apagar",
      tone: "destructive",
    });
    if (!accepted) return;
    void run(row.key, () => send("DELETE", undefined, `?key=${encodeURIComponent(row.key)}`), "Etapa apagada.");
  }

  return (
    <PageLayout
      title="Etapas da ficha técnica"
      description="Etapas que aparecem ao montar a receita do produto. Cadastre etapas novas, como Embalagem, e escolha como cada uma entra nos cálculos."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Produtos", href: "/gestor-dados/produtos" },
        { label: "Etapas da ficha técnica" },
      ]}
    >
      <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-border/80 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-end">
        <div className="grid gap-2">
          <Label htmlFor="new-stage-name">Nova etapa</Label>
          <Input
            id="new-stage-name"
            value={newName}
            maxLength={60}
            placeholder="Ex.: Embalagem"
            onChange={(event) => setNewName(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-stage-base">Entra nos cálculos como</Label>
          <Select value={newBase} onValueChange={(value) => setNewBase(value as BuiltinRecipeStage)}>
            <SelectTrigger id="new-stage-base" aria-label="Entra nos cálculos como">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {recipeStages.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {recipeStageLabels[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{recipeStageBehaviorDescriptions[newBase]}</p>
        </div>
        <Button type="submit" disabled={busyKey === "new"}>
          <Plus className="size-4" />
          Cadastrar etapa
        </Button>
      </form>

      {error ? (
        <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">{error}</div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-panel/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Etapa</th>
              <th className="px-3 py-2">Entra nos cálculos como</th>
              <th className="px-3 py-2">Aparece em “Adicionar etapa”</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted-foreground">Carregando etapas...</td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const draft = drafts[row.key] ?? row.label;
              const busy = busyKey === row.key;
              return (
                <tr key={row.key} className="border-t border-border/70 align-top" data-stage-key={row.key}>
                  <td className="px-3 py-2">
                    {row.custom ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          aria-label={`Nome da etapa ${row.label}`}
                          className="h-9 max-w-xs"
                          value={draft}
                          maxLength={60}
                          onChange={(event) => setDrafts((current) => ({ ...current, [row.key]: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleRename(row);
                            }
                          }}
                        />
                        {draft.trim() !== row.label ? (
                          <Button type="button" size="sm" disabled={busy || !draft.trim()} onClick={() => handleRename(row)}>
                            Salvar nome
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">{row.label}</p>
                        <p className="text-xs text-muted-foreground">Padrão do sistema</p>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p>{recipeStageLabels[row.baseStage]}</p>
                    <p className="text-xs text-muted-foreground">{recipeStageBehaviorDescriptions[row.baseStage]}</p>
                  </td>
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={row.active}
                        disabled={busy}
                        aria-label={`Mostrar ${row.label} em Adicionar etapa`}
                        onCheckedChange={(checked) => handleToggle(row, checked === true)}
                      />
                      <span>{row.active ? "Sim" : "Não"}</span>
                    </label>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.custom ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        aria-label={`Apagar etapa ${row.label}`}
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash2 className="size-4" />
                        Apagar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        A classificação do insumo (matéria-prima, embalagem, consumo) continua no cadastro do insumo. Aqui fica só a etapa em que ele é usado na ficha técnica.
      </p>
    </PageLayout>
  );
}
