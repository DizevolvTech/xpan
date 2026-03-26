"use client";

import { useMemo, useState } from "react";
import { Building2, Clock3, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchFilter } from "@/components/shared/search-filter";
import { PageLayout } from "@/components/shared/page-layout";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getEnabledOrderingDays,
  getEnabledReceivingDays,
  getStoreCanOrderSunday,
  getStoreReceivesSunday,
  productionWeekDays,
  type StoreMasterData,
} from "@/lib/production-planning";
import { formatBrazilPhone } from "@/lib/phone-mask";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { useStoreUserCandidates } from "@/lib/use-store-user-candidates";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Loja = StoreMasterData;

type LojaFormState = StoreMasterData;
type StoreDialogMode = "view" | "edit";

function buildLojaFormState(store?: Loja | null): LojaFormState {
  return {
    id: store?.id ?? `store-${Date.now()}`,
    code: store?.code ?? `LJ-${String(Date.now()).slice(-3)}`,
    name: store?.name ?? "",
    responsible: store?.responsible ?? "",
    responsibleProfileId: store?.responsibleProfileId ?? null,
    email: store?.email ?? "",
    phone: formatBrazilPhone(store?.phone ?? ""),
    status: store?.status ?? "ativo",
    receiveWindow: store?.receiveWindow ?? "07:00 - 10:00",
    orderingDays: store?.orderingDays ?? ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: store?.receivingDays ?? ["segunda", "terca", "quarta", "quinta", "sexta"],
    orderingBlockedDays: store?.orderingBlockedDays ?? [],
    receivingBlockedDays: store?.receivingBlockedDays ?? [],
  };
}

