"use client";

import { useMemo, useState } from "react";
import { Clock3, Package, Plus } from "lucide-react";

import {
  IngredientFormDialog,
  type IngredientDialogMode,
} from "@/components/production/ingredient-form-dialog";
import { ProductFormDialog } from "@/components/production/product-form-dialog";
import { DataTable } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { PageLayout } from "@/components/shared/page-layout";
import { SearchFilter } from "@/components/shared/search-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ProductionIngredient,
  type ProductionProduct,
} from "@/lib/production-planning";
import { getOperationalUnitLabel } from "@/lib/operational-units";
import { useMasterDataSnapshot } from "@/lib/use-master-data";

type IngredientRow = ProductionIngredient;

type IngredientListRow = {
  rowKey: string;
  rowKind: "ingredient" | "mpiProduct";
  code: string;
  externalCode: string;
  name: string;
  shortName: string;
  typeLabel: string;
  unitLabel: string;
  compositionLabel: string;
  ingredient?: ProductionIngredient;
  product?: ProductionProduct;
};

function renderTypeBadge(row: IngredientListRow) {
  const toneClass =
    row.rowKind === "mpiProduct"
      ? "border-info/40 bg-info/10 text-info-foreground"
      : row.ingredient?.type === "misturado"
        ? "border-warning/40 bg-warning/20 text-warning-foreground"
        : "border-border/70 bg-panel/40 text-foreground";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {row.typeLabel}
    </span>
  );
}

export default function IngredientesPage() {
  const { snapshot, isLoading, error, refresh } = useMasterDataSnapshot();
  const [searchTerm, setSearchTerm] = useState("");

  const [isIngredientDialogOpen, setIsIngredientDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientRow | null>(null);
  const [ingredientDialogMode, setIngredientDialogMode] = useState<IngredientDialogMode>("edit");

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductionProduct | null>(null);
  const [productDialogMode, setProductDialogMode] = useState<"view" | "edit">("view");

  const ingredients = snapshot.ingredients;
  const mpiProducts = useMemo(
    () => snapshot.products.filter((product) => product.canBeIngredient),
    [snapshot.products],
  );

  const ingredientRows = useMemo<IngredientListRow[]>(
    () =>
      ingredients.map((ingredient) => ({
        rowKey: `ingredient-${ingredient.id}`,
        rowKind: "ingredient",
        code: ingredient.code,
        externalCode: ingredient.externalCode ?? "",
        name: ingredient.name,
        shortName: ingredient.shortName ?? "",
        typeLabel: ingredient.type === "misturado" ? "Ingrediente misturado" : "Ingrediente puro",
        unitLabel: getOperationalUnitLabel(ingredient.unit),
        compositionLabel:
          ingredient.type === "misturado"
            ? `${ingredient.composition.length} componentes`
            : "N/A",
        ingredient,
      })),
    [ingredients],
  );

  const mpiRows = useMemo<IngredientListRow[]>(
    () =>
      mpiProducts.map((product) => ({
        rowKey: `mpi-product-${product.id}`,
        rowKind: "mpiProduct",
        code: product.code,
        externalCode: product.externalCode ?? "",
        name: product.name,
        shortName: product.shortName ?? "",
        typeLabel: "Produto MPI",
        unitLabel: getOperationalUnitLabel(
          product.ingredientProfile?.unit ?? product.unitProfiles.sales.unit,
        ),
        compositionLabel: `${product.recipe.length} itens da receita`,
        product,
      })),
    [mpiProducts],
  );

  const filteredRows = useMemo(
    () =>
      [...ingredientRows, ...mpiRows].filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.externalCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.typeLabel.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [ingredientRows, mpiRows, searchTerm],
  );

  const columns = [
    { key: "code", header: "Código XPAN" },
    {
      key: "externalCode",
      header: "Código ERP",
      render: (item: IngredientListRow) => item.externalCode || "-",
    },
    { key: "name", header: "Nome completo" },
    {
      key: "shortName",
      header: "Nome reduzido",
      render: (item: IngredientListRow) => item.shortName || "-",
    },
    {
      key: "typeLabel",
      header: "Tipo",
      render: (item: IngredientListRow) => renderTypeBadge(item),
    },
    { key: "unitLabel", header: "Un. Medida" },
    { key: "compositionLabel", header: "Composição" },
  ];

  function openIngredientDialog(ingredient: IngredientRow | null, mode: IngredientDialogMode) {
    setIngredientDialogMode(mode);
    setEditingIngredient(ingredient);
    setIsIngredientDialogOpen(true);
  }

  function openProductDialog(product: ProductionProduct, mode: "view" | "edit") {
    setSelectedProduct(product);
    setProductDialogMode(mode);
    setIsProductDialogOpen(true);
  }

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: IngredientListRow) => {
        if (item.rowKind === "mpiProduct" && item.product) {
          openProductDialog(item.product, "view");
          return;
        }

        if (item.ingredient) {
          openIngredientDialog(item.ingredient, "view");
        }
      },
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: IngredientListRow) => {
        if (item.rowKind === "mpiProduct" && item.product) {
          openProductDialog(item.product, "edit");
          return;
        }

        if (item.ingredient) {
          openIngredientDialog(item.ingredient, "edit");
        }
      },
    },
  ];

  return (
    <PageLayout
      title="Gestão de Ingredientes"
      description="Cadastre ingredientes puros, misturados e acompanhe os produtos MPI reutilizáveis na mesma listagem."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Ingredientes" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard
          title="Ingredientes Cadastrados"
          value={`${ingredients.length} ingredientes`}
          icon={Package}
          tone="success"
        />
        <KPICard
          title="Produtos MPI"
          value={isLoading ? "Carregando..." : `${mpiProducts.length} produtos`}
          icon={Clock3}
          tone="neutral"
          subtitle={isLoading ? undefined : `${filteredRows.length} linhas visíveis na busca atual`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Ingredientes e MPI</CardTitle>
          <Button type="button" onClick={() => openIngredientDialog(null, "edit")}>
            <Plus className="size-4" />
            Novo Ingrediente
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código XPAN, ERP, nome completo, nome reduzido ou tipo..."
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
            data={filteredRows}
            columns={columns}
            actions={actions}
            keyField="rowKey"
            onRowClick={(item) => {
              if (item.rowKind === "mpiProduct" && item.product) {
                openProductDialog(item.product, "view");
                return;
              }

              if (item.ingredient) {
                openIngredientDialog(item.ingredient, "view");
              }
            }}
            emptyMessage={isLoading ? "Carregando ingredientes..." : "Nenhuma referência encontrada"}
            stickyHeader
          />
        </CardContent>
      </Card>

      <IngredientFormDialog
        open={isIngredientDialogOpen}
        onOpenChange={setIsIngredientDialogOpen}
        ingredient={editingIngredient}
        mode={ingredientDialogMode}
        snapshot={snapshot}
        refresh={refresh}
        onRequestEdit={() => setIngredientDialogMode("edit")}
      />

      <ProductFormDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
        product={selectedProduct}
        mode={productDialogMode}
        snapshot={snapshot}
        refresh={refresh}
        onRequestEdit={() => setProductDialogMode("edit")}
      />
    </PageLayout>
  );
}
