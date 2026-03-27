"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchFilter } from "@/components/shared/search-filter";
import { PageLayout } from "@/components/shared/page-layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatDateBr,
  productionWeekDays,
  type ProductionProduct,
  type WeeklyProductionSchedule,
} from "@/lib/production-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import {
  buildLineById,
  buildSectorNameById,
  getMinimumProductionTotalFromSchedule,
  getPlannedDaysCountFromSchedule,
  sortScheduleEntriesForDay,
} from "@/lib/production-data-utils";

type AuditableScheduleProduct = {
  snapshotId: string;
  productId: string;
  code: string;
  name: string;
  minimumProduction: number;
  productionDays: ProductionProduct["productionDays"];
  dayPriorities: WeeklyProductionSchedule["items"][number]["dayPriorities"];
  masterLineName: string;
  operationalLineName: string;
};

type ScheduleDayBoard = {
  key: ProductionProduct["productionDays"][number];
  shortLabel: string;
  label: string;
  products: AuditableScheduleProduct[];
  plannedKg: number;
};

type SublinhaRow = WeeklyProductionSchedule & {
  lineName: string;
  sectorName: string;
  itemsCount: number;
  minimumTotal: number;
  plannedDays: number;
  daySummaries: {
    day: ProductionProduct["productionDays"][number];
    shortLabel: string;
    label: string;
    productsCount: number;
    plannedKg: number;
  }[];
  snapshotProducts: AuditableScheduleProduct[];
};

