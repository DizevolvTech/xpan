"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, PencilLine, Plus, Trash2 } from "lucide-react";

import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDateBr,
  getMinimumProductionTotal,
  getPlannedDaysCount,
  getProductsByLine,
  getSchedulesByLine,
  productionLines,
  productionProducts,
  productionWeekDays,
  sectorsById,
  weeklySchedules,
  type ProductionWeekDay,
  type WeeklyProductionSchedule,
  type WeeklyScheduleItem,
} from "@/lib/production-planning";

type DraftScheduleItem = WeeklyScheduleItem;

const productNameById = new Map(productionProducts.map((product) => [product.id, product.name]));
const productUnitById = new Map(productionProducts.map((product) => [product.id, product.productionUnit]));
const dayIndexByKey = new Map(productionWeekDays.map((day, index) => [day.key, index]));

function getNextScheduleCode(schedules: WeeklyProductionSchedule[]) {
  const currentMax = schedules.reduce((max, schedule) => {
    const numberOnly = Number(schedule.code.replace(/\D/g, ""));
    if (!Number.isFinite(numberOnly)) {
      return max;
    }
    return Math.max(max, numberOnly);
  }, 8400);

  return `SL-${currentMax + 1}`;
}

export default function LinhaProducaoDetailsPage() {
  const params = useParams<{ lineId: string }>();
  const lineId = typeof params.lineId === "string" ? params.lineId : "";
  const [scheduleRows, setScheduleRows] = useState<WeeklyProductionSchedule[]>(weeklySchedules);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [draftSublineName, setDraftSublineName] = useState("");
  const [draftProductId, setDraftProductId] = useState(() => getProductsByLine(lineId)[0]?.id ?? "");
  const [draftMinimum, setDraftMinimum] = useState("");
  const [draftDays, setDraftDays] = useState<ProductionWeekDay[]>([]);
  const [draftItems, setDraftItems] = useState<DraftScheduleItem[]>([]);

  const line = useMemo(
    () => productionLines.find((item) => item.id === lineId) ?? null,
    [lineId],
  );

  const lineProducts = useMemo(
    () => (line ? getProductsByLine(line.id) : []),
    [line],
  );

  const lineSchedules = useMemo(
    () => (line ? getSchedulesByLine(line.id, scheduleRows) : []),
    [line, scheduleRows],
  );

  const selectedSchedule = useMemo(() => {
    const explicitSelection = lineSchedules.find((schedule) => schedule.id === selectedScheduleId);
    if (explicitSelection) {
      return explicitSelection;
    }
    return lineSchedules.find((schedule) => schedule.status === "ativo") ?? lineSchedules[0] ?? null;
  }, [lineSchedules, selectedScheduleId]);
  const scheduleNameById = useMemo(
    () => new Map(lineSchedules.map((schedule) => [schedule.id, schedule.name])),
    [lineSchedules],
  );

  const sortProductionDays = (days: ProductionWeekDay[]) =>
    [...days].sort((a, b) => (dayIndexByKey.get(a) ?? 0) - (dayIndexByKey.get(b) ?? 0));

  const resetDraftForm = () => {
    setEditingScheduleId(null);
    setDraftSublineName("");
    setDraftItems([]);
    setDraftMinimum("");
    setDraftDays([]);
    setDraftProductId(lineProducts[0]?.id ?? "");
  };

  const startEditingSchedule = (schedule: WeeklyProductionSchedule) => {
    setEditingScheduleId(schedule.id);
    setDraftSublineName(schedule.name);
    const nowToken = Date.now();
    const nextDraftItems = schedule.items.map((item) => ({
      ...item,
      id: `draft-${nowToken}-${item.productId}`,
      productionDays: sortProductionDays(item.productionDays),
    }));
    setDraftItems(nextDraftItems);
    setDraftProductId(nextDraftItems[0]?.productId ?? lineProducts[0]?.id ?? "");
    setDraftMinimum(nextDraftItems[0] ? String(nextDraftItems[0].minimumProduction) : "");
    setDraftDays(nextDraftItems[0]?.productionDays ?? []);
  };

  const toggleDraftDay = (dayKey: ProductionWeekDay) => {
    setDraftDays((previous) => {
      if (previous.includes(dayKey)) {
        return previous.filter((day) => day !== dayKey);
      }
      return sortProductionDays([...previous, dayKey]);
    });
  };

  const addDraftItem = () => {
    const minimumProduction = Number(draftMinimum);
    if (
      !draftProductId ||
      !Number.isFinite(minimumProduction) ||
      minimumProduction <= 0 ||
      draftDays.length === 0
    ) {
      return;
    }

    setDraftItems((previous) => {
      const alreadyExists = previous.find((item) => item.productId === draftProductId);
      if (alreadyExists) {
        return previous.map((item) =>
          item.productId === draftProductId
            ? { ...item, minimumProduction, productionDays: sortProductionDays(draftDays) }
            : item,
        );
      }

      return [
        ...previous,
        {
          id: `draft-${Date.now()}`,
          productId: draftProductId,
          minimumProduction,
          productionDays: sortProductionDays(draftDays),
        },
      ];
    });

    setDraftMinimum("");
    setDraftDays([]);
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((previous) => previous.filter((item) => item.id !== id));
  };

  const submitSublineForAudit = () => {
    if (!line || draftItems.length === 0 || !draftSublineName.trim()) {
      return;
    }

    const nowIsoDate = new Date().toISOString().slice(0, 10);
    const timestamp = Date.now();
    const nextSchedule: WeeklyProductionSchedule = {
      id: `schedule-${timestamp}`,
      code: getNextScheduleCode(scheduleRows),
      name: draftSublineName.trim(),
      lineId: line.id,
      revisionOfId: editingScheduleId ?? undefined,
      status: "pendente",
      createdAt: nowIsoDate,
      createdBy: editingScheduleId ? "Gestor de Dados (Revisão)" : "Gestor de Dados",
      items: draftItems.map((item) => ({
        id: `item-${timestamp}-${item.productId}`,
        productId: item.productId,
        minimumProduction: item.minimumProduction,
        productionDays: sortProductionDays(item.productionDays),
      })),
    };

    setScheduleRows((previous) => [nextSchedule, ...previous]);
    setSelectedScheduleId(nextSchedule.id);
    resetDraftForm();
  };

  if (!line) {
    return (
      <PageLayout
        title="Linha de Produção não encontrada"
        description="A linha solicitada não existe ou foi removida."
        badge="Dados Mestres"
        breadcrumbs={[
          { label: "Gestor de Dados", href: "/gestor-dados" },
          { label: "Linhas de Produção", href: "/gestor-dados/linhas-producao" },
          { label: "Detalhes" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-dados/linhas-producao">
              <ArrowLeft className="size-4" />
              Voltar para linhas
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Verifique se o código da linha está correto e tente novamente.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`${line.code} · ${line.name}`}
      description="Selecione, visualize e revise sublinhas em agenda semanal; toda revisão volta para auditoria."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Linhas de Produção", href: "/gestor-dados/linhas-producao" },
        { label: line.name },
      ]}
      actions={
        <Button asChild type="button" variant="outline">
          <Link href="/gestor-dados/linhas-producao">
            <ArrowLeft className="size-4" />
            Voltar para linhas
          </Link>
        </Button>
      }
    >
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Setor</p>
            <p className="mt-1 text-sm font-medium">{sectorsById.get(line.sectorId)?.name ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Horário</p>
            <p className="mt-1 text-sm font-medium">{line.operatingHours}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Capacidade/dia</p>
            <p className="mt-1 text-sm font-medium">{line.capacityPerDayKg} Kg</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={line.status} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos Vinculados à Linha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Produção Mínima
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {lineProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="border-t border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground"
                    >
                      Esta linha não possui produtos vinculados.
                    </td>
                  </tr>
                ) : (
                  lineProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{product.code}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{product.name}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {product.minimumProductionKg} {product.productionUnit}
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3">
                        <StatusBadge status={product.active ? "ativo" : "inativo"} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Sublinha de Produção (Cadastro e Revisão)</CardTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={resetDraftForm}>
              Nova Sublinha
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!selectedSchedule}
              onClick={() => selectedSchedule && startEditingSchedule(selectedSchedule)}
            >
              <PencilLine className="size-4" />
              Editar Sublinha Selecionada
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editingScheduleId && (
            <div className="rounded-lg border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning-foreground">
              Você está editando uma sublinha existente. Ao salvar, será criada uma revisão pendente de nova
              auditoria.
            </div>
          )}

          <div className="grid gap-3 rounded-xl border border-border/80 bg-panel p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="grid gap-2">
              <Label>Nome da Sublinha</Label>
              <Input
                placeholder="Ex: Sublinha Pães Premium"
                value={draftSublineName}
                onChange={(event) => setDraftSublineName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Produto</Label>
              <Select value={draftProductId} onValueChange={setDraftProductId} disabled={lineProducts.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {lineProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantidade mínima</Label>
              <Input
                type="number"
                min={0}
                placeholder="Ex: 120"
                value={draftMinimum}
                onChange={(event) => setDraftMinimum(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={addDraftItem}
                className="w-full lg:w-auto"
                disabled={lineProducts.length === 0 || draftDays.length === 0}
              >
                <Plus className="size-4" />
                Adicionar ao calendário
              </Button>
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border border-border/80 bg-panel p-4">
            <Label>Dias da semana em produção</Label>
            <div className="flex flex-wrap gap-2">
              {productionWeekDays.map((day) => {
                const selected = draftDays.includes(day.key);
                return (
                  <Button
                    key={day.key}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    onClick={() => toggleDraftDay(day.key)}
                  >
                    {day.shortLabel}
                  </Button>
                );
              })}
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
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {draftItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={productionWeekDays.length + 3}
                      className="border-t border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground"
                    >
                      Adicione produtos e dias da semana para montar a agenda semanal da sublinha.
                    </td>
                  </tr>
                ) : (
                  draftItems.map((item) => (
                    <tr key={item.id}>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {productNameById.get(item.productId) ?? "-"}
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {item.minimumProduction} {productUnitById.get(item.productId) ?? ""}
                      </td>
                      {productionWeekDays.map((day) => (
                        <td
                          key={`${item.id}-${day.key}`}
                          className="border-t border-border/70 bg-card px-3 py-3 text-center text-sm font-semibold text-foreground"
                        >
                          {item.productionDays.includes(day.key) ? "●" : ""}
                        </td>
                      ))}
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger-foreground/80 hover:bg-danger/40 hover:text-danger-foreground"
                          onClick={() => removeDraftItem(item.id)}
                          aria-label="Remover item"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            onClick={submitSublineForAudit}
            disabled={!draftSublineName.trim() || draftItems.length === 0}
          >
            <CalendarDays className="size-4" />
            {editingScheduleId ? "Enviar Revisão para Auditoria" : "Enviar Sublinha para Auditoria"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sublinhas da Linha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Sublinha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Revisão de</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produtos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Dias Planejados
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Mínimo Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lineSchedules.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="border-t border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground"
                    >
                      Esta linha ainda não possui sublinha cadastrada.
                    </td>
                  </tr>
                ) : (
                  lineSchedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{schedule.code}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{schedule.name}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {schedule.revisionOfId ? scheduleNameById.get(schedule.revisionOfId) ?? schedule.revisionOfId : "-"}
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3">
                        <StatusBadge status={schedule.status} />
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {schedule.items.length} produtos
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {getPlannedDaysCount(schedule)} dias/semana
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                        {getMinimumProductionTotal(schedule)}
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedSchedule?.id === schedule.id ? "default" : "outline"}
                            onClick={() => setSelectedScheduleId(schedule.id)}
                          >
                            Visualizar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedScheduleId(schedule.id);
                              startEditingSchedule(schedule);
                            }}
                          >
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Agenda Semanal da Sublinha Selecionada</CardTitle>
          {lineSchedules.length > 0 && (
            <div className="w-full sm:w-[340px]">
              <Select value={selectedSchedule?.id ?? ""} onValueChange={setSelectedScheduleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma sublinha" />
                </SelectTrigger>
                <SelectContent>
                  {lineSchedules.map((schedule) => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.name} · {schedule.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedSchedule ? (
            <p className="text-sm text-muted-foreground">
              Não existe sublinha cadastrada para esta linha.
            </p>
          ) : (
            <>
              <div className="grid gap-3 rounded-lg border border-border/80 bg-panel p-4 md:grid-cols-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Código</p>
                  <p className="mt-1 text-sm font-semibold">{selectedSchedule.code}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Nome</p>
                  <p className="mt-1 text-sm font-semibold">{selectedSchedule.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedSchedule.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Auditado em</p>
                  <p className="mt-1 text-sm font-semibold">
                    {selectedSchedule.auditedAt ? formatDateBr(selectedSchedule.auditedAt) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Dias Planejados</p>
                  <p className="mt-1 text-sm font-semibold">{getPlannedDaysCount(selectedSchedule)} dias/semana</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
                {productionWeekDays.map((day) => {
                  const dayItems = selectedSchedule.items.filter((item) => item.productionDays.includes(day.key));
                  return (
                    <article
                      key={day.key}
                      className="flex min-h-[210px] flex-col rounded-xl border border-border/80 bg-card shadow-[var(--shadow-soft)]"
                    >
                      <header className="flex items-center justify-between border-b border-border/70 bg-panel px-3 py-2">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
                          {day.label}
                        </h4>
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {dayItems.length}
                        </span>
                      </header>
                      <div className="flex-1 space-y-2 px-3 py-3">
                        {dayItems.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem produção programada.</p>
                        ) : (
                          dayItems.map((item) => (
                            <div key={item.id} className="rounded-lg border border-border/70 bg-surface px-2.5 py-2">
                              <p className="text-xs font-semibold text-foreground">
                                {productNameById.get(item.productId) ?? "-"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Mínimo: {item.minimumProduction} {productUnitById.get(item.productId) ?? ""}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
