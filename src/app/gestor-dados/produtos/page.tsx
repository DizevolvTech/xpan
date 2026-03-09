"use client";

import { useMemo, useState } from "react";
import { Box, Clock3, Plus, Trash2 } from "lucide-react";

import { IngredientCompositionEditor } from "@/components/production/ingredient-composition-editor";
import { IngredientProfileFields } from "@/components/production/ingredient-profile-fields";
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
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getProductRecipeTotals,
  hierarchyLabels,
  productionIngredients,
  productionLines,
  productionProducts,
  productionSectors,
  productionWeekDays,
  sectorsById,
  type BreakStage,
  type IngredientCompositionItem,
  type PackagingProfile,
  type ProductUnitProfile,
  type ProductionLine,
  type ProductionProduct,
  type RecipeIngredientReference,
} from "@/lib/production-planning";

type ProductRow = ProductionProduct & {
  lineName: string;
  sectorName: string;
  validityLabel: string;
  productionDaysLabel: string;
};

type ProductFormState = ProductionProduct;

type LineDraftState = {
  name: string;
  sectorId: string;
  capacityPerDayKg: string;
  operatingHours: string;
  type: ProductionLine["type"];
};

type RecipeSourceOption = {
  id: string;
  label: string;
  sourceType: RecipeIngredientReference["sourceType"];
};

const unitOptions = ["Kg", "Un", "Forma", "Assadeira", "Bandeja", "Pacote", "Caixa", "Travessa", "L", "g"] as const;
const breakStageLabels: Record<BreakStage, string> = {
  antes_divisao: "Antes da divisão",
  depois_divisao: "Depois da divisão",
  antes_forno: "Antes do forno",
  depois_forno: "Depois do forno",
};

function createUnitProfile(unit: ProductUnitProfile["unit"], description: string, weightKg: number): ProductUnitProfile {
  return {
    unit,
    description,
    weightKg: unit === "Kg" ? 1 : weightKg,
  };
}

function buildProductFormState(lines: ProductionLine[], product?: ProductRow | null): ProductFormState {
  if (product) {
    return {
      ...product,
      recipe: product.recipe.map((item) => ({ ...item })),
      unitProfiles: {
        sales: { ...product.unitProfiles.sales },
        production: { ...product.unitProfiles.production },
        expedition: { ...product.unitProfiles.expedition },
      },
      packagingProfile: product.packagingProfile ? { ...product.packagingProfile } : undefined,
      ingredientProfile: product.ingredientProfile ? { ...product.ingredientProfile } : undefined,
      productionDays: [...product.productionDays],
    };
  }

  const defaultLine = lines[0];
  return {
    id: `product-${Date.now()}`,
    code: `PR-${String(Date.now()).slice(-5)}`,
    name: "",
    description: "",
    lineId: defaultLine?.id ?? "",
    active: true,
    availableForOrdering: true,
    validityDays: 5,
    minimumProductionKg: 100,
    economicProductionKg: 140,
    allowsStorage: false,
    productionDays: ["segunda", "quarta", "sexta"],
    unitProfiles: {
      sales: createUnitProfile("Kg", "Unidade de venda", 1),
      production: createUnitProfile("Kg", "Unidade de produção", 1),
      expedition: createUnitProfile("Kg", "Unidade de expedição", 1),
    },
    packagingProfile: {
      unit: "Un",
      description: "Embalagem individual",
      weightKg: 0.2,
      quantityPerPackage: 1,
    },
    isSoldLoose: false,
    recipe: [],
    preparationMode: "",
    breakPercent: 0,
    breakStage: "depois_divisao",
    breakComment: "",
    canBeIngredient: false,
    ingredientProfile: {
      unit: "Kg",
      weightKg: 1,
      metadata: "",
      observation: "",
    },
    weight: "1.000 Kg",
    productionUnit: "Kg",
    salesUnit: "Kg",
    salesToKgFactor: 1,
    expeditionUnit: "Kg",
    expeditionToKgFactor: 1,
    isMpiIngredient: false,
  };
}

function buildLineDraft(sectorId: string): LineDraftState {
  return {
    name: "",
    sectorId,
    capacityPerDayKg: "900",
    operatingHours: "05:00 - 14:00",
    type: "Seco",
  };
}

