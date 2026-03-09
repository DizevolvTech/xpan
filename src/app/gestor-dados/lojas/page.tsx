"use client";

import { useMemo, useState } from "react";
import { Building2, Clock3, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchFilter } from "@/components/shared/search-filter";
import { PageLayout } from "@/components/shared/page-layout";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getStoreCanOrderSunday,
  getStoreReceivesSunday,
  operationalSettings,
  productionWeekDays,
  storesMasterData,
  type StoreMasterData,
} from "@/lib/production-planning";

type Loja = StoreMasterData;

type LojaFormState = StoreMasterData;

function buildLojaFormState(store?: Loja | null): LojaFormState {
  return {
    id: store?.id ?? `store-${Date.now()}`,
    code: store?.code ?? `LJ-${String(Date.now()).slice(-3)}`,
    name: store?.name ?? "",
    responsible: store?.responsible ?? "",
    email: store?.email ?? "",
    phone: store?.phone ?? "",
    status: store?.status ?? "ativo",
    receiveWindow: store?.receiveWindow ?? "07:00 - 10:00",
    orderingDays: store?.orderingDays ?? ["segunda", "terca", "quarta", "quinta", "sexta"],
    receivingDays: store?.receivingDays ?? ["segunda", "terca", "quarta", "quinta", "sexta"],
  };
}

export default function LojasPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [lojas, setLojas] = useState<Loja[]>(storesMasterData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Loja | null>(null);
  const [formState, setFormState] = useState<LojaFormState>(() => buildLojaFormState());

  const filteredLojas = useMemo(
    () =>
      lojas.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [lojas, searchTerm],
  );

  const columns = [
    { key: "code", header: "Código" },
    { key: "name", header: "Nome" },
    { key: "responsible", header: "Responsável" },
    {
      key: "orderingDays",
      header: "Dias de Pedido",
      render: (item: Loja) => `${item.orderingDays.length} dias`,
    },
    {
      key: "receivingDays",
      header: "Dias de Recebimento",
      render: (item: Loja) => `${item.receivingDays.length} dias`,
    },
    {
      key: "receivesSunday",
      header: "Recebe Domingo",
      render: (item: Loja) => (getStoreReceivesSunday(item) ? "Sim" : "Não"),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Loja) => <StatusBadge status={item.status} />,
    },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Visualizar",
      onClick: (item: Loja) => {
        setEditingStore(item);
        setFormState(buildLojaFormState(item));
        setIsDialogOpen(true);
      },
    },
    {
      icon: "edit" as const,
      label: "Editar",
      onClick: (item: Loja) => {
        setEditingStore(item);
        setFormState(buildLojaFormState(item));
        setIsDialogOpen(true);
      },
    },
  ];

  function toggleDay(scope: "orderingDays" | "receivingDays", day: (typeof productionWeekDays)[number]["key"]) {
    setFormState((current) => ({
      ...current,
      [scope]: current[scope].includes(day)
        ? current[scope].filter((item) => item !== day)
        : [...current[scope], day],
    }));
  }

  function openNewStore() {
    setEditingStore(null);
    setFormState(buildLojaFormState());
    setIsDialogOpen(true);
  }

  function handleSave() {
    setLojas((current) => {
      if (!editingStore) {
        return [formState, ...current];
      }

      return current.map((item) => (item.id === editingStore.id ? formState : item));
    });
    setIsDialogOpen(false);
  }

  return (
    <PageLayout
      title="Gestão de Lojas"
      description="Configure os dias operacionais por loja e centralize horário limite e D+X como regras globais."
      badge="Dados Mestres"
      breadcrumbs={[
        { label: "Gestor de Dados", href: "/gestor-dados" },
        { label: "Lojas" },
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <KPICard title="Registros Ativos" value={`${lojas.length} lojas`} icon={Building2} tone="success" />
        <KPICard title="Última Atualização" value="Há 4 dias" icon={Clock3} tone="neutral" />
      </div>

      <Card className="border-info/25 bg-info/10">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Regra Global</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{operationalSettings.orderCutoffTime}</p>
            <p className="text-sm text-muted-foreground">Horário limite do pedido</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Regra Global</p>
            <p className="mt-1 text-lg font-semibold text-foreground">D+{operationalSettings.expeditionLeadDays}</p>
            <p className="text-sm text-muted-foreground">Lead time padrão de expedição</p>
          </div>
          <div className="text-sm text-muted-foreground">
            Os horários limite e a regra D+X agora pertencem ao sistema/fábrica. Na loja ficam somente os dias em que ela pede e recebe mercadoria.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de Lojas</CardTitle>
          <Button type="button" onClick={openNewStore}>
            <Plus className="size-4" />
            Nova Loja
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por código ou nome..."
            onSearch={setSearchTerm}
            searchValue={searchTerm}
            showFilters={false}
          />
          <DataTable data={filteredLojas} columns={columns} actions={actions} keyField="id" stickyHeader />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent size="3xl">
          <DialogHeader>
            <DialogTitle>{editingStore ? "Editar Loja" : "Cadastrar Loja"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-2">
            <div>
              <h3 className="mb-4 text-sm font-semibold">Informações Básicas</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nome da Loja *</Label>
                  <Input
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Ex: Empório do Pão"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Código</Label>
                  <Input value={formState.code} disabled className="bg-muted" />
                </div>
                <div className="grid gap-2">
                  <Label>Responsável *</Label>
                  <Input
                    value={formState.responsible}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, responsible: event.target.value }))
                    }
                    placeholder="Responsável da loja"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formState.email}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="loja@email.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formState.phone}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, phone: event.target.value }))
                    }
                    placeholder="(99) 99999-9999"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Janela de Recebimento</Label>
                  <Input
                    value={formState.receiveWindow}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, receiveWindow: event.target.value }))
                    }
                    placeholder="07:00 - 10:00"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="space-y-3 rounded-xl border border-border/80 bg-panel/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Dias em que a loja pode fazer pedido</h3>
                  <p className="text-xs text-muted-foreground">
                    Domingo marcado = a loja aceita pedidos no domingo.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {productionWeekDays.map((day) => (
                    <label key={`order-${day.key}`} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
                      <Checkbox
                        checked={formState.orderingDays.includes(day.key)}
                        onCheckedChange={() => toggleDay("orderingDays", day.key)}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pede domingo: <strong>{getStoreCanOrderSunday(formState) ? "sim" : "não"}</strong>
                </p>
              </section>

              <section className="space-y-3 rounded-xl border border-border/80 bg-panel/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Dias em que a loja recebe mercadoria</h3>
                  <p className="text-xs text-muted-foreground">
                    Domingo marcado = a loja recebe mercadoria no domingo.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {productionWeekDays.map((day) => (
                    <label key={`receive-${day.key}`} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
                      <Checkbox
                        checked={formState.receivingDays.includes(day.key)}
                        onCheckedChange={() => toggleDay("receivingDays", day.key)}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Recebe domingo: <strong>{getStoreReceivesSunday(formState) ? "sim" : "não"}</strong>
                </p>
              </section>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave}>
              {editingStore ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
