-- AJ: estado "produção iniciada", separado de "liberado" (workflow_order_releases)
-- e de "status do item" (workflow_production_items).
--
-- Fluxo: o Gestor LIBERA o pedido (workflow_order_releases) → ele entra na coluna
-- "Em produção" do gestor, mas AINDA NÃO aparece no quadro do Chão de Fábrica.
-- Só quando o Gestor clica "Iniciar produção do dia" é que a OP é marcada aqui e
-- passa a aparecer no Chão, na 1ª coluna ("Não iniciado" / pré-pesagem), com os
-- itens ainda em `nao_iniciado` (o início NÃO avança o status do item).
--
-- Espelha workflow_production_items: keyed por production_item_key CANÔNICA
-- (3 partes `date|line|product`), multi-tenant, RLS de escopo de fábrica.

create table if not exists public.workflow_production_starts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  production_item_key text not null,
  started_at timestamptz not null default timezone('utc', now()),
  started_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_workflow_production_starts_tenant_key_unique
on public.workflow_production_starts (tenant_id, production_item_key);

create index if not exists idx_workflow_production_starts_tenant
on public.workflow_production_starts (tenant_id);

drop trigger if exists set_workflow_production_starts_updated_at on public.workflow_production_starts;
create trigger set_workflow_production_starts_updated_at
  before update on public.workflow_production_starts
  for each row execute function public.set_updated_at();

alter table public.workflow_production_starts enable row level security;

drop policy if exists workflow_production_starts_select_factory_scope on public.workflow_production_starts;
create policy workflow_production_starts_select_factory_scope
on public.workflow_production_starts
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

drop policy if exists workflow_production_starts_manage_factory_scope on public.workflow_production_starts;
create policy workflow_production_starts_manage_factory_scope
on public.workflow_production_starts
for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);
