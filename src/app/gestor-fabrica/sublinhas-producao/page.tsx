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
  getMinimumProductionTotal,
  getPlannedDaysCount,
  linesById,
  productsById,
  productionLines,
  productionWeekDays,
  sectorsById,
  weeklySchedules,
  type WeeklyProductionSchedule,
} from "@/lib/production-planning";

type SublinhaRow = WeeklyProductionSchedule & {
  lineName: string;
  sectorName: string;
  itemsCount: number;
  minimumTotal: number;
  plannedDays: number;
};

export default function SublinhasProducaoPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [scheduleRowsState, setScheduleRowsState] = useState<WeeklyProductionSchedule[]>(weeklySchedules);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [auditNotes, setAuditNotes] = useState("");

  const scheduleRows = useMemo<SublinhaRow[]>(
    () =>
      scheduleRowsState.map((schedule) => {
        const line = linesById.get(schedule.lineId);
        const sector = line ? sectorsById.get(line.sectorId) : undefined;
        return {
          ...schedule,
          lineName: line?.name ?? "-",
          sectorName: sector?.name ?? "-",
          itemsCount: schedule.items.length,
          minimumTotal: getMinimumProductionTotal(schedule),
          plannedDays: getPlannedDaysCount(schedule),
        };
      }),
    [scheduleRowsState],
  );

  const selectedSchedule = useMemo(
    () => scheduleRows.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [scheduleRows, selectedScheduleId],
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
    { key: "name", header: "Sublinha" },
    { key: "lineName", header: "Linha de Produção" },
    { key: "sectorName", header: "Setor" },
    { key: "itemsCount", header: "Produtos" },
    { key: "plannedDays", header: "Dias Planejados" },
    { key: "minimumTotal", header: "Mínimo Total" },
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

  const updateScheduleStatus = (nextStatus: "ativo" | "inativo") => {
    if (!selectedSchedule) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    setScheduleRowsState((previous) =>
      previous.map((schedule) => {
        if (schedule.id === selectedSchedule.id) {
          const wasPending = schedule.status === "pendente";
          const nextSchedule: WeeklyProductionSchedule = {
            ...schedule,
            status: nextStatus,
            auditNotes: auditNotes.trim() || undefined,
            auditedAt: wasPending ? today : schedule.auditedAt,
            auditedBy: wasPending ? "Gestor de Fábrica" : schedule.auditedBy,
            deactivatedAt: nextStatus === "inativo" ? today : undefined,
            deactivatedBy: nextStatus === "inativo" ? "Gestor de Fábrica" : undefined,
          };

          return nextSchedule;
        }

        const shouldInactivatePreviousActive =
          nextStatus === "ativo" &&
          schedule.lineId === selectedSchedule.lineId &&
          schedule.id !== selectedSchedule.id &&
          schedule.status === "ativo";

        if (!shouldInactivatePreviousActive) {
          return schedule;
        }

        return {
          ...schedule,
          status: "inativo",
          deactivatedAt: today,
          deactivatedBy: "Gestor de Fábrica",
        };
      }),
    );

    setIsDetailsOpen(false);
  };

  return (
    <PageLayout
      title="Sublinhas de Produção"
      description="Sublinhas contínuas por linha, auditadas uma vez e mantidas em produção até desativação."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Sublinhas de Produção" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Total Sublinhas" value={String(kpis.total)} icon={Clock} tone="info" />
        <KPICard title="Pendentes" value={String(kpis.pendentes)} icon={Clock} tone="warning" />
        <KPICard title="Ativas" value={String(kpis.ativas)} icon={PlayCircle} tone="success" />
        <KPICard title="Inativas" value={String(kpis.inativas)} icon={PauseCircle} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Sublinhas Contínuas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código, nome, linha ou setor..."
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
                label: "Linha",
                value: lineFilter,
                onChange: setLineFilter,
                options: productionLines.map((line) => ({ value: line.id, label: line.name })),
              },
            ]}
          />
          <DataTable
            data={filteredSublinhas}
            columns={columns}
            actions={actions}
            keyField="id"
            emptyMessage="Nenhuma sublinha encontrada"
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
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Sublinha</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedSchedule.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Linha</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedSchedule.lineName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Setor</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedSchedule.sectorName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedSchedule.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Dias Planejados</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedSchedule.plannedDays} dias/semana
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border/80">
                <table className="w-full border-collapse">
                  <thead className="bg-panel">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Mínimo</th>
                      {productionWeekDays.map((day) => (
                        <th key={day.key} className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                          {day.shortLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSchedule.items.map((item) => {
                      const product = productsById.get(item.productId);
                      return (
                        <tr key={item.id}>
                          <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                            {product?.name ?? item.productId}
                          </td>
                          <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                            {item.minimumProduction} {product?.productionUnit ?? ""}
                          </td>
                          {productionWeekDays.map((day) => (
                            <td
                              key={`${item.id}-${day.key}`}
                              className="border-t border-border/70 bg-card px-3 py-3 text-center text-sm font-semibold text-foreground"
                            >
                              {item.productionDays.includes(day.key) ? "●" : ""}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 rounded-lg border border-border/80 bg-card p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Resumo da Sublinha</p>
                <p className="text-sm text-foreground">
                  <strong>{selectedSchedule.name}</strong> criada por <strong>{selectedSchedule.createdBy}</strong> em{" "}
                  <strong>{formatDateBr(selectedSchedule.createdAt)}</strong> com{" "}
                  <strong>{selectedSchedule.itemsCount} produtos</strong> e mínimo total de{" "}
                  <strong>{selectedSchedule.minimumTotal}</strong>.
                </p>
                {selectedSchedule.revisionOfId && (
                  <p className="text-sm text-muted-foreground">
                    Revisão da sublinha{" "}
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
                  onClick={() => updateScheduleStatus("inativo")}
                >
                  <PauseCircle className="size-4" />
                  Não Aprovar
                </Button>
                <Button type="button" onClick={() => updateScheduleStatus("ativo")}>
                  <CheckCircle className="size-4" />
                  Aprovar e Ativar
                </Button>
              </div>
            ) : selectedSchedule?.status === "ativo" ? (
              <Button
                type="button"
                variant="outline"
                className="border-danger-foreground/35 text-danger-foreground hover:bg-danger/35"
                onClick={() => updateScheduleStatus("inativo")}
              >
                <PauseCircle className="size-4" />
                Desativar Sublinha
              </Button>
            ) : (
              <Button type="button" onClick={() => updateScheduleStatus("ativo")}>
                <PlayCircle className="size-4" />
                Reativar Sublinha
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
