"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";

import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDateBr,
  hierarchyLabels,
  type ProductionWeekDay,
  productionWeekDays,
} from "@/lib/production-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import {
  buildSectorNameById,
  getLinePlannedKgPerDayFromData,
  getProductsByLineFromData,
  getSchedulesByLineFromData,
} from "@/lib/production-data-utils";

export default function LinhaProducaoDetailsPage() {
  const params = useParams<{ lineId: string }>();
  const lineId = typeof params.lineId === "string" ? params.lineId : "";
  const { snapshot, isLoading, error } = useMasterDataSnapshot();
  const line = snapshot.lines.find((item) => item.id === lineId) ?? null;
  const sectorNameById = useMemo(() => buildSectorNameById(snapshot.sectors), [snapshot.sectors]);

  const products = useMemo(
    () => (line ? getProductsByLineFromData(line.id, snapshot.products) : []),
    [line, snapshot.products],
  );
  const schedules = useMemo(
    () => (line ? getSchedulesByLineFromData(line.id, snapshot.schedules) : []),
    [line, snapshot.schedules],
  );
  const plannedKgByDay = useMemo<Partial<Record<ProductionWeekDay, number>>>(
    () => (line ? getLinePlannedKgPerDayFromData(line.id, snapshot.products) : {}),
    [line, snapshot.products],
  );

  if (!isLoading && !line) {
    return (
      <PageLayout
        title="Subcategoria não encontrada"
        description="A subcategoria solicitada não existe ou foi removida."
        badge="Dados Mestres"
        breadcrumbs={[
          { label: "Gestor de Dados", href: "/gestor-dados" },
          { label: "Subcategorias", href: "/gestor-dados/linhas-producao" },
          { label: "Detalhes" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-dados/linhas-producao">
              <ArrowLeft className="size-4" />
              Voltar para subcategorias
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Verifique se o código da subcategoria está correto e tente novamente.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={line ? `${line.code} · ${line.name}` : "Carregando subcategoria"}
      description="A linha executora é derivada dos produtos vinculados. O cronograma agora é definido no cadastro de produto."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Subcategorias", href: "/gestor-dados/linhas-producao" },
        { label: line?.name ?? "Detalhes" },
      ]}
      actions={
        <Button asChild type="button" variant="outline">
          <Link href="/gestor-dados/linhas-producao">
            <ArrowLeft className="size-4" />
            Voltar para subcategorias
          </Link>
        </Button>
      }
    >
      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-danger-foreground">{error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{hierarchyLabels.sector}</p>
            <p className="mt-1 text-sm font-medium">{line ? sectorNameById.get(line.sectorId) ?? "-" : "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Horário</p>
            <p className="mt-1 text-sm font-medium">{line?.operatingHours ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Capacidade / dia</p>
            <p className="mt-1 text-sm font-medium">{line?.capacityPerDayKg ?? 0} Kg</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={line?.status ?? "inativo"} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos que Definem a Linha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[980px] border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Produção mínima</th>
                  {productionWeekDays.map((day) => (
                    <th key={day.key} className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">
                      {day.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{product.code}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{product.name}</td>
                    <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">
                      {product.minimumProductionKg} Kg
                    </td>
                    {productionWeekDays.map((day) => (
                      <td key={`${product.id}-${day.key}`} className="border-t border-border/70 bg-card px-3 py-3 text-center text-sm">
                        {product.productionDays.includes(day.key) ? "●" : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo Derivado por Dia</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          {productionWeekDays.map((day) => (
            <article key={day.key} className="rounded-xl border border-border/70 bg-panel/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{day.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {(plannedKgByDay[day.key] ?? 0).toFixed(1)} Kg
              </p>
              <p className="text-sm text-muted-foreground">
                {products.filter((product) => product.productionDays.includes(day.key)).length} produtos vinculados
              </p>
            </article>
          ))}
        </CardContent>
      </Card>

      {schedules[0] ? (
        <Card>
          <CardHeader>
            <CardTitle>Linha Executora Ativa</CardTitle>
          </CardHeader>
          <CardContent className="rounded-xl border border-border/70 bg-panel/20 p-4 text-sm text-muted-foreground">
            {schedules[0].name} criada por <strong>{schedules[0].createdBy}</strong> em{" "}
            <strong>{formatDateBr(schedules[0].createdAt)}</strong>. A revisão dos dias não acontece mais aqui; ajuste os dias diretamente nos produtos vinculados.
          </CardContent>
        </Card>
      ) : null}
    </PageLayout>
  );
}
