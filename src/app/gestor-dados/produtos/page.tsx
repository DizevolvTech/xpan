"use client";

import { useMemo, useState } from "react";
import { Box, Clock3, Plus } from "lucide-react";

import { ProductFormDialog, type ProductDialogMode } from "@/components/production/product-form-dialog";
import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { PageLayout } from "@/components/shared/page-layout";
import { SearchFilter } from "@/components/shared/search-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  hierarchyLabels,
  type ProductionProduct,
} from "@/lib/production-planning";
import { getProductOperationalStatusLabel } from "@/lib/production-data-utils";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

type ProductRow = ProductionProduct & {
  lineName: string;
  operationalLineName: string;
  operationalStatusLabel: string;
  sectorName: string;
  validityLabel: string;
  productionDaysLabel: string;
};

export default function ProdutosPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [dialogMode, setDialogMode] = useState<ProductDialogMode>("edit");

  const sectorNameById = useMemo(
    () => new Map(snapshot.sectors.map((sector) => [sector.id, sector.name])),
    [snapshot.sectors],
  );

  const productRows = useMemo(
    () =>
      snapshot.products.map((product) => {
        const line = snapshot.lines.find((item) => item.id === product.lineId);
        const operationalLine = snapshot.lines.find((item) => item.id === product.operationalLineId);

        return {
          ...product,
          lineName: line?.name ?? "-",
          operationalLineName:
            operationalLine?.name ??
            (product.operationalLineId ? "-" : "Fora da carteira operacional"),
          operationalStatusLabel: getProductOperationalStatusLabel(product),
          sectorName: line ? sectorNameById.get(line.sectorId) ?? "-" : "-",
          validityLabel: `${product.validityDays} dias`,
          productionDaysLabel: product.productionDays.map((day) => day.slice(0, 3)).join(" · "),
        };
      }),
    [sectorNameById, snapshot.lines, snapshot.products],
  );

  const filteredProducts = useMemo(
    () =>
      productRows.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.shortName ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.externalCode ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.operationalStatusLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.lineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.operationalLineName.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [productRows, searchTerm],
  );

  const activeProductsCount = productRows.filter((item) => item.active).length;
  const operationalPortfolioCount = productRows.filter(
    (item) => item.active && Boolean(item.operationalLineId),
  ).length;
  const outsideOperationalPortfolioCount = Math.max(
    0,
    activeProductsCount - operationalPortfolioCount,
  );

  const columns = [
    { key: "code", header: "Código da fábrica" },
    {
      key: "externalCode",
      header: "Código da loja",
      render: (item: ProductRow) => item.externalCode || "-",
    },
    { key: "name", header: "Nome completo" },
    {
      key: "shortName",
      header: "Nome reduzido",
      render: (item: ProductRow) => item.shortName || "-",
    },
    { key: "lineName", header: `${hierarchyLabels.line} Cadastral` },
    {
      key: "operationalStatusLabel",
      header: "Status",
      render: (item: ProductRow) => (
        <span
          className={
            item.operationalLineId
              ? "text-sm font-medium text-primary"
              : "text-sm text-muted-foreground"
          }
        >
          {item.operationalStatusLabel}
        </span>
      ),
    },
    { key: "sectorName", header: hierarchyLabels.sector },
    {
      key: "active",
      header: "Ativo?",
      render: (item: ProductRow) =>
        item.active ? <StatusBadge status="ativo" /> : <StatusBadge status="inativo" />,
    },
    {
      key: "unitProfiles",
      header: "Venda / Produção / Expedição",
      render: (item: ProductRow) =>
        `${item.unitProfiles.sales.unit} / ${item.unitProfiles.production.unit} / ${item.unitProfiles.expedition.unit}`,
    },
    { key: "productionDaysLabel", header: "Cronograma" },
  ];

  function openProductDialog(product: ProductRow | null, mode: ProductDialogMode) {
    setSelectedProduct(product);
    setDialogMode(mode);
    setIsDialogOpen(true);
  }

  async function handleCloneProduct(item: ProductRow) {
    if (!window.confirm(`Deseja clonar o produto "${item.name}"? Uma cópia inativa será criada.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/master-data/products/${item.id}/clone`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;

      if (!response.ok) {
        window.alert(payload?.message ?? "Falha ao clonar produto.");
        return;
      }

      await refresh(true);
      window.alert(`Produto clonado com sucesso! Código: ${payload?.code}`);
    } catch {
      window.alert("Erro inesperado ao clonar produto.");
    }
  }

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: ProductRow) => openProductDialog(item, "view"),
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: ProductRow) => openProductDialog(item, "edit"),
    },
    {
      icon: "add" as const,
      label: "Clonar",
      onClick: (item: ProductRow) => void handleCloneProduct(item),
    },
  ];

  return (
    <PageLayout
      title="Gestão de Produtos"
      description="Modele a engenharia em kg, o cronograma por produto e o espelho MPI no mesmo cadastro."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Produtos" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard
          title="Registros Ativos"
          value={`${activeProductsCount} produtos`}
          icon={Box}
          tone="success"
        />
        <KPICard
          title="Carteira Operacional"
          value={isLoading ? "Carregando..." : `${operationalPortfolioCount} produtos`}
          icon={Clock3}
          tone="neutral"
          subtitle={
            isLoading
              ? undefined
              : `${outsideOperationalPortfolioCount} ativos fora da carteira operacional`
          }
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Produtos</CardTitle>
          <Button type="button" onClick={() => openProductDialog(null, "edit")}>
            <Plus className="size-4" />
            Novo Produto
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código da fábrica, código da loja, nome completo, nome reduzido ou status..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            showFilters={false}
          />
          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/20 px-3 py-2 text-sm text-danger-foreground">
              {error}
            </div>
          ) : null}
          <DataTable
            data={filteredProducts}
            columns={columns}
            actions={actions}
            keyField="id"
            onRowClick={(item) => openProductDialog(item, "view")}
            emptyMessage={isLoading ? "Carregando produtos..." : "Nenhum produto encontrado"}
            stickyHeader
          />
        </CardContent>
      </Card>

      <ProductFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={selectedProduct}
        mode={dialogMode}
        snapshot={snapshot}
        refresh={refresh}
        onRequestEdit={() => setDialogMode("edit")}
      />
    </PageLayout>
  );
}
