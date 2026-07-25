"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, RefreshCw } from "lucide-react";

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
import { formatKgLabel } from "@/lib/utils";
import { getTodayDateKey } from "@/lib/order-planning";

interface IngredientConsumptionRow {
  ingredientId: string;
  ingredientName: string;
  totalKg: number;
  consumptionUnit: string;
}

interface IngredientConsumptionResponse {
  referenceDate: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  ingredients: IngredientConsumptionRow[];
  totalConsumptionKg: number;
}

const WINDOW_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
];

function todayIsoDate() {
  return getTodayDateKey();
}

function formatDateBr(isoDate: string) {
  if (!isoDate) {
    return "-";
  }
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export default function ConsumoIngredientesPage() {
  const [windowDays, setWindowDays] = useState("7");
  const [referenceDate] = useState(todayIsoDate);
  const [data, setData] = useState<IngredientConsumptionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConsumption = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ referenceDate, windowDays });
      const response = await fetch(
        `/api/factory-planning/ingredient-consumption?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Não foi possível carregar o consumo de ingredientes.");
      }
      const payload = (await response.json()) as IngredientConsumptionResponse;
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar consumo de ingredientes.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [referenceDate, windowDays]);

  useEffect(() => {
    void loadConsumption();
  }, [loadConsumption]);

  const rows = data?.ingredients ?? [];

  const columns = useMemo(
    () => [
      {
        key: "ingredientName",
        header: "Ingrediente",
        sortable: true,
        sortValue: (item: IngredientConsumptionRow) => item.ingredientName,
        render: (item: IngredientConsumptionRow) => (
          <span className="font-medium text-foreground">{item.ingredientName}</span>
        ),
      },
      {
        key: "totalKg",
        header: "Consumo acumulado",
        sortable: true,
        sortValue: (item: IngredientConsumptionRow) => item.totalKg,
        render: (item: IngredientConsumptionRow) => (
          <span className="tabular-nums">{formatKgLabel(item.totalKg)}</span>
        ),
      },
      {
        key: "consumptionUnit",
        header: "Unidade",
        sortable: true,
        sortValue: (item: IngredientConsumptionRow) => item.consumptionUnit,
        render: (item: IngredientConsumptionRow) => (
          <span className="text-muted-foreground">{item.consumptionUnit}</span>
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
      title="Consumo de Ingredientes"
      description="Consumo acumulado de ingredientes derivado da produção planejada no período selecionado."
      badge="Operacional"
      breadcrumbs={[
        { label: "Início", href: "/" },
        { label: "Gestor de Fábrica", href: "/gestor-fabrica" },
        { label: "Consumo de Ingredientes" },
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
              onClick={() => void loadConsumption()}
              disabled={isLoading}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <KPICard
            title="Ingredientes consumidos"
            value={String(rows.length)}
            icon={Package}
            isLoading={isLoading}
          />
          <KPICard
            title="Consumo total (kg)"
            value={formatKgLabel(data?.totalConsumptionKg ?? 0)}
            icon={Package}
            isLoading={isLoading}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DataTable<IngredientConsumptionRow>
          data={rows}
          columns={columns}
          keyField="ingredientId"
          isLoading={isLoading}
          emptyMessage="Nenhum consumo de ingrediente para o período selecionado."
          pagination
          paginationLabel="ingredientes"
          stickyHeader
        />
      </div>
    </PageLayout>
  );
}
