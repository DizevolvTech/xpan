"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, MessageSquarePlus, SearchCheck, RotateCcw } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { PageLayout } from "@/components/shared/page-layout";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    { key: "code", header: "Código" },
    {
      key: "storeName",
      header: "Loja",
      render: (item: StoreOccurrence) => storeNameById.get(item.storeId) ?? item.storeId,
    },
    { key: "orderCode", header: "Pedido" },
    { key: "productName", header: "Produto" },
    { key: "problemType", header: "Tipo" },
    {
      key: "updatedAt",
      header: "Última atualização",
      render: (item: StoreOccurrence) => formatDateTimeBr(item.updatedAt),
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
      description="Central de triagem e resolução das ocorrências abertas pelas lojas."
      badge="Gestor de Fábrica"
      breadcrumbs={[{ label: "Gestor de Fábrica", href: "/gestor-fabrica" }, { label: "Ocorrências" }]}
    >
      <div className="grid gap-3 md:grid-cols-4">
        <KPICard title="Abertas" value={occurrences.filter((item) => item.status === "aberta").length} icon={AlertCircle} tone="danger" />
        <KPICard title="Em análise" value={occurrences.filter((item) => item.status === "em_analise").length} icon={SearchCheck} tone="warning" />
        <KPICard title="Resolvidas" value={occurrences.filter((item) => item.status === "resolvida").length} icon={CheckCircle2} tone="success" />
        <KPICard title="Fechadas" value={occurrences.filter((item) => item.status === "fechada").length} icon={RotateCcw} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fila de ocorrências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

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
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{selectedOccurrence?.code ?? "Ocorrência"}</DialogTitle>
            <DialogDescription>
              Análise, comentários e resolução conduzidos pela fábrica.
            </DialogDescription>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Carregando ocorrência...</div>
          ) : selectedOccurrence ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/80 bg-panel/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Loja</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {storeNameById.get(selectedOccurrence.storeId) ?? selectedOccurrence.storeId}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-panel/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pedido</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{selectedOccurrence.orderCode}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Produto afetado</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{selectedOccurrence.productName}</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Quantidade afetada</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedOccurrence.quantityType === "percentual"
                      ? `${selectedOccurrence.quantity}%`
                      : `${selectedOccurrence.quantity} ${selectedOccurrence.quantityUnit}`}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Tipo do problema</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{selectedOccurrence.problemType}</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedOccurrence.status} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Descrição</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{selectedOccurrence.description}</p>
              </div>

              <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                <p>Abertura: {formatDateTimeBr(selectedOccurrence.createdAt)}</p>
                <p>Última atualização: {formatDateTimeBr(selectedOccurrence.updatedAt)}</p>
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

              <div className="rounded-lg border border-border/80 bg-panel/25 p-4">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Timeline da ocorrência</p>
                </div>
                <div className="mt-3 grid gap-3">
                  {selectedOccurrence.events.map((event) => (
                    <article key={event.id} className="rounded-lg border border-border/70 bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{event.content}</p>
                        <span className="text-xs text-muted-foreground">{formatDateTimeBr(event.createdAt)}</span>
                      </div>
                      {event.actorName ? (
                        <p className="mt-1 text-xs text-muted-foreground">Responsável: {event.actorName}</p>
                      ) : null}
                    </article>
                  ))}
                </div>

                <div className="mt-4 grid gap-2">
                  <Label htmlFor="factory-occurrence-comment">Novo comentário</Label>
                  <Textarea
                    id="factory-occurrence-comment"
                    value={detailComment}
                    onChange={(event) => setDetailComment(event.target.value)}
                    placeholder="Registre a análise, causa, ação corretiva ou alinhamento com a loja."
                    className="min-h-[100px]"
                    disabled={!selectedOccurrence.canComment || isDetailSubmitting}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selectedOccurrence.canComment || detailComment.trim().length === 0 || isDetailSubmitting}
                      onClick={() => void handleAddComment()}
                    >
                      <MessageSquarePlus className="size-4" />
                      Adicionar comentário
                    </Button>
                  </div>
                </div>
              </div>

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
