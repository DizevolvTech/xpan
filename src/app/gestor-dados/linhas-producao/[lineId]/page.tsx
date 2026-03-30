"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { PageLayout } from "@/components/shared/page-layout";
import { PaginatedSection } from "@/components/shared/paginated-section";
import { SearchFilter } from "@/components/shared/search-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDateBr,
  hierarchyLabels,
  productionWeekDays,
  type ProductionProduct,
  type ProductionWeekDay,
  type WeeklyProductionSchedule,
} from "@/lib/production-planning";
import { useMasterDataSnapshot } from "@/lib/use-master-data";
import {
  buildSectorNameById,
  getLinePlannedKgPerDayFromData,
  getProductsByLineFromData,
  getProductsByMasterLineFromData,
  getSchedulesByLineFromData,
} from "@/lib/production-data-utils";

type ProductScopeFilter = "all" | "outside-portfolio" | "current";

type ProductRow = ProductionProduct & {
  masterLineName: string;
  operationalLineName: string;
};

type ScheduleRow = WeeklyProductionSchedule & {
  itemsCount: number;
  minimumTotal: number;
};

function formatKg(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatProductionDays(days: ProductionWeekDay[]) {
  if (days.length === 0) {
    return "Sem dias programados";
  }

  return productionWeekDays
    .filter((day) => days.includes(day.key))
    .map((day) => day.shortLabel)
    .join(" · ");
}

export default function LinhaProducaoDetailsPage() {
  const params = useParams<{ lineId: string }>();
  const lineId = typeof params.lineId === "string" ? params.lineId : "";
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ProductScopeFilter>("all");
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSubmittingProductId, setIsSubmittingProductId] = useState<string | null>(null);
  const line = snapshot.lines.find((item) => item.id === lineId) ?? null;
  const sectorNameById = useMemo(() => buildSectorNameById(snapshot.sectors), [snapshot.sectors]);
  const lineNameById = useMemo(
    () => new Map(snapshot.lines.map((item) => [item.id, item.name])),
    [snapshot.lines],
  );

  const productRows = useMemo<ProductRow[]>(
    () =>
      snapshot.products.map((product) => ({
        ...product,
        masterLineName: lineNameById.get(product.masterLineId ?? product.lineId) ?? "-",
        operationalLineName: product.operationalLineId ? lineNameById.get(product.operationalLineId) ?? "-" : "-",
      })),
    [lineNameById, snapshot.products],
  );

  const operationalProducts = useMemo(
    () => (line ? getProductsByLineFromData(line.id, productRows).filter((product) => product.active) : []),
    [line, productRows],
  );
  const operationalProductsSorted = useMemo(
    () =>
      [...operationalProducts].sort((left, right) =>
        `${left.code} ${left.name}`.localeCompare(`${right.code} ${right.name}`, "pt-BR"),
      ),
    [operationalProducts],
  );
  const masterProducts = useMemo(
    () => (line ? getProductsByMasterLineFromData(line.id, productRows) : []),
    [line, productRows],
  );
  const masterActiveProducts = useMemo(
    () => masterProducts.filter((product) => product.active),
    [masterProducts],
  );
  const schedules = useMemo<ScheduleRow[]>(
    () =>
      (line ? getSchedulesByLineFromData(line.id, snapshot.schedules) : [])
        .map((schedule) => ({
          ...schedule,
          itemsCount: schedule.items.length,
          minimumTotal: Number(
            schedule.items
              .reduce((total, item) => total + Number(item.minimumProduction), 0)
              .toFixed(2),
          ),
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [line, snapshot.schedules],
  );
  const plannedKgByDay = useMemo<Partial<Record<ProductionWeekDay, number>>>(
    () => (line ? getLinePlannedKgPerDayFromData(line.id, productRows) : {}),
    [line, productRows],
  );

  const filteredActiveProducts = useMemo(
    () =>
      masterActiveProducts
        .filter((product) => {
          const normalizedSearch = searchTerm.trim().toLowerCase();
          const matchesSearch =
            normalizedSearch.length === 0 ||
            product.code.toLowerCase().includes(normalizedSearch) ||
            product.name.toLowerCase().includes(normalizedSearch) ||
            product.masterLineName.toLowerCase().includes(normalizedSearch) ||
            product.operationalLineName.toLowerCase().includes(normalizedSearch);

          if (!matchesSearch) {
            return false;
          }

          switch (scopeFilter) {
            case "outside-portfolio":
              return !product.operationalLineId;
            case "current":
              return product.operationalLineId === lineId;
            default:
              return true;
          }
        }),
    [lineId, masterActiveProducts, scopeFilter, searchTerm],
  );

  const activeSchedule = schedules.find((schedule) => schedule.status === "ativo") ?? null;
  const pendingSchedule = schedules.find((schedule) => schedule.status === "pendente") ?? null;

  if (!isLoading && !line) {
    return (
      <PageLayout
        title="Linha de produção não encontrada"
        description="A linha de produção solicitada não existe ou foi removida."
        badge="Dados Mestres"
        breadcrumbs={[
          { label: "Gestor de Dados", href: "/gestor-dados" },
          { label: "Linhas de produção", href: "/gestor-dados/linhas-producao" },
          { label: "Detalhes" },
        ]}
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/gestor-dados/linhas-producao">
              <ArrowLeft className="size-4" />
              Voltar para linhas de produção
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Verifique se o código da linha de produção está correto e tente novamente.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const handleAssignProduct = async (productId: string) => {
    if (!line) {
      return;
    }

    setIsSubmittingProductId(productId);
    setPageError(null);

    try {
      const response = await fetch(`/api/master-data/subcategories/${line.id}/operational-products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao adicionar produto ao cronograma ativo");
      }

      await refresh();
    } catch (mutationError) {
      setPageError(
        mutationError instanceof Error
          ? mutationError.message
          : "Falha ao adicionar produto ao cronograma ativo",
      );
    } finally {
      setIsSubmittingProductId(null);
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    if (!line) {
      return;
    }

    setIsSubmittingProductId(productId);
    setPageError(null);

    try {
      const response = await fetch(
        `/api/master-data/subcategories/${line.id}/operational-products/${productId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Falha ao remover produto do cronograma ativo");
      }

      await refresh();
    } catch (mutationError) {
      setPageError(
        mutationError instanceof Error
          ? mutationError.message
          : "Falha ao remover produto do cronograma ativo",
      );
    } finally {
      setIsSubmittingProductId(null);
    }
  };

  return (
    <PageLayout
      title={line ? `${line.code} · ${line.name}` : "Carregando linha de produção"}
      description="Gerencie o cronograma ativo desta linha de produção. O vínculo cadastral do produto continua no cadastro do produto, mas cronograma e auditoria passam a olhar para a carteira abaixo."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Linhas de produção", href: "/gestor-dados/linhas-producao" },
        { label: line?.name ?? "Detalhes" },
      ]}
      actions={
        <Button asChild type="button" variant="outline">
          <Link href="/gestor-dados/linhas-producao">
            <ArrowLeft className="size-4" />
            Voltar para linhas de produção
          </Link>
        </Button>
      }
    >
      {error || pageError ? (
        <Card>
          <CardContent className="py-4 text-sm text-danger-foreground">{pageError ?? error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
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
            <p className="mt-1 text-sm font-medium">{formatKg(line?.capacityPerDayKg ?? 0)} Kg</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Cadastro base</p>
            <p className="mt-1 text-sm font-medium">{masterProducts.length} produtos</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Cronograma ativo</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm font-medium">{operationalProducts.length} produtos ativos</p>
              <StatusBadge status={line?.status ?? "inativo"} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Última atualização</p>
            <p className="mt-1 text-sm font-medium">
              {line?.updatedAt
                ? formatDateBr(line.updatedAt)
                : line?.createdAt
                  ? formatDateBr(line.createdAt)
                  : "-"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              O cadastro da linha é atualizado no mesmo registro, sem gerar versão duplicada.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="operational">
        <TabsList variant="line">
          <TabsTrigger value="operational">Cronograma ativo</TabsTrigger>
          <TabsTrigger value="audit">Auditoria / Histórico</TabsTrigger>
          <TabsTrigger value="summary">Resumo operacional</TabsTrigger>
        </TabsList>

        <TabsContent value="operational" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Linha de produção cadastral
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Produtos podem continuar cadastrados nesta linha de produção mesmo sem participar do cronograma ativo.
                </p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Status
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Só os produtos desta linha de produção podem entrar no cronograma ativo e no histórico de auditoria.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Produtos atualmente no cronograma ativo</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={operationalProducts}
                columns={[
                  { key: "code", header: "Código" },
                  { key: "name", header: "Produto" },
                  { key: "masterLineName", header: "Linha cadastral" },
                  {
                    key: "productionDays",
                    header: "Cronograma do Produto",
                    render: (product: ProductRow) => formatProductionDays(product.productionDays),
                  },
                  {
                    key: "minimumProductionKg",
                    header: "Base (Kg)",
                    render: (product: ProductRow) => formatKg(product.minimumProductionKg),
                  },
                ]}
                actions={[
                  {
                    icon: "delete",
                    label: "Remover do cronograma ativo",
                    onClick: (product: ProductRow) => void handleRemoveProduct(product.id),
                    variant: "destructive",
                  },
                ]}
                keyField="id"
                paginationLabel="produtos operacionais"
                emptyMessage={
                  isLoading
                    ? "Carregando cronograma ativo..."
                    : "Nenhum produto ativo está alocado no cronograma ativo desta linha."
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Produtos ativos desta linha de produção</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SearchFilter
                searchPlaceholder="Buscar por código, produto, linha ou status..."
                onSearch={setSearchTerm}
                searchValue={searchTerm}
                filters={[
                  {
                    key: "scope",
                    label: "Escopo",
                    value: scopeFilter,
                    onChange: (value) => setScopeFilter(value as ProductScopeFilter),
                    options: [
                      { value: "outside-portfolio", label: "Fora do cronograma ativo" },
                      { value: "current", label: "Já nesta linha" },
                    ],
                  },
                ]}
              />

              <DataTable
                data={filteredActiveProducts}
                columns={[
                  { key: "code", header: "Código" },
                  { key: "name", header: "Produto" },
                  { key: "masterLineName", header: "Linha cadastral" },
                  {
                    key: "operationalLineName",
                    header: "Status",
                    render: (product: ProductRow) =>
                      product.operationalLineId === lineId ? (
                        <span className="text-sm font-medium text-primary">No cronograma ativo</span>
                      ) : (
                        product.operationalLineName
                      ),
                  },
                  {
                    key: "minimumProductionKg",
                    header: "Base (Kg)",
                    render: (product: ProductRow) => formatKg(product.minimumProductionKg),
                  },
                  {
                    key: "operation",
                    header: "Ação",
                    render: (product: ProductRow) => {
                      if (product.operationalLineId === lineId) {
                        return <span className="text-sm text-muted-foreground">Já alocado aqui</span>;
                      }

                      if (product.operationalLineId && product.operationalLineId !== lineId) {
                        return (
                          <span className="text-sm text-muted-foreground">
                            Realoque no cadastro do produto
                          </span>
                        );
                      }

                      const isBusy = isSubmittingProductId === product.id;

                      return (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={isBusy}
                          onClick={() => void handleAssignProduct(product.id)}
                        >
                          <Plus className="size-4" />
                          Adicionar
                        </Button>
                      );
                    },
                  },
                ]}
                keyField="id"
                paginationLabel="produtos ativos"
                emptyMessage={
                  isLoading
                    ? "Carregando produtos..."
                    : "Nenhum produto ativo desta linha de produção foi encontrado para este filtro."
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="rounded-xl border border-info/35 bg-info/10 px-4 py-3 text-sm text-info-foreground">
            A linha de produção permanece em registro único. Quando o cadastro é editado, o sistema
            atualiza a mesma linha; o histórico auditável fica nas revisões do cronograma ativo
            desta linha.
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Auditoria pendente</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {pendingSchedule ? (
                  <div className="space-y-2">
                    <p className="text-foreground">
                      <strong>{pendingSchedule.code}</strong> criada em{" "}
                      <strong>{formatDateBr(pendingSchedule.createdAt)}</strong>.
                    </p>
                    <p>
                      {pendingSchedule.itemsCount} produtos no snapshot, com base total de{" "}
                      {formatKg(pendingSchedule.minimumTotal)} Kg.
                    </p>
                  </div>
                ) : (
                  <p>Nenhuma auditoria pendente no momento.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Auditoria ativa</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {activeSchedule ? (
                  <div className="space-y-2">
                    <p className="text-foreground">
                      <strong>{activeSchedule.code}</strong> auditada em{" "}
                      <strong>{activeSchedule.auditedAt ? formatDateBr(activeSchedule.auditedAt) : "-"}</strong>.
                    </p>
                    <p>
                      {activeSchedule.itemsCount} produtos aprovados, com base total de{" "}
                      {formatKg(activeSchedule.minimumTotal)} Kg.
                    </p>
                  </div>
                ) : (
                  <p>Nenhuma auditoria ativa cadastrada.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Histórico operacional auditável</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={schedules}
                columns={[
                  { key: "code", header: "Código" },
                  { key: "name", header: "Linha" },
                  {
                    key: "status",
                    header: "Status",
                    render: (schedule: ScheduleRow) => <StatusBadge status={schedule.status} />,
                  },
                  {
                    key: "createdAt",
                    header: "Criada em",
                    render: (schedule: ScheduleRow) => formatDateBr(schedule.createdAt),
                  },
                  {
                    key: "itemsCount",
                    header: "Produtos",
                    render: (schedule: ScheduleRow) => String(schedule.itemsCount),
                  },
                  {
                    key: "minimumTotal",
                    header: "Base (Kg)",
                    render: (schedule: ScheduleRow) => formatKg(schedule.minimumTotal),
                  },
                  {
                    key: "auditNotes",
                    header: "Observações",
                    render: (schedule: ScheduleRow) => schedule.auditNotes ?? "-",
                  },
                ]}
                keyField="id"
                paginationLabel="revisões"
                emptyMessage={
                  isLoading
                    ? "Carregando histórico operacional..."
                    : "Nenhum histórico operacional encontrado para esta linha."
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grade semanal do cronograma ativo</CardTitle>
            </CardHeader>
            <CardContent>
              {operationalProductsSorted.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-panel/20 px-4 py-6 text-sm text-muted-foreground">
                  Nenhum produto ativo foi adicionado a este cronograma ativo ainda.
                </div>
              ) : (
                <PaginatedSection
                  items={operationalProductsSorted}
                  label="produtos no cronograma"
                  initialPageSize={12}
                  pageSizeOptions={[12, 24, 48]}
                >
                  {(items) => (
                    <div className="overflow-x-auto overscroll-x-contain">
                      <table className="w-full min-w-[920px] border-collapse rounded-xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
                        <thead className="bg-panel">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/95">
                              Produto
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground/95">
                              Cadastral
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground/95">
                              Base (Kg)
                            </th>
                            {productionWeekDays.map((day) => (
                              <th
                                key={day.key}
                                className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground/95"
                              >
                                {day.shortLabel}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((product) => (
                            <tr key={product.id} className="transition-colors duration-200 hover:bg-panel/35">
                              <td className="border-t border-border/70 bg-card px-4 py-3 align-top">
                                <div className="font-medium text-foreground">{product.name}</div>
                                <div className="text-xs text-muted-foreground">{product.code}</div>
                              </td>
                              <td className="border-t border-border/70 bg-card px-4 py-3 align-top text-sm text-muted-foreground">
                                {product.masterLineName}
                              </td>
                              <td className="border-t border-border/70 bg-card px-4 py-3 text-right align-top text-sm text-foreground">
                                {formatKg(product.minimumProductionKg)}
                              </td>
                              {productionWeekDays.map((day) => {
                                const isProducedOnDay = product.productionDays.includes(day.key);
                                return (
                                  <td
                                    key={`${product.id}-${day.key}`}
                                    className="border-t border-border/70 bg-card px-3 py-3 text-center align-middle"
                                  >
                                    <span
                                      className={[
                                        "inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold",
                                        isProducedOnDay
                                          ? "bg-primary/15 text-primary"
                                          : "bg-panel/70 text-muted-foreground",
                                      ].join(" ")}
                                    >
                                      {isProducedOnDay ? "X" : "-"}
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
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo operacional derivado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              {productionWeekDays.map((day) => (
                <article key={day.key} className="rounded-xl border border-border/70 bg-panel/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {day.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatKg(plannedKgByDay[day.key] ?? 0)} Kg
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {
                      operationalProducts.filter((product) =>
                        product.productionDays.includes(day.key),
                      ).length
                    }{" "}
                    produtos ativos
                  </p>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leitura operacional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                O cronograma acima lê apenas o <strong>cronograma ativo</strong> desta linha de produção.
              </p>
              <p>
                A ficha cadastral do produto continua preservada no cadastro mestre, para manter histórico e margem de
                armazenamento de produtos fora do fluxo atual.
              </p>
              <p>
                Toda alteração na carteira recria a auditoria pendente desta linha de produção e suspende sua
                liberação para produção e pedidos até nova aprovação.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
