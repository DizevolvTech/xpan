"use client";

import { useMemo, useState } from "react";
import { Box, Clock3, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchFilter } from "@/components/shared/search-filter";
import { PageLayout } from "@/components/shared/page-layout";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  linesById,
  productionLines,
  productionProducts,
  sectorsById,
  type ProductionProduct,
} from "@/lib/production-planning";

type ProductRow = ProductionProduct & {
  lineName: string;
  sectorName: string;
  validityLabel: string;
};

interface RecipeIngredient {
  id: string;
  ingredient: string;
  quantity: string;
  recipeUnit: string;
}

const productRows: ProductRow[] = productionProducts.map((product) => {
  const line = linesById.get(product.lineId);
  const sector = line ? sectorsById.get(line.sectorId) : undefined;
  return {
    ...product,
    lineName: line?.name ?? "-",
    sectorName: sector?.name ?? "-",
    validityLabel: `${product.validityDays} dias`,
  };
});

const ingredientOptions = Array.from(
  new Set([
    "Farinha",
    "Açúcar",
    "Fermento",
    "Leite",
    ...productionProducts.filter((product) => product.isMpiIngredient).map((product) => product.name),
  ]),
);
const recipeUnitOptions = [
  { value: "kg", label: "Kg" },
  { value: "g", label: "Gramas" },
  { value: "l", label: "Litros" },
  { value: "ml", label: "Mililitros" },
  { value: "un", label: "Unidades" },
];

