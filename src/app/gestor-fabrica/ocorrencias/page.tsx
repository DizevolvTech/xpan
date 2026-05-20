"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  MessageSquarePlus,
  SearchCheck,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { PageLayout } from "@/components/shared/page-layout";
import { SearchFilter } from "@/components/shared/search-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import {
  useStoreOccurrences,
  type StoreOccurrence,
  type StoreOccurrenceDetail,
} from "@/lib/use-store-occurrences";

function formatDateTimeBr(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateIso));
}

function buildFactoryTransitionActions(status: StoreOccurrence["status"]) {
  if (status === "aberta") {
    return [{ label: "Iniciar análise", status: "em_analise" as const, icon: SearchCheck }];
  }

  if (status === "em_analise") {
    return [
      { label: "Marcar resolvida", status: "resolvida" as const, icon: CheckCircle2 },
      { label: "Voltar para aberta", status: "aberta" as const, icon: RotateCcw },
    ];
  }

  if (status === "resolvida" || status === "fechada") {
    return [{ label: "Reabrir", status: "aberta" as const, icon: RotateCcw }];
  }

  return [];
}

// FlatKpi local — mesmo padrão visual de loja/pedidos (Onda 1).
// Rail vertical + ícone em chip + número tabular-nums grande.
type FlatKpiTone = "neutral" | "info" | "success" | "warning" | "danger";
const flatKpiToneStyles: Record<FlatKpiTone, { rail: string; icon: string }> = {
  neutral: { rail: "bg-border-strong", icon: "bg-secondary text-secondary-foreground" },
  info: { rail: "bg-info", icon: "bg-info/[var(--opacity-subtle)] text-info" },
  success: { rail: "bg-success", icon: "bg-success/[var(--opacity-subtle)] text-success" },
  warning: { rail: "bg-warning", icon: "bg-warning/[var(--opacity-subtle)] text-warning" },
  danger: { rail: "bg-danger", icon: "bg-danger/[var(--opacity-subtle)] text-danger" },
};

function FlatKpi({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  tone: FlatKpiTone;
}) {
  const styles = flatKpiToneStyles[tone];
  return (
    <article className="group relative flex items-center gap-3.5 overflow-hidden rounded-lg bg-card/60 px-4 py-3.5 transition-colors duration-200 hover:bg-card">
      <span
        className={cn(
          "pointer-events-none absolute inset-y-2.5 left-0 w-[3px] rounded-r-full opacity-70 transition-opacity duration-200 group-hover:opacity-100",
          styles.rail,
        )}
        aria-hidden
      />
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-[1.04]",
          styles.icon,
        )}
        aria-hidden
      >
        <Icon className="size-[1.05rem]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-0.5 font-heading text-[1.45rem] font-bold leading-none tracking-[-0.022em] text-foreground tabular-nums">
          {value}
        </p>
      </div>
    </article>
  );
}

