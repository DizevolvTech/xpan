create table if not exists public.product_preparation_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  stage_key public.production_item_status not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    stage_key in (
      'em_preparacao'::public.production_item_status,
      'em_producao'::public.production_item_status,
      'em_forno'::public.production_item_status,
      'embalando'::public.production_item_status
    )
  )
);

create unique index if not exists idx_product_preparation_steps_tenant_product_stage_unique
on public.product_preparation_steps (tenant_id, product_id, stage_key);

create index if not exists idx_product_preparation_steps_tenant_product_sort
on public.product_preparation_steps (tenant_id, product_id, sort_order);

insert into public.product_preparation_steps (tenant_id, product_id, stage_key, sort_order)
select
  product.tenant_id,
  product.id,
  step.stage_key,
  step.sort_order
from public.products as product
cross join lateral (
  values
    ('em_preparacao'::public.production_item_status, 0),
    ('em_producao'::public.production_item_status, 1),
    ('em_forno'::public.production_item_status, 2),
    ('embalando'::public.production_item_status, 3)
) as step(stage_key, sort_order)
where not exists (
  select 1
  from public.product_preparation_steps as existing
  where existing.product_id = product.id
);

drop trigger if exists set_product_preparation_steps_updated_at
on public.product_preparation_steps;

create trigger set_product_preparation_steps_updated_at
before update on public.product_preparation_steps
for each row execute function public.set_updated_at();

alter table public.product_preparation_steps enable row level security;

drop policy if exists product_preparation_steps_select_authenticated
on public.product_preparation_steps;

create policy product_preparation_steps_select_authenticated
on public.product_preparation_steps
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists product_preparation_steps_manage_catalog_admin
on public.product_preparation_steps;

create policy product_preparation_steps_manage_catalog_admin
on public.product_preparation_steps
for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-dados'::public.user_role
  )
);
