"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Box, Clock3, Plus } from "lucide-react";

import { ProductFormDialog, type ProductDialogMode } from "@/components/production/product-form-dialog";
import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { PageLayout } from "@/components/shared/page-layout";
import { SearchFilter } from "@/components/shared/search-filter";
import { StatusBadge } from "@/components/shared/status-badge";
import { useToast } from "@/components/shared/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
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
  hasApprovedLp: boolean;
};

export default function ProdutosPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [dialogMode, setDialogMode] = useState<ProductDialogMode>("edit");

  const sectorNameById = useMemo(
    () => new Map(snapshot.sectors.map((sector) => [sector.id, sector.name])),
    [snapshot.sectors],
  );

  // Lines that have at least one active schedule
  const linesWithActiveSchedule = useMemo(
    () => new Set(
      snapshot.schedules
        .filter((s) => s.status === "ativo")
        .map((s) => s.lineId),
    ),
    [snapshot.schedules],
  );

  const productRows = useMemo(
    () =>
      snapshot.products.map((product) => {
        const line = snapshot.lines.find((item) => item.id === product.lineId);
        const operationalLine = snapshot.lines.find((item) => item.id === product.operationalLineId);
        const hasApprovedLp = product.operationalLineId
          ? linesWithActiveSchedule.has(product.operationalLineId)
          : false;

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
          hasApprovedLp,
        };
      }),
    [linesWithActiveSchedule, sectorNameById, snapshot.lines, snapshot.products],
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
  const withoutApprovedLpCount = productRows.filter(
    (item) => item.active && item.operationalLineId && !item.hasApprovedLp,
  ).length;

  const columns = [
    {
      key: "code",
      header: "Códigos",
      render: (item: ProductRow) => (
        <div className="space-y-0.5">
          <span className="block text-sm font-medium tabular-nums text-foreground">{item.code}</span>
          {item.externalCode ? (
            <span className="block text-[11px] tabular-nums text-muted-foreground/80">
              loja {item.externalCode}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "name",
      header: "Produto",
      render: (item: ProductRow) => (
        <div className="space-y-0.5">
          <span className="block text-sm font-semibold text-foreground">{item.name}</span>
          {item.shortName ? (
            <span className="block text-[11px] text-muted-foreground/80">{item.shortName}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "lineName",
      header: `${hierarchyLabels.line} Cadastral`,
      render: (item: ProductRow) => (
        <div className="space-y-0.5">
          <span className="block text-sm text-foreground">{item.lineName}</span>
          <span className="block text-[11px] text-muted-foreground/80">{item.sectorName}</span>
        </div>
      ),
    },
    {
      key: "operationalStatusLabel",
      header: "Status",
      render: (item: ProductRow) => (
        <div className="space-y-0.5">
          <span
            className={
              item.operationalLineId
                ? "text-sm font-medium text-primary"
                : "text-sm text-muted-foreground"
            }
          >
            {item.operationalStatusLabel}
          </span>
          {item.active && item.operationalLineId && !item.hasApprovedLp && (
            <span className="block text-[11px] font-medium text-danger-foreground">Sem LP aprovada</span>
          )}
        </div>
      ),
    },
    {
      key: "active",
      header: "Ativo?",
      render: (item: ProductRow) =>
        item.active ? <StatusBadge status="ativo" /> : <StatusBadge status="inativo" />,
    },
    {
      key: "unitProfiles",
      header: "Venda / Produção / Expedição",
      render: (item: ProductRow) => (
        <span className="text-sm tabular-nums text-foreground">
          {item.unitProfiles.sales.unit} / {item.unitProfiles.production.unit} / {item.unitProfiles.expedition.unit}
        </span>
      ),
    },
    {
      key: "productionDaysLabel",
      header: "Cronograma",
      render: (item: ProductRow) => (
        <span className="text-[11px] tabular-nums text-muted-foreground/80">
          {item.productionDaysLabel}
        </span>
      ),
    },
  ];

  function openProductDialog(product: ProductRow | null, mode: ProductDialogMode) {
    setSelectedProduct(product);
    setDialogMode(mode);
    setIsDialogOpen(true);
  }

  async function handleCloneProduct(item: ProductRow) {
    if (
      !(await confirm({
        title: `Clonar o produto "${item.name}"?`,
        description: "Uma cópia inativa será criada.",
        tone: "default",
        confirmLabel: "Clonar",
        cancelLabel: "Cancelar",
      }))
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/master-data/products/${item.id}/clone`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;

      if (!response.ok) {
        toast.error(payload?.message ?? "Falha ao clonar produto.");
        return;
      }

      await refresh(true);
      toast.success(`Produto clonado com sucesso! Código: ${payload?.code}`);
    } catch {
      toast.error("Erro inesperado ao clonar produto.");
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
      description="Engenharia em kg, cronograma e espelho MPI no mesmo cadastro."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Produtos" },
      ]}
      actions={
        <Button type="button" onClick={() => openProductDialog(null, "edit")}>
          <Plus className="size-4" />
          Novo Produto
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
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
        <KPICard
          title="Sem LP Aprovada"
          value={isLoading ? "Carregando..." : `${withoutApprovedLpCount} produtos`}
          icon={AlertTriangle}
          tone={withoutApprovedLpCount > 0 ? "danger" : "success"}
          subtitle={
            withoutApprovedLpCount > 0
              ? "Na carteira operacional mas a LP não tem cronograma ativo"
              : "Todos os produtos operacionais têm LP aprovada"
          }
        />
      </div>

      <section className="space-y-3">
        <SearchFilter
          searchPlaceholder="Buscar por código, nome ou status..."
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
      </section>

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