export default function GestorFabricaOcorrenciasPage() {
  const { snapshot } = useMasterDataSnapshot();
  const {
    occurrences,
    fetchOccurrenceDetail,
    updateOccurrenceStatus,
    addOccurrenceComment,
    error,
    isLoading,
  } = useStoreOccurrences();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<StoreOccurrenceDetail | null>(null);
  const [detailComment, setDetailComment] = useState("");
  const [detailError, setDetailError] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailSubmitting, setIsDetailSubmitting] = useState(false);

  const storeNameById = useMemo(
    () => new Map(snapshot.stores.map((store) => [store.id, store.name])),
    [snapshot.stores],
  );

  const statusCounts = useMemo(() => {
    const counts = { aberta: 0, em_analise: 0, resolvida: 0, fechada: 0 };
    for (const item of occurrences) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
  }, [occurrences]);

  const filteredOccurrences = useMemo(
    () =>
      occurrences.filter((item) => {
        const matchesSearch =
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.orderCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.productName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || item.status === statusFilter;
        const matchesStore = storeFilter === "all" || item.storeId === storeFilter;
        return matchesSearch && matchesStatus && matchesStore;
      }),
    [occurrences, searchTerm, statusFilter, storeFilter],
  );

  const storeOptions = useMemo(
    () =>
      Array.from(new Set(occurrences.map((item) => item.storeId)))
        .map((storeId) => ({
          value: storeId,
          label: storeNameById.get(storeId) ?? storeId,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [occurrences, storeNameById],
  );

  const columns = [
    {
      key: "code",
      header: "Código",
      render: (item: StoreOccurrence) => (
        <span className="font-mono text-[11px] text-muted-foreground/90">{item.code}</span>
      ),
    },
    {
      key: "problemType",
      header: "Tipo",
      render: (item: StoreOccurrence) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.problemType}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{item.productName}</p>
        </div>
      ),
    },
    {
      key: "storeName",
      header: "Loja",
      render: (item: StoreOccurrence) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">
            {storeNameById.get(item.storeId) ?? item.storeId}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/80">
            {item.orderCode}
          </p>
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "Última atualização",
      render: (item: StoreOccurrence) => (
        <span className="tabular-nums text-[12px] text-muted-foreground">
          {formatDateTimeBr(item.updatedAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: StoreOccurrence) => <StatusBadge status={item.status} />,
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
      setDetailError(fetchError instanceof Error ? fetchError.message : "Falha ao carregar ocorrência.");
    } finally {
      setIsDetailLoading(false);
    }
  }

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: StoreOccurrence) => {
        void openOccurrenceDetail(item.id);
      },
    },
  ];

  async function handleStatusChange(status: StoreOccurrence["status"]) {
    if (!selectedOccurrence) {
      return;
    }

    setIsDetailSubmitting(true);
    setDetailError("");
    try {
      const updated = await updateOccurrenceStatus(selectedOccurrence.id, status);
      setSelectedOccurrence(updated);
    } catch (updateError) {
      setDetailError(updateError instanceof Error ? updateError.message : "Falha ao atualizar ocorrência.");
    } finally {
      setIsDetailSubmitting(false);
    }
  }

  async function handleAddComment() {
    if (!selectedOccurrence || detailComment.trim().length === 0) {
      return;
    }

    setIsDetailSubmitting(true);
    setDetailError("");
    try {
      const updated = await addOccurrenceComment(selectedOccurrence.id, detailComment.trim());
      setSelectedOccurrence(updated);
      setDetailComment("");
    } catch (commentError) {
      setDetailError(commentError instanceof Error ? commentError.message : "Falha ao registrar comentário.");
    } finally {
      setIsDetailSubmitting(false);
    }
  }

  const detailActions = selectedOccurrence ? buildFactoryTransitionActions(selectedOccurrence.status) : [];

  return (
    <PageLayout
      title="Ocorrências"
      description="Triagem das ocorrências abertas pelas lojas."
      badge="Gestor de Fábrica"
      breadcrumbs={[{ label: "Gestor de Fábrica", href: "/gestor-fabrica" }, { label: "Ocorrências" }]}
    >
      {/* P2 — 3 KPIs primários (Abertas / Em análise / Resolvidas);
          Fechada vira linha-stats menor abaixo. */}
      <div className="grid gap-3 md:grid-cols-3">
        <FlatKpi
          title="Abertas"
          value={statusCounts.aberta}
          icon={AlertCircle}
          tone="danger"
        />
        <FlatKpi
          title="Em análise"
          value={statusCounts.em_analise}
          icon={SearchCheck}
          tone="warning"
        />
        <FlatKpi
          title="Resolvidas"
          value={statusCounts.resolvida}
          icon={CheckCircle2}
          tone="success"
        />
      </div>
      <p className="text-[11px] tabular-nums text-muted-foreground/80">
        Fechadas: {statusCounts.fechada} · Total no período: {occurrences.length}
      </p>

      {/* P5 — wrapper Card removido; toolbar + tabela como primeira dobra. */}
      <section aria-labelledby="fila-ocorrencias-title" className="space-y-4">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/[var(--opacity-divider)] pb-3">
          <h2
            id="fila-ocorrencias-title"
            className="font-heading text-base font-semibold tracking-[-0.005em] text-foreground"
          >
            Fila de ocorrências
          </h2>
          <span className="text-[11px] tabular-nums text-muted-foreground/80">
            {filteredOccurrences.length} de {occurrences.length}
          </span>
        </header>

        {error ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
            {error}
          </div>
        ) : null}

        <SearchFilter
          searchPlaceholder="Buscar por código, pedido ou produto..."
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
                { value: "aberta", label: "Aberta" },
                { value: "em_analise", label: "Em análise" },
                { value: "resolvida", label: "Resolvida" },
                { value: "fechada", label: "Fechada" },
              ],
            },
            {
              key: "store",
              label: "Loja",
              value: storeFilter,
              onChange: setStoreFilter,
              options: [{ value: "all", label: "Todas" }, ...storeOptions],
            },
          ]}
        />

        <DataTable
          data={filteredOccurrences}
          columns={columns}
          actions={actions}
          keyField="id"
          onRowClick={(item) => {
            void openOccurrenceDetail(item.id);
          }}
          emptyMessage="Nenhuma ocorrência encontrada"
          isLoading={isLoading}
        />
      </section>

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
        {/* xl (max-w-3xl) → 2xl (max-w-4xl): timeline + comentário precisam de respiro. */}
        <DialogContent size="2xl">
          <DialogHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="font-mono text-base">
                {selectedOccurrence?.code ?? "Ocorrência"}
              </DialogTitle>
              {selectedOccurrence ? <StatusBadge status={selectedOccurrence.status} /> : null}
            </div>
            {selectedOccurrence ? (
              <p className="text-[11px] tabular-nums text-muted-foreground/80">
                Aberta em {formatDateTimeBr(selectedOccurrence.createdAt)} · atualizada em{" "}
                {formatDateTimeBr(selectedOccurrence.updatedAt)}
              </p>
            ) : null}
          </DialogHeader>

          {isDetailLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Carregando ocorrência...</div>
          ) : selectedOccurrence ? (
            <div className="grid gap-4 py-2">
              {/* P4 — 6 mini-cards aninhados → 1 painel denso de 3 colunas + descrição. */}
              <div className="rounded-lg border border-border/[var(--opacity-divider)] bg-panel/40 p-4">
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Loja
                    </dt>
                    <dd className="mt-0.5 truncate text-sm text-foreground">
                      {storeNameById.get(selectedOccurrence.storeId) ?? selectedOccurrence.storeId}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Pedido
                    </dt>
                    <dd className="mt-0.5 truncate font-mono text-sm text-foreground">
                      {selectedOccurrence.orderCode}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Tipo do problema
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">
                      {selectedOccurrence.problemType}
                    </dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Produto afetado
                    </dt>
                    <dd className="mt-0.5 truncate text-sm text-foreground">
                      {selectedOccurrence.productName}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Quantidade afetada
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
                      {selectedOccurrence.quantityType === "percentual"
                        ? `${selectedOccurrence.quantity}%`
                        : `${selectedOccurrence.quantity} ${selectedOccurrence.quantityUnit}`}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-border/[var(--opacity-divider)] pt-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Descrição
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                    {selectedOccurrence.description}
                  </p>
                </div>
              </div>

              {detailActions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {detailActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.status}
                        type="button"
                        variant={action.status === "resolvida" ? "default" : "outline"}
                        disabled={isDetailSubmitting}
                        onClick={() => void handleStatusChange(action.status)}
                      >
                        <Icon className="size-4" />
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              ) : null}

              {/* Timeline — sem mini-card por evento; rail vertical à esquerda + tipografia em hierarquia. */}
              <section aria-labelledby="timeline-title" className="space-y-3">
                <header className="flex items-center gap-2 border-b border-border/[var(--opacity-divider)] pb-2">
                  <MessageSquarePlus className="size-4 text-muted-foreground" aria-hidden />
                  <h3
                    id="timeline-title"
                    className="font-heading text-sm font-semibold text-foreground"
                  >
                    Timeline
                  </h3>
                  <span className="text-[11px] tabular-nums text-muted-foreground/80">
                    {selectedOccurrence.events.length} evento
                    {selectedOccurrence.events.length === 1 ? "" : "s"}
                  </span>
                </header>

                {selectedOccurrence.events.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
                ) : (
                  <ol className="relative space-y-3 border-l border-border/[var(--opacity-divider)] pl-4">
                    {selectedOccurrence.events.map((event) => (
                      <li key={event.id} className="relative">
                        <span
                          className="absolute -left-[calc(1rem+3px)] top-1.5 size-1.5 rounded-full bg-border-strong"
                          aria-hidden
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm text-foreground">{event.content}</p>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
                            {formatDateTimeBr(event.createdAt)}
                          </span>
                        </div>
                        {event.actorName ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                            por {event.actorName}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}

                <div className="grid gap-2 pt-1">
                  <Label htmlFor="factory-occurrence-comment" className="text-xs">
                    Novo comentário
                  </Label>
                  <Textarea
                    id="factory-occurrence-comment"
                    value={detailComment}
                    onChange={(event) => setDetailComment(event.target.value)}
                    placeholder="Registre a análise, causa, ação corretiva ou alinhamento com a loja."
                    className="min-h-[96px]"
                    disabled={!selectedOccurrence.canComment || isDetailSubmitting}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        !selectedOccurrence.canComment ||
                        detailComment.trim().length === 0 ||
                        isDetailSubmitting
                      }
                      onClick={() => void handleAddComment()}
                    >
                      <MessageSquarePlus className="size-4" />
                      Adicionar comentário
                    </Button>
                  </div>
                </div>
              </section>

              {detailError ? (
                <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                  {detailError}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="py-8 text-sm text-muted-foreground">
              Não foi possível carregar os dados da ocorrência.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedOccurrenceId(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