function mapProductRows(products: ProductionProduct[], lines: ProductionLine[]): ProductRow[] {
  const linesMap = new Map(lines.map((line) => [line.id, line]));
  return products.map((product) => {
    const line = linesMap.get(product.lineId);
    const sector = line ? sectorsById.get(line.sectorId) : undefined;

    return {
      ...product,
      lineName: line?.name ?? "-",
      sectorName: sector?.name ?? "-",
      validityLabel: `${product.validityDays} dias`,
      productionDaysLabel: product.productionDays.map((day) => day.slice(0, 3)).join(" · "),
    };
  });
}

export default function ProdutosPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLineDialogOpen, setIsLineDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [productState, setProductState] = useState<ProductionProduct[]>(productionProducts);
  const [lineState, setLineState] = useState<ProductionLine[]>(productionLines);
  const [formState, setFormState] = useState<ProductFormState>(() => buildProductFormState(productionLines));
  const [lineDraft, setLineDraft] = useState<LineDraftState>(() => buildLineDraft(productionSectors[0]?.id ?? ""));
  const [draftRecipeSourceId, setDraftRecipeSourceId] = useState(productionIngredients[0]?.id ?? "");
  const [draftRecipeQuantity, setDraftRecipeQuantity] = useState("");
  const [draftRecipeUnit, setDraftRecipeUnit] = useState<RecipeIngredientReference["unit"]>("Kg");

  const productRows = useMemo(() => mapProductRows(productState, lineState), [lineState, productState]);

  const filteredProducts = useMemo(
    () =>
      productRows.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.lineName.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [productRows, searchTerm],
  );

  const activeProductsCount = productRows.filter((item) => item.active).length;
  const lineOptions = lineState.map((line) => ({
    value: line.id,
    label: `${line.name} · ${sectorsById.get(line.sectorId)?.name ?? "-"}`,
  }));

  const recipeSourceOptions: RecipeSourceOption[] = [
    ...productionIngredients.map((ingredient) => ({
      id: ingredient.id,
      label: `${ingredient.code} · ${ingredient.name}`,
      sourceType: "ingrediente" as const,
    })),
    ...productState
      .filter((product) => product.canBeIngredient)
      .map((product) => ({
        id: product.id,
        label: `${product.code} · ${product.name}`,
        sourceType: "produto" as const,
      })),
  ];

  const recipeTotals = useMemo(() => getProductRecipeTotals(formState), [formState]);
  const mpiCompositionPreview = useMemo<IngredientCompositionItem[]>(
    () =>
      formState.recipe.map((item) => ({
        id: item.id,
        ingredientId: item.sourceType === "ingrediente" ? item.sourceId : undefined,
        productId: item.sourceType === "produto" ? item.sourceId : undefined,
        name: item.label,
        quantity: item.quantity,
        unit: item.unit,
        observation: "",
      })),
    [formState.recipe],
  );

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Nome" },
    { key: "lineName", header: hierarchyLabels.line },
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

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: ProductRow) => {
        setEditingProduct(item);
        setFormState(buildProductFormState(lineState, item));
        setIsDialogOpen(true);
      },
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: ProductRow) => {
        setEditingProduct(item);
        setFormState(buildProductFormState(lineState, item));
        setIsDialogOpen(true);
      },
    },
  ];

  function openNewProduct() {
    setEditingProduct(null);
    setFormState(buildProductFormState(lineState));
    setDraftRecipeSourceId(recipeSourceOptions[0]?.id ?? "");
    setDraftRecipeQuantity("");
    setDraftRecipeUnit("Kg");
  }

  function updateUnitProfile(scope: keyof ProductFormState["unitProfiles"], patch: Partial<ProductUnitProfile>) {
    setFormState((current) => {
      const nextUnit = patch.unit ?? current.unitProfiles[scope].unit;
      const nextWeight =
        patch.weightKg ?? (nextUnit === "Kg" ? 1 : current.unitProfiles[scope].weightKg);

      return {
        ...current,
        unitProfiles: {
          ...current.unitProfiles,
          [scope]: {
            ...current.unitProfiles[scope],
            ...patch,
            unit: nextUnit,
            weightKg: nextUnit === "Kg" ? 1 : nextWeight,
          },
        },
      };
    });
  }

  function updatePackagingProfile(patch: Partial<PackagingProfile>) {
    setFormState((current) => {
      const currentPackaging = current.packagingProfile ?? {
        unit: "Un" as const,
        description: "",
        weightKg: 0.2,
        quantityPerPackage: 1,
      };
      const nextUnit = patch.unit ?? currentPackaging.unit;

      return {
        ...current,
        packagingProfile: {
          ...currentPackaging,
          ...patch,
          unit: nextUnit,
          weightKg: nextUnit === "Kg" ? 1 : patch.weightKg ?? currentPackaging.weightKg,
        },
      };
    });
  }

  function toggleProductionDay(day: (typeof productionWeekDays)[number]["key"]) {
    setFormState((current) => ({
      ...current,
      productionDays: current.productionDays.includes(day)
        ? current.productionDays.filter((item) => item !== day)
        : [...current.productionDays, day],
    }));
  }

  function addRecipeItem() {
    if (!draftRecipeSourceId || !draftRecipeQuantity) {
      return;
    }

    const quantity = Number(draftRecipeQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    const sourceOption = recipeSourceOptions.find((option) => option.id === draftRecipeSourceId);
    if (!sourceOption) {
      return;
    }

    setFormState((current) => ({
      ...current,
      recipe: [
        ...current.recipe,
        {
          id: `recipe-${Date.now()}`,
          sourceId: sourceOption.id,
          sourceType: sourceOption.sourceType,
          label: sourceOption.label,
          quantity,
          unit: draftRecipeUnit,
        },
      ],
    }));
    setDraftRecipeQuantity("");
  }

  function removeRecipeItem(recipeId: string) {
    setFormState((current) => ({
      ...current,
      recipe: current.recipe.filter((item) => item.id !== recipeId),
    }));
  }

  function handleSaveProduct() {
    const salesWeight = formState.unitProfiles.sales.unit === "Kg" ? 1 : formState.unitProfiles.sales.weightKg;
    const expeditionWeight =
      formState.unitProfiles.expedition.unit === "Kg" ? 1 : formState.unitProfiles.expedition.weightKg;

    const nextProduct: ProductionProduct = {
      ...formState,
      salesUnit: formState.unitProfiles.sales.unit,
      productionUnit: formState.unitProfiles.production.unit,
      expeditionUnit: formState.unitProfiles.expedition.unit,
      salesToKgFactor: salesWeight,
      expeditionToKgFactor: expeditionWeight,
      weight: `${salesWeight.toFixed(3)} Kg`,
      isMpiIngredient: formState.canBeIngredient,
    };

    setProductState((current) => {
      if (!editingProduct) {
        return [nextProduct, ...current];
      }
      return current.map((item) => (item.id === editingProduct.id ? nextProduct : item));
    });
    setIsDialogOpen(false);
  }

  function handleCreateLine() {
    const nextLine: ProductionLine = {
      id: `line-${Date.now()}`,
      code: `LP-${String(Date.now()).slice(-3)}`,
      name: lineDraft.name,
      sectorId: lineDraft.sectorId,
      type: lineDraft.type,
      operatingHours: lineDraft.operatingHours,
      capacityPerDayKg: Number(lineDraft.capacityPerDayKg),
      status: "ativo",
    };

    setLineState((current) => [...current, nextLine]);
    setFormState((current) => ({ ...current, lineId: nextLine.id }));
    setIsLineDialogOpen(false);
    setLineDraft(buildLineDraft(lineDraft.sectorId));
  }

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
        <KPICard title="Última Atualização" value="Há 14 dias" icon={Clock3} tone="neutral" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Produtos</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" onClick={openNewProduct}>
                <Plus className="size-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent size="3xl" className="max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Editar Produto" : "Cadastrar Novo Produto"}
                </DialogTitle>
                <DialogDescription>
                  O cadastro agora usa kg como unidade universal da engenharia e concentra cronograma, receita e MPI.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="cadastro" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                  <TabsTrigger value="receita">Receita</TabsTrigger>
                  <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
                  <TabsTrigger value="mpi">Produto como MPI</TabsTrigger>
                </TabsList>

                <TabsContent value="cadastro" className="space-y-5">
                  <section className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="product-name">Nome do Produto *</Label>
                        <Input
                          id="product-name"
                          placeholder="Ex: Pão Francês"
                          value={formState.name}
                          onChange={(event) =>
                            setFormState((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Código</Label>
                        <Input value={formState.code} disabled className="bg-muted" />
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label>Descrição</Label>
                        <Input
                          value={formState.description}
                          onChange={(event) =>
                            setFormState((current) => ({ ...current, description: event.target.value }))
                          }
                          placeholder="Descrição do produto"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                      <div className="grid gap-2">
                        <Label>{hierarchyLabels.line} *</Label>
                        <Select
                          value={formState.lineId}
                          onValueChange={(value) =>
                            setFormState((current) => ({ ...current, lineId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Selecione a ${hierarchyLabels.line.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {lineOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Dialog open={isLineDialogOpen} onOpenChange={setIsLineDialogOpen}>
                          <DialogTrigger asChild>
                            <Button type="button" variant="outline">
                              <Plus className="size-4" />
                              Nova {hierarchyLabels.line}
                            </Button>
                          </DialogTrigger>
                          <DialogContent size="lg">
                            <DialogHeader>
                              <DialogTitle>Nova {hierarchyLabels.line}</DialogTitle>
                              <DialogDescription>
                                Cadastre a nova {hierarchyLabels.line.toLowerCase()} sem sair do produto.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-2">
                              <div className="grid gap-2">
                                <Label>Nome *</Label>
                                <Input
                                  value={lineDraft.name}
                                  onChange={(event) =>
                                    setLineDraft((current) => ({ ...current, name: event.target.value }))
                                  }
                                  placeholder="Ex: Linha Ovos de Páscoa"
                                />
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                <div className="grid gap-2">
                                  <Label>{hierarchyLabels.sector} *</Label>
                                  <Select
                                    value={lineDraft.sectorId}
                                    onValueChange={(value) =>
                                      setLineDraft((current) => ({ ...current, sectorId: value }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {productionSectors.map((sector) => (
                                        <SelectItem key={sector.id} value={sector.id}>
                                          {sector.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Capacidade / dia (Kg)</Label>
                                  <Input
                                    type="number"
                                    value={lineDraft.capacityPerDayKg}
                                    onChange={(event) =>
                                      setLineDraft((current) => ({ ...current, capacityPerDayKg: event.target.value }))
                                    }
                                  />
                                </div>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                <div className="grid gap-2">
                                  <Label>Tipo</Label>
                                  <Select
                                    value={lineDraft.type}
                                    onValueChange={(value) =>
                                      setLineDraft((current) => ({
                                        ...current,
                                        type: value as ProductionLine["type"],
                                      }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Seco">Seco</SelectItem>
                                      <SelectItem value="Úmido">Úmido</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Horário</Label>
                                  <Input
                                    value={lineDraft.operatingHours}
                                    onChange={(event) =>
                                      setLineDraft((current) => ({ ...current, operatingHours: event.target.value }))
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setIsLineDialogOpen(false)}>
                                Cancelar
                              </Button>
                              <Button type="button" onClick={handleCreateLine}>
                                Criar {hierarchyLabels.line}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="grid gap-2">
                        <Label>Validade (dias)</Label>
                        <Input
                          type="number"
                          value={formState.validityDays}
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              validityDays: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Produção mínima (Kg)</Label>
                        <Input
                          type="number"
                          value={formState.minimumProductionKg}
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              minimumProductionKg: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Produção econômica (Kg)</Label>
                        <Input
                          type="number"
                          value={formState.economicProductionKg}
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              economicProductionKg: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="storage"
                        checked={formState.allowsStorage}
                        onCheckedChange={(checked) =>
                          setFormState((current) => ({
                            ...current,
                            allowsStorage: checked === true,
                          }))
                        }
                      />
                      <Label htmlFor="storage">Permite armazenamento?</Label>
                    </div>
                  </section>

                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Unidades de Medida e Pesos Padrão</h3>
                      <p className="text-xs text-muted-foreground">
                        Kg é a base da engenharia. Sempre que a unidade for Kg, o peso padrão fica travado em 1.
                      </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      {(
                        [
                          ["sales", "Venda"],
                          ["production", "Produção"],
                          ["expedition", "Expedição"],
                        ] as const
                      ).map(([scope, title]) => {
                        const profile = formState.unitProfiles[scope];
                        const lockedToKg = profile.unit === "Kg";
                        return (
                          <div key={scope} className="space-y-3 rounded-xl border border-border/70 bg-panel/25 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {title}
                            </p>
                            <div className="grid gap-2">
                              <Label>Unidade</Label>
                              <Select
                                value={profile.unit}
                                onValueChange={(value) =>
                                  updateUnitProfile(scope, {
                                    unit: value as ProductUnitProfile["unit"],
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {unitOptions.map((unit) => (
                                    <SelectItem key={unit} value={unit}>
                                      {unit}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Descrição</Label>
                              <Input
                                value={profile.description}
                                onChange={(event) =>
                                  updateUnitProfile(scope, { description: event.target.value })
                                }
                                placeholder="Ex: caixa térmica"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>Peso padrão (Kg)</Label>
                              <Input
                                type="number"
                                step="0.001"
                                value={lockedToKg ? 1 : profile.weightKg}
                                disabled={lockedToKg}
                                onChange={(event) =>
                                  updateUnitProfile(scope, {
                                    weightKg: Number(event.target.value),
                                  })
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="sold-loose"
                          checked={formState.isSoldLoose}
                          onCheckedChange={(checked) =>
                            setFormState((current) => ({
                              ...current,
                              isSoldLoose: checked === true,
                            }))
                          }
                        />
                        <Label htmlFor="sold-loose">Item vendido a granel</Label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="grid gap-2">
                          <Label>Unidade de embalagem</Label>
                          <Select
                            value={formState.packagingProfile?.unit ?? "Un"}
                            onValueChange={(value) =>
                              updatePackagingProfile({ unit: value as PackagingProfile["unit"] })
                            }
                            disabled={formState.isSoldLoose}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Un">Un</SelectItem>
                              <SelectItem value="Pacote">Pacote</SelectItem>
                              <SelectItem value="Caixa">Caixa</SelectItem>
                              <SelectItem value="Bandeja">Bandeja</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Descrição</Label>
                          <Input
                            value={formState.packagingProfile?.description ?? ""}
                            disabled={formState.isSoldLoose}
                            onChange={(event) => updatePackagingProfile({ description: event.target.value })}
                            placeholder="Ex: brownie embalado individualmente"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Peso padrão (Kg)</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={formState.isSoldLoose ? "" : formState.packagingProfile?.weightKg ?? ""}
                            disabled={formState.isSoldLoose}
                            onChange={(event) =>
                              updatePackagingProfile({ weightKg: Number(event.target.value) })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Qtd por embalagem</Label>
                          <Input
                            type="number"
                            value={formState.isSoldLoose ? "" : formState.packagingProfile?.quantityPerPackage ?? ""}
                            disabled={formState.isSoldLoose}
                            onChange={(event) =>
                              updatePackagingProfile({ quantityPerPackage: Number(event.target.value) })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                </TabsContent>

                <TabsContent value="receita" className="space-y-5">
                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="grid gap-2 md:col-span-2">
                        <Label>Ingrediente / Produto MPI</Label>
                        <Select value={draftRecipeSourceId} onValueChange={setDraftRecipeSourceId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a referência" />
                          </SelectTrigger>
                          <SelectContent>
                            {recipeSourceOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={draftRecipeQuantity}
                          onChange={(event) => setDraftRecipeQuantity(event.target.value)}
                          placeholder="1,500"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Unidade da receita</Label>
                        <Select value={draftRecipeUnit} onValueChange={(value) => setDraftRecipeUnit(value as RecipeIngredientReference["unit"])}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Kg">Kg</SelectItem>
                            <SelectItem value="L">L</SelectItem>
                            <SelectItem value="g">g</SelectItem>
                            <SelectItem value="Un">Un</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" onClick={addRecipeItem}>
                        <Plus className="size-4" />
                        Adicionar item
                      </Button>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-border/70">
                      <table className="w-full border-collapse">
                        <thead className="bg-card">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Referência</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Qtd</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Unidade</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formState.recipe.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="border-t border-border/70 bg-card px-3 py-3 text-sm text-muted-foreground">
                                Nenhum item na receita.
                              </td>
                            </tr>
                          ) : (
                            formState.recipe.map((item) => (
                              <tr key={item.id}>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.label}</td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.quantity}</td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-sm">{item.unit}</td>
                                <td className="border-t border-border/70 bg-card px-3 py-3 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-danger-foreground/80 hover:bg-danger/35 hover:text-danger-foreground"
                                    onClick={() => removeRecipeItem(item.id)}
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
                  </section>

                  <section className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-border/80 bg-panel/25 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Totais da Receita
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        Total de ingredientes: {recipeTotals.totalIngredientsKg.toFixed(3)} Kg
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Total após quebra: {recipeTotals.outputAfterBreakKg.toFixed(3)} Kg
                      </p>
                    </div>
                    <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
                      <div className="grid gap-2">
                        <Label>Quebra (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formState.breakPercent}
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              breakPercent: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Momento da quebra</Label>
                        <Select
                          value={formState.breakStage}
                          onValueChange={(value) =>
                            setFormState((current) => ({
                              ...current,
                              breakStage: value as BreakStage,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(breakStageLabels) as BreakStage[]).map((stage) => (
                              <SelectItem key={stage} value={stage}>
                                {breakStageLabels[stage]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Comentário da quebra</Label>
                        <Input
                          value={formState.breakComment}
                          onChange={(event) =>
                            setFormState((current) => ({ ...current, breakComment: event.target.value }))
                          }
                          placeholder="Ex: perda antes do forno por divisão"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-2">
                    <Label>Modo de preparo</Label>
                    <Textarea
                      value={formState.preparationMode}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, preparationMode: event.target.value }))
                      }
                      className="min-h-[140px]"
                      placeholder="Descreva o modo de preparo passo a passo..."
                    />
                  </section>
                </TabsContent>

                <TabsContent value="cronograma" className="space-y-5">
                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Cronograma definido pelo produto</h3>
                      <p className="text-xs text-muted-foreground">
                        A {hierarchyLabels.line.toLowerCase()} apenas consolida os dias configurados aqui.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      {productionWeekDays.map((day) => {
                        const checked = formState.productionDays.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            type="button"
                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                              checked
                                ? "border-info/60 bg-info/15 text-foreground"
                                : "border-border/70 bg-card text-muted-foreground"
                            }`}
                            onClick={() => toggleProductionDay(day.key)}
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.08em]">{day.shortLabel}</p>
                            <p className="mt-1 text-sm">{day.label}</p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="rounded-xl border border-border/70 bg-panel/25 p-4 text-sm text-muted-foreground">
                      A visão da {hierarchyLabels.line.toLowerCase()} passa a exibir quantos produtos estão vinculados e
                      em quais dias cada produto produz. Não há mais edição do cronograma no cadastro da linha executora.
                    </div>
                  </section>
                </TabsContent>

                <TabsContent value="mpi" className="space-y-5">
                  <section className="space-y-4 rounded-xl border border-border/80 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="mpi-enabled"
                        checked={formState.canBeIngredient}
                        onCheckedChange={(checked) =>
                          setFormState((current) => ({
                            ...current,
                            canBeIngredient: checked === true,
                            isMpiIngredient: checked === true,
                          }))
                        }
                      />
                      <div>
                        <Label htmlFor="mpi-enabled" className="text-sm font-semibold">
                          Este produto pode ser usado como ingrediente (MPI)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Quando ativado, o produto aparece como insumo disponível nas receitas de outros produtos.
                        </p>
                      </div>
                    </div>

                    {formState.canBeIngredient ? (
                      <div className="space-y-4">
                        <IngredientProfileFields
                          title="Perfil espelhado do ingrediente"
                          description="Os mesmos campos do ingrediente ficam disponíveis aqui para o MPI reaproveitável."
                          profile={{
                            unit: formState.ingredientProfile?.unit ?? "Kg",
                            weightKg:
                              formState.ingredientProfile?.unit === "Kg"
                                ? 1
                                : formState.ingredientProfile?.weightKg ?? formState.unitProfiles.sales.weightKg,
                            metadata: formState.ingredientProfile?.metadata ?? "",
                            observation: formState.ingredientProfile?.observation ?? "",
                          }}
                          unitOptions={unitOptions}
                          metadataPlaceholder="Ex: usar como base de sanduíches"
                          observationPlaceholder="Ex: consumir após resfriar"
                          onChange={(patch) =>
                            setFormState((current) => ({
                              ...current,
                              ingredientProfile: {
                                unit: (patch.unit as ProductUnitProfile["unit"] | undefined) ?? current.ingredientProfile?.unit ?? "Kg",
                                weightKg:
                                  patch.unit === "Kg"
                                    ? 1
                                    : patch.weightKg ??
                                      current.ingredientProfile?.weightKg ??
                                      current.unitProfiles.sales.weightKg,
                                metadata: patch.metadata ?? current.ingredientProfile?.metadata ?? "",
                                observation: patch.observation ?? current.ingredientProfile?.observation ?? "",
                              },
                            }))
                          }
                        />

                        <IngredientCompositionEditor
                          title="Composição do MPI"
                          description="Espelho somente leitura da receita técnica que alimenta este ingrediente reutilizável."
                          composition={mpiCompositionPreview}
                          emptyMessage="Nenhum item na receita. Adicione componentes na aba Receita."
                          readOnly
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-panel/20 p-4 text-sm text-muted-foreground">
                        Ative a flag acima para espelhar os campos do cadastro de ingrediente dentro do produto.
                      </div>
                    )}
                  </section>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSaveProduct}>
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