export default function LojasPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const {
    users: storeUsers,
    isLoading: isStoreUsersLoading,
    error: storeUsersError,
  } = useStoreUserCandidates();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Loja | null>(null);
  const [dialogMode, setDialogMode] = useState<StoreDialogMode>("edit");
  const [formState, setFormState] = useState<LojaFormState>(() => buildLojaFormState());
  const [formBaseline, setFormBaseline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isReadOnly = dialogMode === "view";
  const formDirty = isDialogOpen && !isReadOnly && JSON.stringify(formState) !== formBaseline;
  const formGuard = useUnsavedChangesGuard({
    enabled: isDialogOpen && !isReadOnly,
    isDirty: formDirty,
  });

  const lojas = useMemo(
    () =>
      snapshot.stores.map((store) => ({
        ...store,
        orderingDays: store.orderingDays ?? [],
        receivingDays: store.receivingDays ?? [],
        orderingBlockedDays: store.orderingBlockedDays ?? [],
        receivingBlockedDays: store.receivingBlockedDays ?? [],
      })),
    [snapshot.stores],
  );

  const filteredLojas = useMemo(
    () =>
      lojas.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [lojas, searchTerm],
  );
  const storeUserOptions = useMemo(
    () => storeUsers.filter((user) => user.status === "ativo" || user.id === formState.responsibleProfileId),
    [formState.responsibleProfileId, storeUsers],
  );
  const selectedResponsibleUser = useMemo(
    () => storeUsers.find((user) => user.id === formState.responsibleProfileId) ?? null,
    [formState.responsibleProfileId, storeUsers],
  );
  const storeUserOptionsForSearch = useMemo(
    () =>
      storeUserOptions.map((user) => ({
        value: user.id,
        label: user.name,
        description: `${user.email}${user.status === "inativo" ? " · inativo" : ""}`,
        keywords: [user.email],
      })),
    [storeUserOptions],
  );

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Nome completo" },
    { key: "responsible", header: "Responsável" },
    {
      key: "orderingDays",
      header: "Dias de Pedido",
      render: (item: Loja) => `${(item.orderingDays ?? []).length} dias`,
    },
    {
      key: "receivingDays",
      header: "Dias de Recebimento",
      render: (item: Loja) => `${(item.receivingDays ?? []).length} dias`,
    },
    {
      key: "blockedDays",
      header: "Bloqueios",
      render: (item: Loja) =>
        `${(item.orderingBlockedDays ?? []).length} pedido · ${(item.receivingBlockedDays ?? []).length} receb.`,
    },
    {
      key: "receivesSunday",
      header: "Recebe Domingo",
      render: (item: Loja) => (getStoreReceivesSunday(item) ? "Sim" : "Não"),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Loja) => <StatusBadge status={item.status} />,
    },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: Loja) => {
        setDialogMode("view");
        setEditingStore(item);
        const nextFormState = buildLojaFormState(item);
        setFormState(nextFormState);
        setFormBaseline(JSON.stringify(nextFormState));
        setFormError(null);
        setIsDialogOpen(true);
      },
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: Loja) => {
        setDialogMode("edit");
        setEditingStore(item);
        const nextFormState = buildLojaFormState(item);
        setFormState(nextFormState);
        setFormBaseline(JSON.stringify(nextFormState));
        setFormError(null);
        setIsDialogOpen(true);
      },
    },
  ];

  function toggleDay(
    scope: "orderingDays" | "receivingDays" | "orderingBlockedDays" | "receivingBlockedDays",
    day: (typeof productionWeekDays)[number]["key"],
  ) {
    setFormState((current) => {
      if (scope === "orderingBlockedDays" && !current.orderingDays.includes(day)) {
        return current;
      }

      if (scope === "receivingBlockedDays" && !current.receivingDays.includes(day)) {
        return current;
      }

      const nextValues = current[scope].includes(day)
        ? current[scope].filter((item) => item !== day)
        : [...current[scope], day];

      if (scope === "orderingDays") {
        const nextOrderingDays = nextValues;
        return {
          ...current,
          orderingDays: nextOrderingDays,
          orderingBlockedDays: current.orderingBlockedDays.filter((item) => nextOrderingDays.includes(item)),
        };
      }

      if (scope === "receivingDays") {
        const nextReceivingDays = nextValues;
        return {
          ...current,
          receivingDays: nextReceivingDays,
          receivingBlockedDays: current.receivingBlockedDays.filter((item) => nextReceivingDays.includes(item)),
        };
      }

      return {
        ...current,
        [scope]: nextValues,
      };
    });
  }

  function openNewStore() {
    setDialogMode("edit");
    setEditingStore(null);
    const nextFormState = buildLojaFormState();
    setFormState(nextFormState);
    setFormBaseline(JSON.stringify(nextFormState));
    setFormError(null);
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!formState.name.trim() || !formState.responsibleProfileId?.trim()) {
      setFormError("Informe nome e selecione um usuário do tipo loja para vincular o acesso.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(
        editingStore
          ? `/api/master-data/stores/${editingStore.id}`
          : "/api/master-data/stores",
        {
          method: editingStore ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formState),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao salvar loja");
      }

      await refresh();
      setIsDialogOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Falha ao salvar loja");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageLayout
      title="Gestão de Lojas"
      description="Configure os dias operacionais por loja e centralize horário limite e D+X como regras globais."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Lojas" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard title="Registros Ativos" value={`${lojas.length} lojas`} icon={Building2} tone="success" />
        <KPICard
          title="Última Atualização"
          value={isLoading ? "Carregando..." : `${lojas.filter((store) => store.status === "ativo").length} ativas`}
          icon={Clock3}
          tone="neutral"
        />
      </div>

      <Card className="border-info/25 bg-info/10">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Regra Global</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{snapshot.operationalSettings.orderCutoffTime}</p>
            <p className="text-sm text-muted-foreground">Horário limite do pedido</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Regra Global</p>
            <p className="mt-1 text-lg font-semibold text-foreground">D+{snapshot.operationalSettings.expeditionLeadDays}</p>
            <p className="text-sm text-muted-foreground">Lead time padrão de expedição</p>
          </div>
          <div className="text-sm text-muted-foreground">
            Os horários limite e a regra D+X agora pertencem ao sistema/fábrica. Na loja ficam somente os dias em que ela pede e recebe mercadoria.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Lojas</CardTitle>
          <Button type="button" onClick={openNewStore}>
            <Plus className="size-4" />
            Nova Loja
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código ou nome..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            showFilters={false}
          />
          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
              {error}
            </div>
          ) : null}
          {storeUsersError ? (
            <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
              {storeUsersError}
            </div>
          ) : null}
          <DataTable
            data={filteredLojas}
            columns={columns}
            actions={actions}
            keyField="id"
            onRowClick={(item) => {
              setDialogMode("view");
              setEditingStore(item);
              const nextFormState = buildLojaFormState(item);
              setFormState(nextFormState);
              setFormBaseline(JSON.stringify(nextFormState));
              setFormError(null);
              setIsDialogOpen(true);
            }}
            stickyHeader
            emptyMessage={isLoading ? "Carregando lojas..." : "Nenhuma loja encontrada"}
          />
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (!formGuard.confirmIfNeeded()) {
              return;
            }
            setFormError(null);
          }
          setIsDialogOpen(open);
        }}
      >
        <DialogContent size="3xl">
          <DialogHeader>
            <DialogTitle>
              {!editingStore ? "Cadastrar Loja" : isReadOnly ? "Visualizar Loja" : "Editar Loja"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-2">
            {formError ? (
              <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
                {formError}
              </div>
            ) : null}
            {isReadOnly ? (
              <div className="rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm text-info-foreground">
                Modo visualização: use o lápis para editar esta loja.
              </div>
            ) : null}
            {formDirty ? (
              <div className="rounded-lg border border-warning/40 bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
                Existem alterações pendentes nesta loja.
              </div>
            ) : null}

            <fieldset disabled={isReadOnly} className="grid gap-6">
            <div>
              <h3 className="mb-4 text-sm font-semibold">Informações Básicas</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nome completo da loja *</Label>
                  <Input
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Ex: Empório do Pão"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Código</Label>
                  <Input value={formState.code} disabled className="bg-muted" />
                </div>
                <div className="grid gap-2">
                  <Label>Usuário Responsável *</Label>
                  {storeUserOptions.length >= 8 ? (
                    <SearchableSelect
                      value={formState.responsibleProfileId ?? ""}
                      onValueChange={(value) => {
                        const responsibleUser = storeUsers.find((user) => user.id === value) ?? null;
                        setFormState((current) => ({
                          ...current,
                          responsibleProfileId: value,
                          responsible: responsibleUser?.name ?? current.responsible,
                        }));
                      }}
                      options={storeUserOptionsForSearch}
                      placeholder={
                        isStoreUsersLoading
                          ? "Carregando usuários de loja..."
                          : "Selecione um usuário do tipo loja"
                      }
                      searchPlaceholder="Buscar usuário responsável..."
                      emptyMessage="Nenhum usuário de loja encontrado."
                      title="Selecionar usuário responsável"
                      description="Busque pelo nome ou e-mail do usuário de loja que ficará vinculado a esta unidade."
                      disabled={isStoreUsersLoading || storeUserOptions.length === 0}
                    />
                  ) : (
                    <Select
                      value={formState.responsibleProfileId ?? undefined}
                      onValueChange={(value) => {
                        const responsibleUser = storeUsers.find((user) => user.id === value) ?? null;
                        setFormState((current) => ({
                          ...current,
                          responsibleProfileId: value,
                          responsible: responsibleUser?.name ?? current.responsible,
                        }));
                      }}
                      disabled={isStoreUsersLoading || storeUserOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isStoreUsersLoading
                              ? "Carregando usuários de loja..."
                              : "Selecione um usuário do tipo loja"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {storeUserOptions.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                            {user.status === "inativo" ? " (inativo)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Apenas usuários do perfil <strong>Loja</strong> aparecem nesta lista e o acesso à loja será vinculado automaticamente.
                  </p>
                  {!isStoreUsersLoading && storeUserOptions.length === 0 ? (
                    <p className="text-xs text-warning-foreground">
                      Nenhum usuário do tipo loja está disponível. Cadastre ou ative um usuário de loja em Usuários e Permissões para continuar.
                    </p>
                  ) : null}
                  {selectedResponsibleUser ? (
                    <p className="text-xs text-muted-foreground">
                      Vinculado a: <strong>{selectedResponsibleUser.email}</strong>
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formState.email}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="loja@email.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formState.phone}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, phone: formatBrazilPhone(event.target.value) }))
                    }
                    placeholder="(99) 99999-9999"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Janela de Recebimento</Label>
                  <Input
                    value={formState.receiveWindow}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, receiveWindow: event.target.value }))
                    }
                    placeholder="07:00 - 10:00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={formState.status}
                    onValueChange={(value) =>
                      setFormState((current) => ({ ...current, status: value as Loja["status"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="space-y-3 rounded-xl border border-border/80 bg-panel/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Dias em que a loja pode fazer pedido</h3>
                  <p className="text-xs text-muted-foreground">
                    Domingo marcado = a loja aceita pedidos no domingo.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {productionWeekDays.map((day) => (
                    <label key={`order-${day.key}`} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
                      <Checkbox
                        checked={formState.orderingDays.includes(day.key)}
                        onCheckedChange={() => toggleDay("orderingDays", day.key)}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pede domingo: <strong>{getStoreCanOrderSunday(formState) ? "sim" : "não"}</strong>
                </p>
                <div className="space-y-2 rounded-lg border border-border/70 bg-card/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Bloquear pedidos nestes dias
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {productionWeekDays.map((day) => {
                      const disabled = !formState.orderingDays.includes(day.key);

                      return (
                        <label key={`order-block-${day.key}`} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
                          <Checkbox
                            checked={formState.orderingBlockedDays.includes(day.key)}
                            disabled={disabled}
                            onCheckedChange={() => toggleDay("orderingBlockedDays", day.key)}
                          />
                          <span className={disabled ? "text-muted-foreground" : "text-foreground"}>
                            {day.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dias realmente liberados para pedido: <strong>{getEnabledOrderingDays(formState).length}</strong>
                  </p>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-border/80 bg-panel/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Dias em que a loja recebe mercadoria</h3>
                  <p className="text-xs text-muted-foreground">
                    Domingo marcado = a loja recebe mercadoria no domingo.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {productionWeekDays.map((day) => (
                    <label key={`receive-${day.key}`} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
                      <Checkbox
                        checked={formState.receivingDays.includes(day.key)}
                        onCheckedChange={() => toggleDay("receivingDays", day.key)}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Recebe domingo: <strong>{getStoreReceivesSunday(formState) ? "sim" : "não"}</strong>
                </p>
                <div className="space-y-2 rounded-lg border border-border/70 bg-card/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Bloquear recebimento nestes dias
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {productionWeekDays.map((day) => {
                      const disabled = !formState.receivingDays.includes(day.key);

                      return (
                        <label key={`receive-block-${day.key}`} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
                          <Checkbox
                            checked={formState.receivingBlockedDays.includes(day.key)}
                            disabled={disabled}
                            onCheckedChange={() => toggleDay("receivingBlockedDays", day.key)}
                          />
                          <span className={disabled ? "text-muted-foreground" : "text-foreground"}>
                            {day.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dias realmente liberados para recebimento: <strong>{getEnabledReceivingDays(formState).length}</strong>
                  </p>
                </div>
              </section>
            </div>
            </fieldset>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!formGuard.confirmIfNeeded()) {
                  return;
                }
                setIsDialogOpen(false);
              }}
              disabled={isSubmitting}
            >
              {isReadOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!isReadOnly ? (
              <Button type="button" onClick={() => void handleSave()} disabled={isSubmitting}>
                {editingStore ? "Salvar" : "Cadastrar"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
