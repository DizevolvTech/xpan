"use client";

import { useMemo, useState } from "react";
import { Building2, Clock3, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { InfoHint } from "@/components/shared/info-hint";
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
    deliveryZone: store?.deliveryZone ?? null,
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
    {
      key: "code",
      header: "Código",
      render: (item: Loja) => (
        <span className="text-sm font-medium tabular-nums text-foreground">{item.code}</span>
      ),
    },
    {
      key: "name",
      header: "Loja",
      render: (item: Loja) => (
        <div className="space-y-0.5">
          <span className="block text-sm font-semibold text-foreground">{item.name}</span>
          <span className="block text-[11px] text-muted-foreground/80">
            {item.responsible?.trim() ? `Resp.: ${item.responsible}` : "Sem responsável vinculado"}
          </span>
        </div>
      ),
    },
    {
      key: "orderingDays",
      header: "Pedido",
      render: (item: Loja) => {
        const total = (item.orderingDays ?? []).length;
        const blocked = (item.orderingBlockedDays ?? []).length;
        return (
          <div className="space-y-0.5">
            <span className="block text-sm tabular-nums text-foreground">{total} dias</span>
            {blocked > 0 ? (
              <span className="block text-[11px] tabular-nums text-muted-foreground/80">
                {blocked} bloqueado{blocked > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "receivingDays",
      header: "Recebimento",
      render: (item: Loja) => {
        const total = (item.receivingDays ?? []).length;
        const blocked = (item.receivingBlockedDays ?? []).length;
        return (
          <div className="space-y-0.5">
            <span className="block text-sm tabular-nums text-foreground">{total} dias</span>
            {blocked > 0 ? (
              <span className="block text-[11px] tabular-nums text-muted-foreground/80">
                {blocked} bloqueado{blocked > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "receivesSunday",
      header: "Recebe Domingo",
      render: (item: Loja) => (
        <span className="text-sm text-foreground">
          {getStoreReceivesSunday(item) ? "Sim" : "Não"}
        </span>
      ),
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
    if (!formState.name.trim()) {
      setFormError("Informe o nome da loja antes de salvar.");
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
      description="Dias operacionais por loja. Horário limite e D+X são regras globais."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Lojas" },
      ]}
      actions={
        <Button type="button" onClick={openNewStore}>
          <Plus className="size-4" />
          Nova Loja
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard title="Registros Ativos" value={`${lojas.length} lojas`} icon={Building2} tone="success" />
        <KPICard
          title="Lojas Ativas"
          value={isLoading ? "Carregando..." : `${lojas.filter((store) => store.status === "ativo").length} ativas`}
          icon={Clock3}
          tone="neutral"
        />
      </div>

      {/* Regra global — pílula discreta, não Card. Setting pertence ao sistema/fábrica. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/70 bg-panel/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-[0.08em] text-muted-foreground/90">
          Regra Global
        </span>
        <span className="text-foreground">
          Horário limite{" "}
          <strong className="font-semibold tabular-nums">
            {snapshot.operationalSettings.orderCutoffTime}
          </strong>
        </span>
        <span aria-hidden="true" className="text-muted-foreground/40">·</span>
        <span className="text-foreground">
          Lead time{" "}
          <strong className="font-semibold tabular-nums">
            D+{snapshot.operationalSettings.expeditionLeadDays}
          </strong>
        </span>
        <InfoHint
          size="xs"
          content="Horários limite e D+X pertencem ao sistema/fábrica. Na loja ficam apenas os dias em que ela pede e recebe mercadoria."
        />
      </div>

      <section className="space-y-3">
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
      </section>

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
              <div className="flex flex-col gap-3 rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm text-info-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>Modo visualização: revise os dados da loja sem alterar o cadastro.</span>
                {editingStore ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogMode("edit")}>
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                ) : null}
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
                  <div className="flex items-center gap-1.5">
                    <Label>Usuário Responsável</Label>
                    <InfoHint
                      size="sm"
                      content={
                        <p className="text-muted-foreground">
                          Apenas usuários do perfil <strong>Loja</strong> aparecem nesta lista. Você pode deixar esse vínculo para depois e concluir o cadastro agora.
                        </p>
                      }
                    />
                  </div>
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
                          : "Vincular depois (opcional)"
                      }
                      searchPlaceholder="Buscar usuário responsável..."
                      emptyMessage="Nenhum usuário de loja encontrado."
                      title="Selecionar usuário responsável"
                      description="Busque pelo nome ou e-mail do usuário de loja que ficará vinculado a esta unidade. Esse vínculo é opcional no cadastro inicial."
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
                              : "Vincular depois (opcional)"
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
                  {!isStoreUsersLoading && storeUserOptions.length === 0 ? (
                    <p className="text-xs text-warning-foreground">
                      Nenhum usuário do tipo loja está disponível no momento. A loja pode ser cadastrada agora e o vínculo pode ser feito depois em Usuários e Permissões.
                    </p>
                  ) : null}
                  {selectedResponsibleUser ? (
                    <p className="text-xs text-muted-foreground">
                      Vinculado a: <strong>{selectedResponsibleUser.email}</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Nenhum usuário vinculado ainda.
                    </p>
                  )}
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
                  <Label htmlFor="store-delivery-zone">Zona de Entrega</Label>
                  <Input
                    id="store-delivery-zone"
                    value={formState.deliveryZone ?? ""}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        deliveryZone: event.target.value.length > 0 ? event.target.value : null,
                      }))
                    }
                    placeholder="Centro, Norte, Industrial…"
                    readOnly={isReadOnly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Opcional. Agrupa entregas na mesma rota. Vazio = roteirização cai na janela horária.
                  </p>
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
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground">Dias em que a loja pode fazer pedido</h3>
                  <InfoHint size="sm" content="Domingo marcado = a loja aceita pedidos no domingo." />
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
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground">Dias em que a loja recebe mercadoria</h3>
                  <InfoHint size="sm" content="Domingo marcado = a loja recebe mercadoria no domingo." />
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
