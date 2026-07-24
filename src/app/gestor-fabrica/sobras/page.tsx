"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { PageLayout } from "@/components/shared/page-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductionLeftoverRow {
  id: string;
  planningKey: string;
  productId: string;
  productName: string;
  productionDate: string;
  plannedQuantity: number;
  producedQuantity: number;
  leftoverQuantity: number;
  /** true = quantidade medida no chão; false = estimativa do plano de batidas. */
  isReported: boolean;
  unit: string;
}

interface ProductionLeftoversResponse {
  referenceDate: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  leftovers: ProductionLeftoverRow[];
  totalLeftover: number;
}

const WINDOW_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBr(isoDate: string) {
  if (!isoDate) {
    return "-";
  }
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function SobrasPage() {
  const [windowDays, setWindowDays] = useState("30");
  const [referenceDate] = useState(todayIsoDate);
  const [data, setData] = useState<ProductionLeftoversResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeftovers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ referenceDate, windowDays });
      const response = await fetch(
        `/api/factory-planning/leftovers?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Não foi possível carregar as sobras e desvios.");
      }
      const payload = (await response.json()) as ProductionLeftoversResponse;
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar sobras e desvios.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [referenceDate, windowDays]);

  useEffect(() => {
    void loadLeftovers();
  }, [loadLeftovers]);

  const rows = useMemo(() => data?.leftovers ?? [], [data?.leftovers]);

  const totals = useMemo(() => {
    let sobra = 0;
    let falta = 0;
    // Quantidades medidas no chão (o operador informou). O resto é estimativa do
    // plano de batidas, que por construção nunca produz falta.
    let reportedCount = 0;
    for (const row of rows) {
      if (row.leftoverQuantity > 0) {
        sobra += row.leftoverQuantity;
      } else if (row.leftoverQuantity < 0) {
        falta += Math.abs(row.leftoverQuantity);
      }
      if (row.isReported) {
        reportedCount += 1;
      }
    }
    return { sobra, falta, reportedCount };
  }, [rows]);

  const columns = useMemo(
    () => [
      {
        key: "productName",
        header: "Produto",
        sortable: true,
        sortValue: (item: ProductionLeftoverRow) => item.productName,
        render: (item: ProductionLeftoverRow) => (
          <span className="font-medium text-foreground">{item.productName}</span>
        ),
      },
      {
        key: "productionDate",
        header: "Data",
        sortable: true,
        sortValue: (item: ProductionLeftoverRow) => item.productionDate,
        render: (item: ProductionLeftoverRow) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDateBr(item.productionDate)}
          </span>
        ),
      },
      {
        key: "plannedQuantity",
        header: "Planejado",
        sortable: true,
        sortValue: (item: ProductionLeftoverRow) => item.plannedQuantity,
        render: (item: ProductionLeftoverRow) => (
          <span className="tabular-nums">{formatQuantity(item.plannedQuantity)}</span>
        ),
      },
      {
        key: "producedQuantity",
        header: "Produzido",
        sortable: true,
        sortValue: (item: ProductionLeftoverRow) => item.producedQuantity,
        render: (item: ProductionLeftoverRow) => (
          <span className="tabular-nums">{formatQuantity(item.producedQuantity)}</span>
        ),
      },
      {
        // Sem essa distinção o gestor não sabe se o número saiu da balança ou de
        // uma conta do sistema — e só o informado consegue gerar falta.
        key: "isReported",
        header: "Origem",
        sortable: true,
        sortValue: (item: ProductionLeftoverRow) => (item.isReported ? 1 : 0),
        render: (item: ProductionLeftoverRow) =>
          item.isReported ? (
            <span
              className="inline-flex items-center rounded-full border border-border/70 bg-panel px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground"
              title="Quantidade informada pelo operador ao concluir o item da OP."
            >
              Informado
            </span>
          ) : (
            <span
              className="inline-flex items-center rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              title="Ninguém informou a quantidade: o sistema estimou pelo plano de batidas (formas inteiras), que nunca gera falta."
            >
              Estimado
            </span>
          ),
      },
      {
        key: "leftoverQuantity",
        header: "Sobra/Falta",
        sortable: true,
        sortValue: (item: ProductionLeftoverRow) => item.leftoverQuantity,
        render: (item: ProductionLeftoverRow) => {
          const value = item.leftoverQuantity;
          const tone =
            value > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : value < 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground";
          const prefix = value > 0 ? "+" : "";
          return (
            <span className={`tabular-nums font-medium ${tone}`}>
              {prefix}
              {formatQuantity(value)}
            </span>
          );
        },
      },
      {
        key: "unit",
        header: "Unidade",
        sortable: true,
        sortValue: (item: ProductionLeftoverRow) => item.unit,
        render: (item: ProductionLeftoverRow) => (
          <span className="text-muted-foreground">{item.unit}</span>
        ),
      },
    ],
    [],
  );

  const periodLabel = data
    ? `${formatDateBr(data.windowStart)} – ${formatDateBr(data.windowEnd)}`
    : "-";

  return (
    <PageLayout
      title="Sobras e Desvios"
      description="Registro INTERNO de sobras e faltas por item de produção concluído no período. Serve só para acompanhar o desvio da fábrica: não altera pedidos, não gera crédito para a loja e não realimenta o planejamento — pedido fechado não volta atrás."
      badge="Operacional"
      breadcrumbs={[
        { label: "Início", href: "/" },
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Sobras e Desvios" },
      ]}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="window-days" className="text-xs text-muted-foreground">
              Janela do período
            </Label>
            <Select value={windowDays} onValueChange={setWindowDays}>
              <SelectTrigger id="window-days" className="w-40">
                <SelectValue placeholder="Selecionar janela" />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Período: {periodLabel}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadLeftovers()}
              disabled={isLoading}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <KPICard
            title="Itens registrados"
            value={String(rows.length)}
            subtitle={`${totals.reportedCount} com quantidade informada pelo chão`}
            icon={ClipboardList}
            isLoading={isLoading}
          />
          <KPICard
            title="Total de sobras"
            value={formatQuantity(totals.sobra)}
            subtitle="Produziu a mais que o planejado"
            icon={TrendingUp}
            isLoading={isLoading}
          />
          <KPICard
            title="Total de faltas"
            value={formatQuantity(totals.falta)}
            subtitle="Produziu a menos — só aparece com quantidade informada"
            tone={totals.falta > 0 ? "warning" : "neutral"}
            icon={TrendingDown}
            isLoading={isLoading}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DataTable<ProductionLeftoverRow>
          data={rows}
          columns={columns}
          keyField="id"
          isLoading={isLoading}
          emptyMessage="Nenhuma sobra ou falta registrada para o período selecionado."
          pagination
          paginationLabel="registros"
          stickyHeader
        />
      </div>
    </PageLayout>
  );
}
