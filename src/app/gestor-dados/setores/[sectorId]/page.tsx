"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Factory, Users } from "lucide-react";

import { PageLayout } from "@/components/shared/page-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import { getLinesBySectorFromData } from "@/lib/production-data-utils";

export default function SetorDetailsPage() {
  const params = useParams<{ sectorId: string }>();
  const sectorId = typeof params.sectorId === "string" ? params.sectorId : "";
  const { snapshot, isLoading, error } = useMasterDataSnapshot();
  const sector = snapshot.sectors.find((item) => item.id === sectorId) ?? null;

  if (!isLoading && !sector) {
    return (
      <PageLayout
        title="Categoria não encontrada"
        description="A categoria solicitada não existe ou foi removida."
        badge="Dados Mestres"
        breadcrumbs={[
          { label: "Gestor de Dados", href: "/gestor-dados" },
          { label: "Categorias", href: "/gestor-dados/setores" },
          { label: "Detalhes" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-dados/setores">
              <ArrowLeft className="size-4" />
              Voltar para categorias
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Verifique se o código da categoria está correto e tente novamente.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const lines = sector ? getLinesBySectorFromData(sector.id, snapshot.lines) : [];
  const activeLines = lines.filter((line) => line.status === "ativo").length;

  return (
    <PageLayout
      title={sector ? `${sector.code} · ${sector.name}` : "Carregando categoria"}
      description="Visualize os detalhes da categoria e as subcategorias vinculadas."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Categorias", href: "/gestor-dados/setores" },
        { label: sector?.name ?? "Detalhes" },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-dados/setores">
              <ArrowLeft className="size-4" />
              Voltar para categorias
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-dados/linhas-producao">
              <Factory className="size-4" />
              Ver todas as subcategorias
            </Link>
          </Button>
        </div>
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
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Código</p>
            <p className="mt-1 text-sm font-semibold">{sector?.code ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Responsável</p>
            <p className="mt-1 text-sm font-semibold">{sector?.responsible ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Subcategorias vinculadas</p>
            <p className="mt-1 text-sm font-semibold">
              {lines.length} ({activeLines} ativas)
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={sector?.status ?? "inativo"} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Subcategorias Vinculadas</CardTitle>
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-dados/linhas-producao">
              <Users className="size-4" />
              Ir para módulo de subcategorias
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[920px] border-collapse">
              <thead className="bg-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Subcategoria</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Horário</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Capacidade/dia</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="border-t border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground"
                    >
                      Esta categoria ainda não possui subcategorias vinculadas.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr key={line.id}>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{line.code}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{line.name}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{line.type}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{line.operatingHours}</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-sm">{line.capacityPerDayKg} Kg</td>
                      <td className="border-t border-border/70 bg-card px-4 py-3">
                        <StatusBadge status={line.status} />
                      </td>
                      <td className="border-t border-border/70 bg-card px-4 py-3 text-right">
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href={`/gestor-dados/linhas-producao/${line.id}`}>Abrir subcategoria</Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
