"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Clock, PauseCircle, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
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
import {
  formatDateBr,
  productionWeekDays,
  type WeeklyProductionSchedule,
} from "@/lib/production-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import {
  buildLineDaySummariesFromData,
  buildLineById,
  buildSectorNameById,
  getProductsByLineFromData,
} from "@/lib/production-data-utils";

type SublinhaRow = WeeklyProductionSchedule & {
  lineName: string;
  sectorName: string;
  itemsCount: number;
  minimumTotal: number;
  plannedDays: number;
  daySummaries: ReturnType<typeof buildLineDaySummariesFromData>;
};

export default function SublinhasProducaoPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [auditNotes, setAuditNotes] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const linesById = useMemo(() => buildLineById(snapshot.lines), [snapshot.lines]);
  const sectorNameById = useMemo(() => buildSectorNameById(snapshot.sectors), [snapshot.sectors]);

  const scheduleRows = useMemo<SublinhaRow[]>(
    () =>
      snapshot.schedules.map((schedule) => {
        const line = linesById.get(schedule.lineId);
        const lineProducts = getProductsByLineFromData(schedule.lineId, snapshot.products).filter((product) => product.active);
        const daySummaries = buildLineDaySummariesFromData(schedule.lineId, snapshot.products);
        return {
          ...schedule,
          lineName: line?.name ?? "-",
          sectorName: line ? sectorNameById.get(line.sectorId) ?? "-" : "-",
          itemsCount: lineProducts.length,
          minimumTotal: Number(
            lineProducts.reduce((total, product) => total + product.minimumProductionKg, 0).toFixed(2),
          ),
          plannedDays: daySummaries.filter((day) => day.productsCount > 0).length,
          daySummaries,
        };
      }),
    [linesById, sectorNameById, snapshot.products, snapshot.schedules],
  );

  const selectedSchedule = useMemo(
    () => scheduleRows.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [scheduleRows, selectedScheduleId],
  );
  const selectedLineProducts = useMemo(
    () =>
      selectedSchedule
        ? getProductsByLineFromData(selectedSchedule.lineId, snapshot.products).filter((product) => product.active)
        : [],
    [selectedSchedule, snapshot.products],
  );
  const selectedDayBoards = useMemo(
    () => {
      const orderedDays = [
        ...productionWeekDays.filter((day) => day.key !== "domingo"),
        ...productionWeekDays.filter((day) => day.key === "domingo"),
      ];

      return orderedDays
        .map((day) => {
        const products = selectedLineProducts.filter((product) => product.productionDays.includes(day.key));
        const plannedKg = Number(
          products.reduce((total, product) => total + product.minimumProductionKg, 0).toFixed(2),
        );
        return {
          ...day,
          products,
          plannedKg,
        };
        })
        .filter((day) => day.key !== "domingo" || day.products.length > 0);
    },
    [selectedLineProducts],
  );
  const scheduleNameById = useMemo(
    () => new Map(scheduleRows.map((schedule) => [schedule.id, schedule.name])),
    [scheduleRows],
  );

  const filteredSublinhas = useMemo(
    () =>
      scheduleRows.filter((item) => {
        const matchesSearch =
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.lineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sectorName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || item.status === statusFilter;
        const matchesLine = lineFilter === "all" || item.lineId === lineFilter;
        return matchesSearch && matchesStatus && matchesLine;
      }),
    [lineFilter, scheduleRows, searchTerm, statusFilter],
  );

  const kpis = {
    total: scheduleRows.length,
    pendentes: scheduleRows.filter((item) => item.status === "pendente").length,
    ativas: scheduleRows.filter((item) => item.status === "ativo").length,
    inativas: scheduleRows.filter((item) => item.status === "inativo").length,
  };

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Linha" },
    { key: "lineName", header: "Subcategoria" },
    { key: "sectorName", header: "Categoria" },
    { key: "itemsCount", header: "Produtos" },
    {
      key: "daySummaries",
      header: "Visão Semanal",
      render: (item: SublinhaRow) => (
        <div className="flex flex-wrap gap-1.5">
          {item.daySummaries
            .filter((day) => day.productsCount > 0)
            .map((day) => (
              <span
                key={`${item.id}-${day.day}`}
                className="rounded-full border border-border/80 bg-panel px-2 py-1 text-[11px] font-medium text-foreground"
              >
                {day.shortLabel} · {day.productsCount} itens · {day.plannedKg} Kg
              </span>
            ))}
        </div>
      ),
    },
    { key: "minimumTotal", header: "Carga Base (Kg)" },
    { key: "status", header: "Status", render: (item: SublinhaRow) => <StatusBadge status={item.status} /> },
    { key: "createdBy", header: "Criado Por" },
  ];

  const openScheduleDetails = (schedule: SublinhaRow) => {
    setSelectedScheduleId(schedule.id);
    setAuditNotes(schedule.auditNotes ?? "");
    setIsDetailsOpen(true);
  };

  const actions = [
    { icon: "view" as const, label: "Visualizar", onClick: openScheduleDetails },
    {
      icon: "edit" as const,
      label: "Auditar / Operar",
      onClick: openScheduleDetails,
    },
  ];

  const updateScheduleStatus = async (nextStatus: "ativo" | "inativo") => {
    if (!selectedSchedule) {
      return;
    }

    setIsSubmitting(true);
    setPageError(null);

    try {
      const response = await fetch(`/api/master-data/schedules/${selectedSchedule.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
          auditNotes,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao atualizar linha");
      }

      await refresh();
      setIsDetailsOpen(false);
    } catch (updateError) {
      setPageError(updateError instanceof Error ? updateError.message : "Falha ao atualizar linha");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout
      title="Linhas"
      description="Visão consolidada por dia da semana, derivada dos produtos vinculados em cada subcategoria."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Linhas" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Total Linhas" value={String(kpis.total)} icon={Clock} tone="info" />
        <KPICard title="Pendentes" value={String(kpis.pendentes)} icon={Clock} tone="warning" />
        <KPICard title="Ativas" value={String(kpis.ativas)} icon={PlayCircle} tone="success" />
        <KPICard title="Inativas" value={String(kpis.inativas)} icon={PauseCircle} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Linhas Executoras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código, linha, subcategoria ou categoria..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            filters={[
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "pendente", label: "Pendente" },
                  { value: "ativo", label: "Ativa" },
                  { value: "inativo", label: "Inativa" },
                ],
              },
              {
                key: "line",
                label: "Subcategoria",
                value: lineFilter,
                onChange: setLineFilter,
                options: snapshot.lines.map((line) => ({ value: line.id, label: line.name })),
              },
            ]}
          />
          {error || pageError ? (
            <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
              {pageError ?? error}
            </div>
          ) : null}
          <DataTable
            data={filteredSublinhas}
            columns={columns}
            actions={actions}
            keyField="id"
            emptyMessage={isLoading ? "Carregando linhas..." : "Nenhuma linha encontrada"}
            stickyHeader
          />
        </CardContent>
      </Card>

      <Dialog
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) {
            setSelectedScheduleId(null);
            setAuditNotes("");
          }
        }}
      >
        <DialogContent size="2xl" className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {selectedSchedule ? `${selectedSchedule.name} · ${selectedSchedule.code}` : "Auditoria"}
            </DialogTitle>
          </DialogHeader>

          {selectedSchedule && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border border-border/80 bg-panel p-4 md:grid-cols-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Linha</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedSchedule.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Subcategoria</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedSchedule.lineName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Categoria</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedSchedule.sectorName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedSchedule.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Produtos Ativos</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedSchedule.itemsCount} produtos
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border/80">
                <div className="grid gap-px bg-border/80 md:grid-cols-2 xl:grid-cols-7">
                  {selectedDayBoards.map((day) => (
                    <div key={`${selectedSchedule.id}-${day.key}`} className="bg-card">
                      <div className="border-b border-border/80 bg-amber-600 px-3 py-2 text-white">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em]">{day.label}</p>
                        <p className="mt-1 text-[11px] text-amber-50">
                          {day.products.length} itens · {day.plannedKg} Kg
                        </p>
                      </div>
                      <div className="min-h-44 space-y-2 px-3 py-3">
                        {day.products.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem produção programada.</p>
                        ) : (
                          day.products.map((product) => (
                            <div key={`${day.key}-${product.id}`} className="border-b border-dashed border-border/70 pb-2 last:border-b-0 last:pb-0">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                                {product.code}
                              </p>
                              <p className="text-sm font-medium text-foreground">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.minimumProductionKg} Kg mínimos</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border border-border/80 bg-card p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Resumo da Linha</p>
                <p className="text-sm text-foreground">
                  <strong>{selectedSchedule.name}</strong> criada por <strong>{selectedSchedule.createdBy}</strong> em{" "}
                  <strong>{formatDateBr(selectedSchedule.createdAt)}</strong> com{" "}
                  <strong>{selectedSchedule.itemsCount} produtos</strong> e mínimo total de{" "}
                  <strong>{selectedSchedule.minimumTotal} Kg</strong>.
                </p>
                {selectedSchedule.revisionOfId && (
                  <p className="text-sm text-muted-foreground">
                    Revisão da linha{" "}
                    {scheduleNameById.get(selectedSchedule.revisionOfId) ?? selectedSchedule.revisionOfId}.
                  </p>
                )}
                {selectedSchedule.auditedBy && selectedSchedule.auditedAt && (
                  <p className="text-sm text-muted-foreground">
                    Auditada por {selectedSchedule.auditedBy} em {formatDateBr(selectedSchedule.auditedAt)}.
                  </p>
                )}
                {selectedSchedule.deactivatedBy && selectedSchedule.deactivatedAt && (
                  <p className="text-sm text-muted-foreground">
                    Desativada por {selectedSchedule.deactivatedBy} em{" "}
                    {formatDateBr(selectedSchedule.deactivatedAt)}.
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">Observações</label>
                <Textarea
                  value={auditNotes}
                  onChange={(event) => setAuditNotes(event.target.value)}
                  placeholder="Descreva observações da auditoria ou da operação..."
                  className="min-h-[110px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="justify-between sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Fechar
            </Button>
            {selectedSchedule?.status === "pendente" ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-danger-foreground/35 text-danger-foreground hover:bg-danger/35"
                  onClick={() => void updateScheduleStatus("inativo")}
                  disabled={isSubmitting}
                >
                  <PauseCircle className="size-4" />
                  Não Aprovar
                </Button>
                <Button type="button" onClick={() => void updateScheduleStatus("ativo")} disabled={isSubmitting}>
                  <CheckCircle className="size-4" />
                  Aprovar e Ativar
                </Button>
              </div>
            ) : selectedSchedule?.status === "ativo" ? (
              <Button
                type="button"
                variant="outline"
                className="border-danger-foreground/35 text-danger-foreground hover:bg-danger/35"
                onClick={() => void updateScheduleStatus("inativo")}
                disabled={isSubmitting}
              >
                <PauseCircle className="size-4" />
                Desativar Linha
              </Button>
            ) : (
              <Button type="button" onClick={() => void updateScheduleStatus("ativo")} disabled={isSubmitting}>
                <PlayCircle className="size-4" />
                Reativar Linha
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
