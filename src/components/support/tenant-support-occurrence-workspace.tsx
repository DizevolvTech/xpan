"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LifeBuoy,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  SearchCheck,
} from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { SearchFilter } from "@/components/shared/search-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  canTenantActorUpdateSupportStatus,
  tenantSupportOccurrenceCategoryLabels,
  tenantSupportOccurrenceCategoryOptions,
  tenantSupportOccurrencePriorityLabels,
  tenantSupportOccurrencePriorityOptions,
  tenantSupportOccurrenceStatusOptions,
  type CreateTenantSupportOccurrenceInput,
  type TenantSupportOccurrence,
  type TenantSupportOccurrenceDetail,
  type TenantSupportOccurrencePriority,
  type TenantSupportOccurrenceStatus,
} from "@/lib/tenant-support-occurrences";
import { useTenantSupportOccurrences } from "@/lib/use-tenant-support-occurrences";

type TenantSupportOccurrenceWorkspaceProps = {
  apiBasePath: string;
  mode: "tenant" | "master";
  title: string;
  description: string;
  onMutated?: () => void | Promise<void>;
};

function formatDateTimeBr(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateIso));
}

function buildPriorityBadge(priority: TenantSupportOccurrencePriority) {
  const label = tenantSupportOccurrencePriorityLabels[priority];

  if (priority === "alta") {
    return (
      <span className="inline-flex items-center rounded-full bg-danger/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-danger-foreground">
        {label}
      </span>
    );
  }

  if (priority === "media") {
    return (
      <span className="inline-flex items-center rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-warning-foreground">
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary-foreground">
      {label}
    </span>
  );
}

function buildMasterTransitionActions(
  status: TenantSupportOccurrenceStatus,
) {
  const baseActions: Array<{
    label: string;
    status: TenantSupportOccurrenceStatus;
    icon: typeof SearchCheck;
  }> = [
    { label: "Em análise", status: "em_analise", icon: SearchCheck },
    {
      label: "Aguardar cliente",
      status: "aguardando_cliente",
      icon: MessageSquarePlus,
    },
    { label: "Marcar resolvida", status: "resolvida", icon: CheckCircle2 },
    { label: "Fechar", status: "fechada", icon: CheckCircle2 },
    { label: "Reabrir", status: "aberta", icon: RotateCcw },
  ];

  return baseActions.filter((action) => action.status !== status);
}

function buildTenantTransitionActions(
  status: TenantSupportOccurrenceStatus,
) {
  const baseActions: Array<{
    label: string;
    status: TenantSupportOccurrenceStatus;
    icon: typeof CheckCircle2;
  }> = [
    { label: "Confirmar fechamento", status: "fechada", icon: CheckCircle2 },
    { label: "Reabrir", status: "aberta", icon: RotateCcw },
  ];

  return baseActions.filter((action) =>
    canTenantActorUpdateSupportStatus(status, action.status),
  );
}

async function notifyWorkspaceMutation(onMutated?: () => void | Promise<void>) {
  await Promise.resolve(onMutated?.());
}

export function TenantSupportOccurrenceWorkspace({
  apiBasePath,
  mode,
  title,
  description,
  onMutated,
}: TenantSupportOccurrenceWorkspaceProps) {
  const {
    occurrences,
    createOccurrence,
    fetchOccurrenceDetail,
    updateOccurrenceStatus,
    addOccurrenceComment,
    error,
    isLoading,
    isSubmitting,
  } = useTenantSupportOccurrences(apiBasePath);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(
    null,
  );
  const [selectedOccurrence, setSelectedOccurrence] =
    useState<TenantSupportOccurrenceDetail | null>(null);
  const [detailComment, setDetailComment] = useState("");
  const [detailError, setDetailError] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTenantSupportOccurrenceInput>({
    title: "",
    category: "usuarios",
    priority: "media",
    description: "",
  });

  const filteredOccurrences = useMemo(
    () =>
      occurrences.filter((item) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch =
          normalizedSearch.length === 0 ||
          item.code.toLowerCase().includes(normalizedSearch) ||
          item.title.toLowerCase().includes(normalizedSearch) ||
          item.description.toLowerCase().includes(normalizedSearch);
        const matchesStatus = statusFilter === "all" || item.status === statusFilter;

        return matchesSearch && matchesStatus;
      }),
    [occurrences, searchTerm, statusFilter],
  );

  const columns = [
    { key: "code", header: "Código" },
    {
      key: "title",
      header: "Assunto",
      render: (item: TenantSupportOccurrence) => (
        <div className="min-w-[15rem] space-y-0.5">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {tenantSupportOccurrenceCategoryLabels[item.category]}
          </p>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Prioridade",
      render: (item: TenantSupportOccurrence) => buildPriorityBadge(item.priority),
    },
    {
      key: "lastMessageAt",
      header: "Última interação",
      render: (item: TenantSupportOccurrence) => formatDateTimeBr(item.lastMessageAt),
    },
    {
      key: "status",
      header: "Status",
      render: (item: TenantSupportOccurrence) => (
        <StatusBadge status={item.status} />
      ),
    },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: TenantSupportOccurrence) => {
        void openOccurrenceDetail(item.id);
      },
    },
  ];

  async function openOccurrenceDetail(occurrenceId: string) {
    setSelectedOccurrenceId(occurrenceId);
    setSelectedOccurrence(null);
    setDetailComment("");
    setDetailError("");
    setIsDetailLoading(true);

    try {
      const detail = await fetchOccurrenceDetail(occurrenceId);
      setSelectedOccurrence(detail);
    } catch (fetchError) {
      setDetailError(
        fetchError instanceof Error
          ? fetchError.message
          : "Falha ao carregar a ocorrência.",
      );
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleCreateOccurrence() {
    try {
      const created = await createOccurrence(form);
      await notifyWorkspaceMutation(onMutated);
      setSelectedOccurrenceId(created.id);
      setSelectedOccurrence(created);
      setIsCreateDialogOpen(false);
      setCreateError(null);
      setForm({
        title: "",
        category: "usuarios",
        priority: "media",
        description: "",
      });
    } catch (createOccurrenceError) {
      setCreateError(
        createOccurrenceError instanceof Error
          ? createOccurrenceError.message
          : "Não foi possível abrir a ocorrência.",
      );
    }
  }

  async function handleStatusChange(status: TenantSupportOccurrenceStatus) {
    if (!selectedOccurrence) {
      return;
    }

    try {
      const updated = await updateOccurrenceStatus(selectedOccurrence.id, status);
      await notifyWorkspaceMutation(onMutated);
      setSelectedOccurrence(updated);
      setDetailError("");
    } catch (updateError) {
      setDetailError(
        updateError instanceof Error
          ? updateError.message
          : "Não foi possível atualizar a ocorrência.",
      );
    }
  }

  async function handleAddComment() {
    if (!selectedOccurrence || detailComment.trim().length === 0) {
      return;
    }

    try {
      const updated = await addOccurrenceComment(
        selectedOccurrence.id,
        detailComment.trim(),
      );
      await notifyWorkspaceMutation(onMutated);
      setSelectedOccurrence(updated);
      setDetailComment("");
      setDetailError("");
    } catch (commentError) {
      setDetailError(
        commentError instanceof Error
          ? commentError.message
          : "Não foi possível registrar a mensagem.",
      );
    }
  }

  const detailActions = selectedOccurrence
    ? mode === "master"
      ? buildMasterTransitionActions(selectedOccurrence.status)
      : buildTenantTransitionActions(selectedOccurrence.status)
    : [];

  return (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        <KPICard
          title="Abertas"
          value={occurrences.filter((item) => item.status === "aberta").length}
          icon={AlertCircle}
          tone="danger"
        />
        <KPICard
          title="Em análise"
          value={
            occurrences.filter((item) => item.status === "em_analise").length
          }
          icon={SearchCheck}
          tone="warning"
        />
        <KPICard
          title="Aguardando cliente"
          value={
            occurrences.filter((item) => item.status === "aguardando_cliente")
              .length
          }
          icon={MessageSquarePlus}
          tone="info"
        />
        <KPICard
          title="Resolvidas/Fechadas"
          value={
            occurrences.filter((item) =>
              ["resolvida", "fechada"].includes(item.status),
            ).length
          }
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Button
            type="button"
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={isSubmitting}
          >
            <Plus className="size-4" />
            Nova ocorrência
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
              {error}
            </div>
          ) : null}

          <SearchFilter
            searchPlaceholder="Buscar por código ou assunto..."
            searchValue={searchTerm}
            onSearch={setSearchTerm}
            filters={[
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "all", label: "Todos" },
                  ...tenantSupportOccurrenceStatusOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ],
              },
            ]}
          />

          <DataTable
            data={filteredOccurrences}
            columns={columns}
            actions={actions}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="Nenhuma ocorrência encontrada."
            onRowClick={(item) => {
              void openOccurrenceDetail(item.id);
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova ocorrência</DialogTitle>
            <DialogDescription>
              Abra um chamado administrativo com contexto suficiente para acelerar
              a resposta entre cliente e sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="support-title">Assunto</Label>
              <Input
                id="support-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Ex.: Admin inicial ficou bloqueado por e-mail duplicado"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      category: value as CreateTenantSupportOccurrenceInput["category"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantSupportOccurrenceCategoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      priority: value as CreateTenantSupportOccurrenceInput["priority"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantSupportOccurrencePriorityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="support-description">Descrição</Label>
              <Textarea
                id="support-description"
                rows={5}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Explique o contexto, o impacto e o que já foi tentado."
              />
            </div>

            {createError ? (
              <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                {createError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateOccurrence()}
              disabled={isSubmitting}
            >
              <LifeBuoy className="size-4" />
              Abrir ocorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedOccurrenceId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOccurrenceId(null);
            setSelectedOccurrence(null);
            setDetailComment("");
            setDetailError("");
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedOccurrence
                ? `${selectedOccurrence.code} · ${selectedOccurrence.title}`
                : "Ocorrência"}
            </DialogTitle>
            <DialogDescription>
              Linha de conversa e governança do chamado entre cliente e sistema.
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="rounded-lg border border-border/70 bg-panel/20 px-4 py-6 text-sm text-muted-foreground">
              Carregando ocorrência...
            </div>
          ) : null}

          {selectedOccurrence ? (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Status
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={selectedOccurrence.status} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Categoria
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {tenantSupportOccurrenceCategoryLabels[selectedOccurrence.category]}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Prioridade
                    </p>
                    <div className="mt-2">
                      {buildPriorityBadge(selectedOccurrence.priority)}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Contexto inicial
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {selectedOccurrence.description}
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Conversa
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Última interação em{" "}
                      {formatDateTimeBr(selectedOccurrence.lastMessageAt)}
                    </p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {selectedOccurrence.events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg border border-border/70 bg-card px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {event.actorName ?? event.actorRoleLabel ?? "Sistema"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {event.actorRoleLabel ?? "Sistema"} ·{" "}
                              {formatDateTimeBr(event.createdAt)}
                            </p>
                          </div>
                          {event.type === "status" ? (
                            <span className="inline-flex items-center rounded-full bg-panel px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                              Status
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                          {event.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Próxima ação
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detailActions.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Nenhuma transição disponível neste momento.
                      </span>
                    ) : (
                      detailActions.map((action) => (
                        <Button
                          key={action.status}
                          type="button"
                          size="sm"
                          variant={
                            action.status === "fechada" ? "outline" : "default"
                          }
                          onClick={() => void handleStatusChange(action.status)}
                          disabled={isSubmitting}
                        >
                          <action.icon className="size-4" />
                          {action.label}
                        </Button>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="support-comment">Nova mensagem</Label>
                    <Textarea
                      id="support-comment"
                      rows={6}
                      value={detailComment}
                      onChange={(event) => setDetailComment(event.target.value)}
                      placeholder="Escreva o próximo passo, a dúvida pendente ou a confirmação de resolução."
                      disabled={!selectedOccurrence.canComment}
                    />
                    {!selectedOccurrence.canComment ? (
                      <p className="text-xs text-muted-foreground">
                        Este chamado está fechado. Reabra a ocorrência para seguir
                        com a conversa.
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void handleAddComment()}
                      disabled={
                        isSubmitting ||
                        !selectedOccurrence.canComment ||
                        detailComment.trim().length === 0
                      }
                    >
                      <MessageSquarePlus className="size-4" />
                      Enviar mensagem
                    </Button>
                  </div>
                </div>

                {detailError ? (
                  <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                    {detailError}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedOccurrenceId(null)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
