-- AJ: produção por batidas.
-- (1) capacidade por batida por produto (na unidade de venda; null = sem batida).
-- (2) contador de batidas concluídas por item de OP (production_item_key canônica).
alter table public.products
  add column if not exists capacity_per_batch numeric(12, 3);

create table if not exists public.workflow_production_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  production_item_key text not null,
  batches_done integer not null default 0 check (batches_done >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_workflow_production_batches_tenant_key_unique
on public.workflow_production_batches (tenant_id, production_item_key);

create index if not exists idx_workflow_production_batches_tenant
on public.workflow_production_batches (tenant_id);

drop trigger if exists set_workflow_production_batches_updated_at on public.workflow_production_batches;
create trigger set_workflow_production_batches_updated_at
  before update on public.workflow_production_batches
  for each row execute function public.set_updated_at();

alter table public.workflow_production_batches enable row level security;

drop policy if exists workflow_production_batches_select_factory_scope on public.workflow_production_batches;
create policy workflow_production_batches_select_factory_scope
on public.workflow_production_batches
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

drop policy if exists workflow_production_batches_manage_factory_scope on public.workflow_production_batches;
create policy workflow_production_batches_manage_factory_scope
on public.workflow_production_batches
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