const recipeUnitLabel = recipeUnitOptions.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export default function ProdutosPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [ingredientsUsed, setIngredientsUsed] = useState<RecipeIngredient[]>([
    { id: "1", ingredient: "Farinha", quantity: "1.2", recipeUnit: "kg" },
    { id: "2", ingredient: "Fermento", quantity: "0.03", recipeUnit: "kg" },
  ]);
  const [draftIngredient, setDraftIngredient] = useState("Farinha");
  const [draftQuantity, setDraftQuantity] = useState("");
  const [draftRecipeUnit, setDraftRecipeUnit] = useState("kg");
  const [preparationText, setPreparationText] = useState("");
  const [isMpiIngredient, setIsMpiIngredient] = useState(false);
  const [breakPercent, setBreakPercent] = useState(5);
  const [yieldPercent, setYieldPercent] = useState(95);

  const filteredProducts = useMemo(
    () =>
      productRows.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.lineName.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm],
  );

  const activeProductsCount = productRows.filter((item) => item.active).length;

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Nome" },
    { key: "lineName", header: "Linha Produção" },
    { key: "sectorName", header: "Setor" },
    {
      key: "active",
      header: "Ativo?",
      render: (item: ProductRow) =>
        item.active ? <StatusBadge status="ativo" /> : <StatusBadge status="inativo" />,
    },
    { key: "weight", header: "Peso Unitário" },
    { key: "validityLabel", header: "Validade" },
  ];

  const actions = [
    { icon: "view" as const, label: "Visualizar", onClick: (item: ProductRow) => console.log("View", item) },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: ProductRow) => {
        setEditingProduct(item);
        setIsDialogOpen(true);
      },
    },
    {
      icon: "delete" as const,
      label: "Excluir",
      variant: "destructive" as const,
      onClick: (item: ProductRow) => console.log("Delete", item),
    },
  ];

  const addRecipeIngredient = () => {
    if (!draftIngredient || !draftQuantity) {
      return;
    }

    setIngredientsUsed((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        ingredient: draftIngredient,
        quantity: draftQuantity,
        recipeUnit: draftRecipeUnit,
      },
    ]);
    setDraftQuantity("");
  };

  const removeRecipeIngredient = (id: string) => {
    setIngredientsUsed((prev) => prev.filter((item) => item.id !== id));
  };

  const clampPercent = (value: number) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(100, Math.max(0, value));
  };

  const handleBreakChange = (value: string) => {
    const nextBreak = clampPercent(Number(value));
    const nextYield = clampPercent(Number((100 - nextBreak).toFixed(2)));
    setBreakPercent(nextBreak);
    setYieldPercent(nextYield);
  };

  const handleYieldChange = (value: string) => {
    const nextYield = clampPercent(Number(value));
    const nextBreak = clampPercent(Number((100 - nextYield).toFixed(2)));
    setYieldPercent(nextYield);
    setBreakPercent(nextBreak);
  };

  return (
    <PageLayout
      title="Gestão de Produtos"
      description="Gerencie os produtos do sistema"
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
        <KPICard title="Última Atualização" value="Há 14 dias" icon={Clock3} tone="neutral" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Produtos</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={() => setEditingProduct(null)}>
                <Plus className="size-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent size="3xl">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Editar Produto" : "Cadastrar Novo Produto"}
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-6 py-2">
                <section>
                  <h3 className="mb-4 text-sm font-semibold">Dados do Produto</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nome do Produto *</Label>
                      <Input id="name" placeholder="Ex: Pão Francês" defaultValue={editingProduct?.name} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="line">Linha de Produção *</Label>
                      <Select defaultValue={editingProduct?.lineId ?? productionLines[0]?.id}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a linha" />
                        </SelectTrigger>
                        <SelectContent>
                          {productionLines.map((line) => {
                            const sectorName = sectorsById.get(line.sectorId)?.name ?? "-";
                            return (
                              <SelectItem key={line.id} value={line.id}>
                                {line.name} · {sectorName}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Input id="description" placeholder="Descrição do produto" />
                    </div>
                    <div className="grid gap-3 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Quebra e Rendimento</Label>
                        <span className="text-xs font-semibold text-muted-foreground">
                          Quebra + Rendimento = 100%
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-2 rounded-lg border border-border/80 bg-card p-3">
                          <Label htmlFor="break">Quebra (%)</Label>
                          <Input
                            id="break"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={breakPercent}
                            onChange={(event) => handleBreakChange(event.target.value)}
                          />
                        </div>
                        <div className="grid gap-2 rounded-lg border border-success-foreground/35 bg-success/30 p-3">
                          <Label htmlFor="yield">Rendimento (%)</Label>
                          <Input
                            id="yield"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={yieldPercent}
                            onChange={(event) => handleYieldChange(event.target.value)}
                            className="border-success-foreground/30 bg-card"
                          />
                          <p className="text-xs text-success-foreground">
                            Campo destacado: valor resultante da produção.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="validity">Validade (dias)</Label>
                      <Input
                        id="validity"
                        type="number"
                        placeholder="Ex: 5"
                        defaultValue={editingProduct?.validityDays}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="minProd">Produção Mínima (Kg)</Label>
                      <Input id="minProd" type="number" placeholder="Ex: 200" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ecoProd">Produção Econômica (Kg)</Label>
                      <Input id="ecoProd" type="number" placeholder="Ex: 200" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Checkbox id="storage" />
                    <label htmlFor="storage" className="text-sm">
                      Permite Armazenamento?
                    </label>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-semibold">Unidades de Medida e Conversões</h3>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border/80 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Unidade de Venda (Como a Loja Pede)
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Unidade de Venda</Label>
                          <Select defaultValue="kg">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">Kg</SelectItem>
                              <SelectItem value="un">Unidades</SelectItem>
                              <SelectItem value="forma">Formas</SelectItem>
                              <SelectItem value="g">Gramas</SelectItem>
                              <SelectItem value="dz">Dúzias</SelectItem>
                              <SelectItem value="bandeja">Bandejas</SelectItem>
                              <SelectItem value="pacote">Pacotes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Fator de Conversão (KC)</Label>
                          <Input type="number" step="0.01" placeholder="Ex: 1.0" defaultValue="1" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/80 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Unidade de Produção (Padeiro)
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Unidade de Produção</Label>
                          <Select defaultValue="kg">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">Kg</SelectItem>
                              <SelectItem value="forma">Forma</SelectItem>
                              <SelectItem value="assadeira">Assadeira</SelectItem>
                              <SelectItem value="tela">Tela</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Fator de Conversão (KC)</Label>
                          <Input type="number" step="0.01" placeholder="Ex: 1.0" defaultValue="1" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/80 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Unidade de Expedição (Embalagem)
                      </p>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="grid gap-2">
                          <Label>Unidade de Expedição</Label>
                          <Select defaultValue="pacote">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pacote">Pacote</SelectItem>
                              <SelectItem value="caixa">Caixa</SelectItem>
                              <SelectItem value="carrinho">Carrinho</SelectItem>
                              <SelectItem value="saco">Saco</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Fator de Conversão</Label>
                          <Input type="number" step="0.01" placeholder="Ex: 1.0" defaultValue="1" />
                        </div>
                        <div className="grid gap-2">
                          <Label>Qtd por Embalagem</Label>
                          <Input type="number" placeholder="Ex: 10" />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-semibold">Ingredientes da Receita</h3>
                  <div className="space-y-4 rounded-lg border border-border/80 p-4">
                    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                      <div className="grid gap-2">
                        <Label>Ingrediente usado</Label>
                        <Select value={draftIngredient} onValueChange={setDraftIngredient}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o ingrediente" />
                          </SelectTrigger>
                          <SelectContent>
                            {ingredientOptions.map((ingredient) => (
                              <SelectItem key={ingredient} value={ingredient}>
                                {ingredient}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 1.50"
                          value={draftQuantity}
                          onChange={(event) => setDraftQuantity(event.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Medida usada na receita</Label>
                        <Select value={draftRecipeUnit} onValueChange={setDraftRecipeUnit}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {recipeUnitOptions.map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button type="button" onClick={addRecipeIngredient}>
                          <Plus className="size-4" />
                          Adicionar
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border/80">
                      <table className="w-full border-collapse">
                        <thead className="bg-panel">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                              Ingrediente usado
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                              Quantidade
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                              Medida usada na receita
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {ingredientsUsed.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="bg-card px-3 py-3 text-sm text-muted-foreground">
                                Nenhum ingrediente adicionado.
                              </td>
                            </tr>
                          ) : (
                            ingredientsUsed.map((item) => (
                              <tr key={item.id}>
                                <td className="border-t border-border/70 bg-card px-3 py-2.5 text-sm">
                                  {item.ingredient}
                                </td>
                                <td className="border-t border-border/70 bg-card px-3 py-2.5 text-sm">
                                  {item.quantity}
                                </td>
                                <td className="border-t border-border/70 bg-card px-3 py-2.5 text-sm">
                                  {recipeUnitLabel[item.recipeUnit] ?? item.recipeUnit}
                                </td>
                                <td className="border-t border-border/70 bg-card px-3 py-2.5 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-danger-foreground/80 hover:bg-danger/40 hover:text-danger-foreground"
                                    onClick={() => removeRecipeIngredient(item.id)}
                                    aria-label={`Remover ${item.ingredient}`}
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
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold">Modo de Preparo</h3>
                  <Textarea
                    placeholder="Descreva o modo de preparo passo a passo..."
                    className="min-h-[140px]"
                    value={preparationText}
                    onChange={(event) => setPreparationText(event.target.value)}
                  />
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold">Ingrediente MPI</h3>
                  <div
                    className={`rounded-lg border p-4 transition-colors ${
                      isMpiIngredient
                        ? "border-success-foreground/35 bg-success/35"
                        : "border-border/80 bg-panel"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="mpi"
                        checked={isMpiIngredient}
                        onCheckedChange={(value) => setIsMpiIngredient(Boolean(value))}
                      />
                      <div className="space-y-2">
                        <label htmlFor="mpi" className="text-sm font-semibold text-foreground">
                          Este produto é um Ingrediente MPI
                        </label>
                        <p className="text-sm text-muted-foreground">
                          Quando marcado, este item pode ser usado como produto final e/ou como
                          novo ingrediente na receita de outro produto.
                        </p>
                        {isMpiIngredient && (
                          <span className="inline-flex rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-success-foreground">
                            Produto habilitado para uso em receitas
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => setIsDialogOpen(false)}>
                  {editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código ou nome..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            showFilters={false}
          />
          <DataTable
            data={filteredProducts}
            columns={columns}
            actions={actions}
            keyField="id"
            emptyMessage="Nenhum produto encontrado"
            stickyHeader
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