function formatKgLabel(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function buildScheduleSnapshotProducts(
  schedule: WeeklyProductionSchedule,
  productsById: Map<string, ProductionProduct>,
  lineNameById: Map<string, string>,
): AuditableScheduleProduct[] {
  return schedule.items
    .map((item) => {
      const product = productsById.get(item.productId);
      return {
        snapshotId: item.id,
        productId: item.productId,
        code: product?.code ?? item.productId,
        name: product?.name ?? "Produto não encontrado",
        minimumProduction: item.minimumProduction,
        productionDays: item.productionDays,
        dayPriorities: item.dayPriorities,
        masterLineName: product ? lineNameById.get(product.masterLineId ?? product.lineId) ?? "-" : "-",
        operationalLineName: product?.operationalLineId
          ? lineNameById.get(product.operationalLineId) ?? "-"
          : "Fora do cronograma ativo",
      };
    })
    .sort((left, right) => `${left.code} ${left.name}`.localeCompare(`${right.code} ${right.name}`, "pt-BR"));
}

function buildScheduleDaySummariesFromSnapshotProducts(products: AuditableScheduleProduct[]) {
  return productionWeekDays.map((day) => {
    const productsForDay = products.filter((product) => product.productionDays.includes(day.key));
    return {
      day: day.key,
      shortLabel: day.shortLabel,
      label: day.label,
      productsCount: productsForDay.length,
      plannedKg: Number(
        productsForDay.reduce((total, product) => total + product.minimumProduction, 0).toFixed(2),
      ),
    };
  });
}

function buildDayBoardPriorityPayload(dayBoards: ScheduleDayBoard[]) {
  return dayBoards.reduce<Record<string, WeeklyProductionSchedule["items"][number]["dayPriorities"]>>(
    (acc, day) => {
      day.products.forEach((product, index) => {
        acc[product.snapshotId] = {
          ...(acc[product.snapshotId] ?? {}),
          [day.key]: index + 1,
        };
      });
      return acc;
    },
    {},
  );
}

function buildDayBoardSignature(dayBoards: ScheduleDayBoard[]) {
  return dayBoards
    .map((day) => `${day.key}:${day.products.map((product) => product.snapshotId).join(",")}`)
    .join("|");
}

function reorderProductsWithinDay(
  dayBoards: ScheduleDayBoard[],
  dayKey: ProductionProduct["productionDays"][number],
  draggedProductId: string,
  targetProductId?: string,
) {
  return dayBoards.map((day) => {
    if (day.key !== dayKey) {
      return day;
    }

    const nextProducts = [...day.products];
    const draggedIndex = nextProducts.findIndex((product) => product.snapshotId === draggedProductId);

    if (draggedIndex < 0) {
      return day;
    }

    const [draggedProduct] = nextProducts.splice(draggedIndex, 1);

    if (!draggedProduct) {
      return day;
    }

    if (!targetProductId) {
      nextProducts.push(draggedProduct);
      return { ...day, products: nextProducts };
    }

    const targetIndex = nextProducts.findIndex((product) => product.snapshotId === targetProductId);

    if (targetIndex < 0) {
      nextProducts.push(draggedProduct);
      return { ...day, products: nextProducts };
    }

    nextProducts.splice(targetIndex, 0, draggedProduct);
    return { ...day, products: nextProducts };
  });
}

export default function SublinhasProducaoPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [auditNotes, setAuditNotes] = useState("");
  const [draftDayBoards, setDraftDayBoards] = useState<ScheduleDayBoard[]>([]);
  const [dragState, setDragState] = useState<{
    dayKey: ProductionProduct["productionDays"][number];
    productId: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    dayKey: ProductionProduct["productionDays"][number];
    productId?: string;
  } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const linesById = useMemo(() => buildLineById(snapshot.lines), [snapshot.lines]);
  const sectorNameById = useMemo(() => buildSectorNameById(snapshot.sectors), [snapshot.sectors]);
  const lineNameById = useMemo(
    () => new Map(snapshot.lines.map((line) => [line.id, line.name])),
    [snapshot.lines],
  );
  const productsById = useMemo(
    () => new Map(snapshot.products.map((product) => [product.id, product])),
    [snapshot.products],
  );

  const scheduleRows = useMemo<SublinhaRow[]>(
    () =>
      snapshot.schedules.map((schedule) => {
        const line = linesById.get(schedule.lineId);
        const snapshotProducts = buildScheduleSnapshotProducts(schedule, productsById, lineNameById);
        const daySummaries = buildScheduleDaySummariesFromSnapshotProducts(snapshotProducts);
        return {
          ...schedule,
          lineName: line?.name ?? "-",
          sectorName: line ? sectorNameById.get(line.sectorId) ?? "-" : "-",
          itemsCount: schedule.items.length,
          minimumTotal: Number(getMinimumProductionTotalFromSchedule(schedule).toFixed(2)),
          plannedDays: getPlannedDaysCountFromSchedule(schedule),
          daySummaries,
          snapshotProducts,
        };
      }),
    [lineNameById, linesById, productsById, sectorNameById, snapshot.schedules],
  );

  const selectedSchedule = useMemo(
    () => scheduleRows.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [scheduleRows, selectedScheduleId],
  );
  const selectedLineProducts = useMemo(
    () => selectedSchedule?.snapshotProducts ?? [],
    [selectedSchedule],
  );
  const selectedDayBoards = useMemo(
    () => {
      const orderedDays = [
        ...productionWeekDays.filter((day) => day.key !== "domingo"),
        ...productionWeekDays.filter((day) => day.key === "domingo"),
      ];

      return orderedDays
        .map((day) => {
          const products = sortScheduleEntriesForDay(
            selectedLineProducts.filter((product) => product.productionDays.includes(day.key)),
            day.key,
          );
          const plannedKg = Number(
            products.reduce((total, product) => total + product.minimumProduction, 0).toFixed(2),
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
  const canEditDailyPriority = selectedSchedule?.status === "pendente";
  const persistedDayBoardSignature = useMemo(
    () => buildDayBoardSignature(selectedDayBoards),
    [selectedDayBoards],
  );
  const draftDayBoardSignature = useMemo(
    () => buildDayBoardSignature(draftDayBoards),
    [draftDayBoards],
  );
  const hasPriorityChanges =
    Boolean(canEditDailyPriority) && draftDayBoardSignature !== persistedDayBoardSignature;
  const hasAuditNotesChanges = (selectedSchedule?.auditNotes ?? "") !== auditNotes;
  const pendingAuditRows = useMemo(
    () =>
      scheduleRows
        .filter((item) => item.status === "pendente")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [scheduleRows],
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
    { key: "lineName", header: "Linha de produção" },
    { key: "sectorName", header: "Categoria" },
    { key: "itemsCount", header: "Produtos" },
    {
      key: "daySummaries",
      header: "Visão Semanal",
      render: (item: SublinhaRow) => {
        const activeDays = item.daySummaries.filter((day) => day.productsCount > 0);
        const isExpanded = expandedScheduleId === item.id;

        return (
          <div className="min-w-[220px] space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {activeDays.slice(0, 2).map((day) => (
                <span
                  key={`${item.id}-${day.day}`}
                  className="rounded-full border border-border/80 bg-panel px-2 py-1 text-[11px] font-medium text-foreground"
                >
                  {day.shortLabel} · {day.productsCount} itens · {formatKgLabel(day.plannedKg)} Kg
                </span>
              ))}
              {activeDays.length > 2 ? (
                <span className="rounded-full border border-dashed border-border/80 bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  +{activeDays.length - 2} dias
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant={isExpanded ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-1.5 px-3"
              onClick={() =>
                setExpandedScheduleId((current) => (current === item.id ? null : item.id))
              }
            >
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              {isExpanded ? "Recolher semana" : "Expandir semana"}
            </Button>
          </div>
        );
      },
    },
    {
      key: "minimumTotal",
      header: "Carga Base (Kg)",
      render: (item: SublinhaRow) => formatKgLabel(item.minimumTotal),
    },
    { key: "status", header: "Status", render: (item: SublinhaRow) => <StatusBadge status={item.status} /> },
    {
      key: "createdBy",
      header: "Criado Por",
      render: (item: SublinhaRow) => item.createdBy || "Automático",
    },
  ];

  const renderExpandedWeeklyView = (schedule: SublinhaRow) => {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 border-b border-border/70 bg-primary/[0.05] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground">
                Linha Expandida
              </span>
              <p className="text-sm font-semibold text-foreground">
                {schedule.name} · {schedule.code}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {schedule.lineName} · {schedule.sectorName} · {schedule.plannedDays} dias ativos ·{" "}
              {formatKgLabel(schedule.minimumTotal)} Kg de carga base
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-panel px-2.5 py-1">
              {schedule.itemsCount} produtos ativos
            </span>
            <span className="rounded-full border border-border/70 bg-panel px-2.5 py-1">
              Criado em {formatDateBr(schedule.createdAt)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {schedule.daySummaries.map((day) => {
            const productsForDay = sortScheduleEntriesForDay(
              schedule.snapshotProducts.filter((product) => product.productionDays.includes(day.day)),
              day.day,
            );
            const previewProducts = productsForDay.slice(0, 3);

            return (
              <div
                key={`${schedule.id}-${day.day}-expanded`}
                className="rounded-2xl border border-border/70 bg-panel/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{day.label}</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{formatKgLabel(day.plannedKg)} Kg</p>
                  </div>
                  <span className="rounded-full border border-border/70 bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    {day.productsCount} itens
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {previewProducts.length > 0 ? (
                    previewProducts.map((product) => (
                      <div
                        key={`${schedule.id}-${day.day}-${product.snapshotId}`}
                        className="rounded-xl border border-border/60 bg-card px-2.5 py-2 text-xs text-foreground"
                      >
                        <p className="font-medium">{product.name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatKgLabel(product.minimumProduction)} Kg base
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/60 bg-card px-2.5 py-3 text-xs text-muted-foreground">
                      Sem produção planejada neste dia.
                    </div>
                  )}

                  {productsForDay.length > previewProducts.length ? (
                    <div className="px-1 text-[11px] font-medium text-muted-foreground">
                      +{productsForDay.length - previewProducts.length} produtos nesta linha
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const openScheduleDetails = (schedule: SublinhaRow) => {
    setSelectedScheduleId(schedule.id);
    setAuditNotes(schedule.auditNotes ?? "");
    setIsDetailsOpen(true);
  };

  useEffect(() => {
    setDraftDayBoards(selectedDayBoards);
    setDragState(null);
    setDropTarget(null);
  }, [selectedDayBoards]);

  const actions = [
    { icon: "view" as const, label: "Visualizar", onClick: openScheduleDetails },
    {
      icon: "edit" as const,
      label: "Auditar / Operar",
      onClick: openScheduleDetails,
    },
  ];

  const updateScheduleStatus = async (
    nextStatus: "pendente" | "ativo" | "inativo",
    closeOnSuccess = true,
  ) => {
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
          dayPrioritiesByItemId: buildDayBoardPriorityPayload(draftDayBoards),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao atualizar linha");
      }

      await refresh();
      if (closeOnSuccess) {
        setIsDetailsOpen(false);
      }
    } catch (updateError) {
      setPageError(updateError instanceof Error ? updateError.message : "Falha ao atualizar linha");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProductDragStart = (
    event: DragEvent<HTMLDivElement>,
    dayKey: ProductionProduct["productionDays"][number],
    productId: string,
  ) => {
    if (!canEditDailyPriority) {
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${dayKey}:${productId}`);
    setDragState({ dayKey, productId });
  };

  const handleProductDragEnd = () => {
    setDragState(null);
    setDropTarget(null);
  };

  const handleProductDragOver = (
    event: DragEvent<HTMLDivElement>,
    dayKey: ProductionProduct["productionDays"][number],
    productId?: string,
  ) => {
    if (!dragState || dragState.dayKey !== dayKey) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget({ dayKey, productId });
  };

  const handleProductDrop = (
    event: DragEvent<HTMLDivElement>,
    dayKey: ProductionProduct["productionDays"][number],
    productId?: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!dragState || dragState.dayKey !== dayKey) {
      return;
    }

    if (productId && dragState.productId === productId) {
      setDragState(null);
      setDropTarget(null);
      return;
    }

    setDraftDayBoards((current) =>
      reorderProductsWithinDay(current, dayKey, dragState.productId, productId),
    );
    setDragState(null);
    setDropTarget(null);
  };

  return (
    <PageLayout
      title="Auditoria do cronograma ativo"
      description="Acompanhe as auditorias pendentes das linhas de produção e aprove a grade semanal que será usada pela fábrica."
      badge="Fábrica"
      breadcrumbs={[
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Auditoria do cronograma ativo" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Total de auditorias" value={String(kpis.total)} icon={Clock} tone="info" />
        <KPICard title="Pendentes" value={String(kpis.pendentes)} icon={Clock} tone="warning" />
        <KPICard title="Ativas" value={String(kpis.ativas)} icon={PlayCircle} tone="success" />
        <KPICard title="Inativas" value={String(kpis.inativas)} icon={PauseCircle} tone="neutral" />
      </div>

      {pendingAuditRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Auditorias pendentes do cronograma ativo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-2">
            {pendingAuditRows.map((schedule) => (
              <article
                key={`pending-audit-${schedule.id}`}
                className="rounded-2xl border border-warning/30 bg-warning/10 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={schedule.status} />
                      <p className="text-sm font-semibold text-foreground">
                        {schedule.lineName} · {schedule.code}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {schedule.sectorName} · {schedule.itemsCount} produtos · {schedule.plannedDays} dias ativos ·{" "}
                      {formatKgLabel(schedule.minimumTotal)} Kg base
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Criada em {formatDateBr(schedule.createdAt)} por {schedule.createdBy || "automação da plataforma"}.
                    </p>
                  </div>
                  <Button type="button" onClick={() => openScheduleDetails(schedule)}>
                    Auditar cronograma
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lista de auditorias do cronograma ativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código, linha de produção ou categoria..."
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
                label: "Linha de produção",
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
            isRowExpanded={(item) => item.id === expandedScheduleId}
            renderExpandedRow={renderExpandedWeeklyView}
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
        <DialogContent size="full" className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {selectedSchedule
                ? `Auditoria do cronograma ativo · ${selectedSchedule.lineName}`
                : "Auditoria"}
            </DialogTitle>
            <DialogDescription>
              Revise a grade completa do cronograma ativo, com os produtos aprovados e os dias planejados para fabricação.
            </DialogDescription>
          </DialogHeader>

          {selectedSchedule && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border border-border/80 bg-panel p-4 md:grid-cols-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Linha Executora</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedSchedule.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Linha de produção</p>
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

              <Card>
                <CardHeader>
                  <CardTitle>Grade auditável do cronograma ativo</CardTitle>
                </CardHeader>
                <CardContent>
                  <PaginatedSection
                    items={selectedLineProducts}
                    label="produtos da revisão"
                    initialPageSize={10}
                    pageSizeOptions={[10, 20, 40]}
                  >
                    {(items) => (
                      <div className="overflow-x-auto overscroll-x-contain">
                        <table className="w-full min-w-[980px] border-collapse rounded-xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
                          <thead className="bg-panel">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/95">
                                Produto
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/95">
                                Linha cadastral
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground/95">
                                Base (Kg)
                              </th>
                              {productionWeekDays.map((day) => (
                                <th
                                  key={`audit-schedule-grid-${day.key}`}
                                  className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground/95"
                                >
                                  {day.shortLabel}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((product) => (
                              <tr
                                key={product.snapshotId}
                                className="transition-colors duration-200 hover:bg-panel/35"
                              >
                                <td className="border-t border-border/70 bg-card px-4 py-3 align-top">
                                  <div className="font-medium text-foreground">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">{product.code}</div>
                                </td>
                                <td className="border-t border-border/70 bg-card px-4 py-3 align-top text-sm text-muted-foreground">
                                  {product.masterLineName}
                                </td>
                                <td className="border-t border-border/70 bg-card px-4 py-3 text-right align-top text-sm text-foreground">
                                  {formatKgLabel(product.minimumProduction)}
                                </td>
                                {productionWeekDays.map((day) => {
                                  const isPlannedOnDay = product.productionDays.includes(day.key);
                                  return (
                                    <td
                                      key={`${product.snapshotId}-${day.key}`}
                                      className="border-t border-border/70 bg-card px-3 py-3 text-center align-middle"
                                    >
                                      <span
                                        className={[
                                          "inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold",
                                          isPlannedOnDay
                                            ? "bg-primary/15 text-primary"
                                            : "bg-panel/70 text-muted-foreground",
                                        ].join(" ")}
                                      >
                                        {isPlannedOnDay ? "X" : "-"}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </PaginatedSection>
                </CardContent>
              </Card>

              <div
                className={
                  canEditDailyPriority
                    ? "rounded-lg border border-primary/25 bg-primary/[0.05] px-4 py-3 text-sm text-foreground"
                    : "rounded-lg border border-border/80 bg-panel/40 px-4 py-3 text-sm text-muted-foreground"
                }
              >
                {canEditDailyPriority
                  ? "Arraste os produtos dentro de cada dia para definir a prioridade da produção. Essa sequência será usada na leitura operacional da revisão."
                  : "A prioridade diária só pode ser ajustada em revisões pendentes, antes da aprovação do cronograma."}
              </div>

              {hasPriorityChanges ? (
                <div className="rounded-lg border border-warning/40 bg-warning/20 px-4 py-3 text-sm text-warning-foreground">
                  Existem alterações de prioridade diária ainda não salvas nesta revisão.
                </div>
              ) : null}

              <div className="overflow-hidden rounded-xl border border-border/80">
                <div className="grid gap-px bg-border/80 md:grid-cols-2 xl:grid-cols-7">
                  {draftDayBoards.map((day) => (
                    <div key={`${selectedSchedule.id}-${day.key}`} className="bg-card">
                      <div className="border-b border-border/80 bg-amber-600 px-3 py-2 text-white">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em]">{day.label}</p>
                        <p className="mt-1 text-[11px] text-amber-50">
                          {day.products.length} itens · {formatKgLabel(day.plannedKg)} Kg
                        </p>
                      </div>
                      <div
                        className="min-h-44 space-y-2 px-3 py-3"
                        onDragOver={(event) => handleProductDragOver(event, day.key)}
                        onDrop={(event) => handleProductDrop(event, day.key)}
                      >
                        {day.products.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem produção programada.</p>
                        ) : (
                          day.products.map((product) => (
                            <div
                              key={`${day.key}-${product.snapshotId}`}
                              draggable={canEditDailyPriority}
                              onDragStart={(event) =>
                                handleProductDragStart(event, day.key, product.snapshotId)
                              }
                              onDragEnd={handleProductDragEnd}
                              onDragOver={(event) =>
                                handleProductDragOver(event, day.key, product.snapshotId)
                              }
                              onDrop={(event) => handleProductDrop(event, day.key, product.snapshotId)}
                              className={[
                                "border-b border-dashed border-border/70 pb-2 last:border-b-0 last:pb-0",
                                canEditDailyPriority ? "cursor-grab active:cursor-grabbing" : "",
                                dragState?.productId === product.snapshotId ? "opacity-45" : "",
                                dropTarget?.dayKey === day.key && dropTarget?.productId === product.snapshotId
                                  ? "rounded-lg border border-primary/35 bg-primary/[0.05] px-2 pt-2"
                                  : "",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                                    {product.code}
                                  </p>
                                  <p className="text-sm font-medium text-foreground">{product.name}</p>
                                </div>
                                {canEditDailyPriority ? (
                                  <span className="inline-flex shrink-0 items-center justify-center rounded-md border border-border/80 bg-panel px-1.5 py-1 text-muted-foreground">
                                    <GripVertical className="size-3.5" />
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">{formatKgLabel(product.minimumProduction)} Kg mínimos</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border border-border/80 bg-card p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Resumo do cronograma auditado</p>
                <p className="text-sm text-foreground">
                  <strong>{selectedSchedule.lineName}</strong> criada por{" "}
                  <strong>{selectedSchedule.createdBy || "automação da plataforma"}</strong> em{" "}
                  <strong>{formatDateBr(selectedSchedule.createdAt)}</strong> com{" "}
                  <strong>{selectedSchedule.itemsCount} produtos</strong> e mínimo total de{" "}
                  <strong>{formatKgLabel(selectedSchedule.minimumTotal)} Kg</strong>.
                </p>
                {selectedSchedule.revisionOfId && (
                  <p className="text-sm text-muted-foreground">
                    Revisão do cronograma{" "}
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
                  onClick={() => void updateScheduleStatus("pendente", false)}
                  disabled={isSubmitting || (!hasPriorityChanges && !hasAuditNotesChanges)}
                >
                  Salvar prioridade
                </Button>
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
