"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, ShieldCheck, Users } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { InfoHint } from "@/components/shared/info-hint";
import { KPICard, PageLayout } from "@/components/shared/page-layout";
import { SearchFilter } from "@/components/shared/search-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CreateMasterClientPayload,
  CreateMasterClientResult,
  MasterClient,
} from "@/lib/master-clients";
import { isMasterClientAdminEmailConflictMessage } from "@/lib/master-clients";
import { getTenantIdentifier } from "@/lib/tenant";
import { useMasterClients } from "@/lib/use-master-clients";
import { cn } from "@/lib/utils";

function buildInitialForm(): CreateMasterClientPayload {
  return {
    tenant: {
      name: "",
      status: "ativo",
    },
    admin: {
      name: "",
      email: "",
      status: "ativo",
    },
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildStatusBadge(status: MasterClient["status"]) {
  if (status === "ativo") {
    return (
      <span className="inline-flex items-center rounded-full bg-success/20 px-2.5 py-1 text-xs font-semibold text-success-foreground">
        Ativo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
      Inativo
    </span>
  );
}

export default function AdministradorMasterClientesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clients, error, isLoading, isSubmitting, createClient, enterTenantReadOnly, refresh } =
    useMasterClients();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateMasterClientPayload>(() => buildInitialForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<CreateMasterClientResult | null>(null);
  const adminEmailInputRef = useRef<HTMLInputElement>(null);
  const isCreateDialogVisible = isCreateDialogOpen || searchParams.get("new") === "1";

  const filteredClients = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch =
        normalizedTerm.length === 0 ||
        client.name.toLowerCase().includes(normalizedTerm) ||
        client.slug.toLowerCase().includes(normalizedTerm) ||
        (client.legacyId ?? "").toLowerCase().includes(normalizedTerm);
      const matchesStatus = statusFilter === "all" || client.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clients, searchTerm, statusFilter]);

  const metrics = useMemo(
    () => ({
      totalClients: clients.length,
      activeClients: clients.filter((client) => client.status === "ativo").length,
      stores: clients.reduce((sum, client) => sum + client.metrics.stores, 0),
      orders: clients.reduce((sum, client) => sum + client.metrics.orders, 0),
      users: clients.reduce((sum, client) => sum + client.metrics.users, 0),
    }),
    [clients],
  );

  const columns = [
    {
      key: "name",
      header: "Cliente",
      render: (client: MasterClient) => (
        <div className="min-w-[16rem]">
          <p className="text-sm font-semibold text-foreground">{client.name}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Situação",
      render: (client: MasterClient) => buildStatusBadge(client.status),
    },
    {
      key: "footprint",
      header: "Ecossistema",
      render: (client: MasterClient) => (
        <div className="min-w-[14rem] space-y-0.5 text-sm tabular-nums">
          <p className="font-medium text-foreground">
            {client.metrics.stores} lojas · {client.metrics.products} produtos
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            {client.metrics.users} usuários · {client.metrics.orders} pedidos
          </p>
        </div>
      ),
    },
    {
      key: "health",
      header: "Sinais",
      render: (client: MasterClient) => (
        <div className="min-w-[12rem] space-y-0.5 text-sm tabular-nums">
          <p className="font-medium text-foreground">
            {client.metrics.activeUsers} usuários ativos
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            {client.metrics.openOccurrences} ocorrências abertas
          </p>
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "Última atualização",
      render: (client: MasterClient) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(client.updatedAt)}
        </span>
      ),
    },
  ];

  const actions = [
    {
      icon: "view" as const,
      label: "Ver detalhe",
      onClick: (client: MasterClient) => {
        router.push(`/administrador-master/clientes/${getTenantIdentifier(client)}`);
      },
    },
    {
      icon: "alert" as const,
      label: "Ver ocorrências",
      onClick: (client: MasterClient) => {
        router.push(
          `/administrador-master/clientes/${getTenantIdentifier(client)}?tab=occurrences`,
        );
      },
    },
    {
      icon: "launch" as const,
      label: "Abrir ecossistema",
      onClick: (client: MasterClient) => {
        void handleEnterTenant(client);
      },
    },
  ];

  async function handleEnterTenant(client: MasterClient, redirectTo = "/administrador") {
    try {
      await enterTenantReadOnly(getTenantIdentifier(client));
      window.location.assign(redirectTo);
    } catch (enterError) {
      setPageError(
        enterError instanceof Error
          ? enterError.message
          : "Não foi possível abrir o cliente em modo leitura.",
      );
    }
  }

  function resetForm() {
    setForm(buildInitialForm());
    setFormError(null);
  }

  function updateTenantForm<K extends keyof CreateMasterClientPayload["tenant"]>(
    key: K,
    value: CreateMasterClientPayload["tenant"][K],
  ) {
    setForm((current) => ({
      ...current,
      tenant: {
        ...current.tenant,
        [key]: value,
      },
    }));
    setFormError(null);
  }

  function updateAdminForm<K extends keyof CreateMasterClientPayload["admin"]>(
    key: K,
    value: CreateMasterClientPayload["admin"][K],
  ) {
    setForm((current) => ({
      ...current,
      admin: {
        ...current.admin,
        [key]: value,
      },
    }));
    setFormError(null);
  }

  async function handleCreateClient() {
    setFormError(null);
    setPageError(null);

    const tenantName = form.tenant.name.trim();
    const adminName = form.admin.name.trim();
    const adminEmail = form.admin.email.trim().toLowerCase();

    if (!tenantName || !adminName || !adminEmail) {
      setFormError("Preencha o nome do cliente e os dados iniciais do administrador.");
      return;
    }

    try {
      const created = await createClient({
        tenant: {
          name: tenantName,
          status: form.tenant.status,
        },
        admin: {
          name: adminName,
          email: adminEmail,
          status: form.admin.status,
        },
      });

      setCreatedResult(created);
      setPageError(null);
      setIsCreateDialogOpen(false);
      resetForm();
      router.replace("/administrador-master/clientes");
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : "Não foi possível criar o cliente.";
      setFormError(message);

      if (isMasterClientAdminEmailConflictMessage(message)) {
        adminEmailInputRef.current?.focus();
        adminEmailInputRef.current?.select();
      }
    }
  }

  const hasAdminEmailConflict = isMasterClientAdminEmailConflictMessage(formError);

  return (
    <PageLayout
      title="Clientes"
      description="Carteira SaaS — adoção e acesso em modo leitura por tenant."
      badge="Administrador Master"
      breadcrumbs={[
        { label: "Administrador Master", href: "/administrador-master" },
        { label: "Clientes" },
      ]}
      actions={
        <Button
          type="button"
          onClick={() => {
            setIsCreateDialogOpen(true);
            setFormError(null);
          }}
          disabled={isSubmitting}
        >
          <Building2 className="size-4" />
          Novo Cliente
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard
          title="Clientes"
          value={metrics.totalClients}
          icon={Building2}
          tone="info"
        />
        <KPICard
          title="Clientes ativos"
          value={metrics.activeClients}
          icon={ShieldCheck}
          tone="success"
        />
        <KPICard
          title="Usuários"
          value={metrics.users}
          icon={Users}
          tone="warning"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground/80">
        <span>
          Lojas <span className="font-medium text-foreground">{metrics.stores}</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          Pedidos acumulados <span className="font-medium text-foreground">{metrics.orders}</span>
        </span>
      </div>

      {createdResult ? (
        <div className="rounded-xl border border-success/35 bg-success/10 px-4 py-3 text-sm text-success-foreground">
          <p className="font-semibold">Cliente {createdResult.tenant.name} provisionado com sucesso.</p>
          <p className="mt-1">
            Admin inicial: {createdResult.admin.email}
            {createdResult.temporaryPassword
              ? ` · senha temporária: ${createdResult.temporaryPassword}`
              : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleEnterTenant(createdResult.tenant)}
              disabled={isSubmitting}
            >
              Abrir ecossistema em modo leitura
            </Button>
            <Button asChild type="button" size="sm" variant="outline">
              <Link href={`/administrador-master/clientes/${getTenantIdentifier(createdResult.tenant)}`}>
                Ver detalhe do cliente
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {error || pageError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger-foreground">
          <span>{pageError ?? error}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setPageError(null);
              void refresh();
            }}
            disabled={isLoading}
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Carteira SaaS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilter
            searchPlaceholder="Buscar por nome, slug ou identificador..."
            searchValue={searchTerm}
            onSearch={setSearchTerm}
            filters={[
              {
                key: "status",
                label: "Situação",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "all", label: "Todas" },
                  { value: "ativo", label: "Ativo" },
                  { value: "inativo", label: "Inativo" },
                ],
              },
            ]}
          />

          <DataTable
            data={filteredClients}
            columns={columns}
            actions={actions}
            keyField="id"
            isLoading={isLoading}
            emptyMessage="Nenhum cliente encontrado para os filtros selecionados."
            compact
            stickyHeader
            tableClassName="min-w-[1200px]"
            onRowClick={(client) =>
              router.push(`/administrador-master/clientes/${getTenantIdentifier(client)}`)
            }
            emptyStateAction={{
              label: "Cadastrar cliente",
              onClick: () => setIsCreateDialogOpen(true),
              icon: Building2,
            }}
          />
        </CardContent>
      </Card>

      <Dialog
        open={isCreateDialogVisible}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setFormError(null);
            router.replace("/administrador-master/clientes");
          }
        }}
      >
        <DialogContent size="xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>Novo cliente SaaS</DialogTitle>
              <InfoHint
                size="sm"
                content="Provisionamento seguro: o cliente só é criado quando o e-mail do administrador inicial estiver livre. Se já existir, nada é salvo."
              />
            </div>
            <DialogDescription>
              Cria o tenant, o primeiro administrador e a configuração operacional mínima.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tenant-name">Nome do cliente</Label>
                <Input
                  id="tenant-name"
                  value={form.tenant.name}
                  onChange={(event) => updateTenantForm("name", event.target.value)}
                  placeholder="Padaria Exemplo"
                />
              </div>

              <div className="grid gap-2">
                <Label>Situação do tenant</Label>
                <Select
                  value={form.tenant.status}
                  onValueChange={(value) =>
                    updateTenantForm("status", value as CreateMasterClientPayload["tenant"]["status"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-panel/20 p-4">
              <p className="text-sm font-semibold text-foreground">Administrador inicial do cliente</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="admin-name">Nome</Label>
                  <Input
                    id="admin-name"
                    value={form.admin.name}
                    onChange={(event) => updateAdminForm("name", event.target.value)}
                    placeholder="Gestor responsável"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="admin-email">E-mail</Label>
                  <Input
                    ref={adminEmailInputRef}
                    id="admin-email"
                    type="email"
                    value={form.admin.email}
                    onChange={(event) => updateAdminForm("email", event.target.value)}
                    placeholder="admin@cliente.com"
                    aria-invalid={hasAdminEmailConflict}
                    className={cn(hasAdminEmailConflict && "border-danger focus-visible:ring-danger/40")}
                  />
                  <p
                    className={cn(
                      "text-xs text-muted-foreground",
                      hasAdminEmailConflict && "font-medium text-danger-foreground",
                    )}
                  >
                    {hasAdminEmailConflict
                      ? "Esse e-mail já pertence a outro usuário. Troque o endereço para continuar."
                      : "Use um e-mail exclusivo para o administrador inicial desse cliente."}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Situação do administrador</Label>
                  <Select
                    value={form.admin.status}
                    onValueChange={(value) =>
                      updateAdminForm("status", value as CreateMasterClientPayload["admin"]["status"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {formError ? (
              <div className="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger-foreground">
                {formError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setFormError(null);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleCreateClient()} disabled={isSubmitting}>
              {isSubmitting ? "Provisionando..." : "Provisionar cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
