create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  slug text not null unique,
  name text not null,
  status public.record_status not null default 'ativo',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_tenants_updated_at on public.tenants;
create trigger set_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

insert into public.tenants (legacy_id, slug, name, status)
values ('tenant-legacy-root', 'ecossistema-atual', 'Ecossistema Atual', 'ativo')
on conflict (slug) do update
set
  name = excluded.name,
  status = excluded.status;

alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

alter table public.user_permissions
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.operational_settings
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.stores
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.profile_store_access
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.categories
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.subcategories
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.schedule_lines
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.schedule_line_item_snapshots
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.ingredients
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.ingredient_components
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.products
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.product_recipe_items
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.store_orders
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.store_order_items
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.workflow_order_releases
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.workflow_production_items
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.delivery_executions
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.store_occurrences
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.store_order_events
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.store_occurrence_events
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.business_code_sequences
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

with initial_tenant as (
  select id
  from public.tenants
  where slug = 'ecossistema-atual'
  limit 1
)
update public.profiles as profile
set tenant_id = initial_tenant.id
from initial_tenant
where profile.tenant_id is null
  and profile.role <> 'administrador-master'::public.user_role;

update public.user_permissions as permission
set tenant_id = profile.tenant_id
from public.profiles as profile
where profile.id = permission.profile_id
  and permission.tenant_id is null;

with initial_tenant as (
  select id
  from public.tenants
  where slug = 'ecossistema-atual'
  limit 1
)
update public.operational_settings as settings
set tenant_id = initial_tenant.id
from initial_tenant
where settings.tenant_id is null;

with initial_tenant as (
  select id
  from public.tenants
  where slug = 'ecossistema-atual'
  limit 1
)
update public.stores as store
set tenant_id = initial_tenant.id
from initial_tenant
where store.tenant_id is null;

update public.profile_store_access as access
set tenant_id = store.tenant_id
from public.stores as store
where store.id = access.store_id
  and access.tenant_id is null;

with initial_tenant as (
  select id
  from public.tenants
  where slug = 'ecossistema-atual'
  limit 1
)
update public.categories as category
set tenant_id = initial_tenant.id
from initial_tenant
where category.tenant_id is null;

update public.subcategories as subcategory
set tenant_id = category.tenant_id
from public.categories as category
where category.id = subcategory.category_id
  and subcategory.tenant_id is null;

update public.schedule_lines as line
set tenant_id = subcategory.tenant_id
from public.subcategories as subcategory
where subcategory.id = line.subcategory_id
  and line.tenant_id is null;

update public.schedule_line_item_snapshots as snapshot
set tenant_id = line.tenant_id
from public.schedule_lines as line
where line.id = snapshot.schedule_line_id
  and snapshot.tenant_id is null;

with initial_tenant as (
  select id
  from public.tenants
  where slug = 'ecossistema-atual'
  limit 1
)
update public.ingredients as ingredient
set tenant_id = initial_tenant.id
from initial_tenant
where ingredient.tenant_id is null;

update public.ingredient_components as component
set tenant_id = ingredient.tenant_id
from public.ingredients as ingredient
where ingredient.id = component.ingredient_id
  and component.tenant_id is null;

update public.products as product
set tenant_id = subcategory.tenant_id
from public.subcategories as subcategory
where subcategory.id = product.subcategory_id
  and product.tenant_id is null;

update public.product_recipe_items as item
set tenant_id = product.tenant_id
from public.products as product
where product.id = item.product_id
  and item.tenant_id is null;

update public.store_orders as order_row
set tenant_id = store.tenant_id
from public.stores as store
where store.id = order_row.store_id
  and order_row.tenant_id is null;

update public.store_order_items as item
set tenant_id = order_row.tenant_id
from public.store_orders as order_row
where order_row.id = item.order_id
  and item.tenant_id is null;

update public.workflow_order_releases as release
set tenant_id = order_row.tenant_id
from public.store_orders as order_row
where order_row.id = release.order_id
  and release.tenant_id is null;

with initial_tenant as (
  select id
  from public.tenants
  where slug = 'ecossistema-atual'
  limit 1
)
update public.workflow_production_items as item
set tenant_id = initial_tenant.id
from initial_tenant
where item.tenant_id is null;

update public.delivery_executions as execution
set tenant_id = order_row.tenant_id
from public.store_orders as order_row
where order_row.id = execution.order_id
  and execution.tenant_id is null;

update public.store_occurrences as occurrence
set tenant_id = order_row.tenant_id
from public.store_orders as order_row
where order_row.id = occurrence.order_id
  and occurrence.tenant_id is null;

update public.store_order_events as event
set tenant_id = order_row.tenant_id
from public.store_orders as order_row
where order_row.id = event.order_id
  and event.tenant_id is null;

update public.store_occurrence_events as event
set tenant_id = occurrence.tenant_id
from public.store_occurrences as occurrence
where occurrence.id = event.occurrence_id
  and event.tenant_id is null;

with initial_tenant as (
  select id
  from public.tenants
  where slug = 'ecossistema-atual'
  limit 1
)
update public.business_code_sequences as sequence
set tenant_id = initial_tenant.id
from initial_tenant
where sequence.tenant_id is null;

alter table public.operational_settings
  alter column tenant_id set not null;

alter table public.stores
  alter column tenant_id set not null;

alter table public.profile_store_access
  alter column tenant_id set not null;

alter table public.categories
  alter column tenant_id set not null;

alter table public.subcategories
  alter column tenant_id set not null;

alter table public.schedule_lines
  alter column tenant_id set not null;

alter table public.schedule_line_item_snapshots
  alter column tenant_id set not null;

alter table public.ingredients
  alter column tenant_id set not null;

alter table public.ingredient_components
  alter column tenant_id set not null;

alter table public.products
  alter column tenant_id set not null;

alter table public.product_recipe_items
  alter column tenant_id set not null;

alter table public.store_orders
  alter column tenant_id set not null;

alter table public.store_order_items
  alter column tenant_id set not null;

alter table public.workflow_order_releases
  alter column tenant_id set not null;

alter table public.workflow_production_items
  alter column tenant_id set not null;

alter table public.delivery_executions
  alter column tenant_id set not null;

alter table public.store_occurrences
  alter column tenant_id set not null;

alter table public.store_order_events
  alter column tenant_id set not null;

alter table public.store_occurrence_events
  alter column tenant_id set not null;

alter table public.business_code_sequences
  alter column tenant_id set not null;

alter table public.profiles
  drop constraint if exists profiles_tenant_role_check;

alter table public.profiles
  add constraint profiles_tenant_role_check
  check (
    (
      role = 'administrador-master'::public.user_role
      and tenant_id is null
    )
    or (
      role <> 'administrador-master'::public.user_role
      and tenant_id is not null
    )
  );

alter table public.stores
  drop constraint if exists stores_code_key;

alter table public.categories
  drop constraint if exists categories_code_key;

alter table public.subcategories
  drop constraint if exists subcategories_code_key;

alter table public.schedule_lines
  drop constraint if exists schedule_lines_code_key;

alter table public.ingredients
  drop constraint if exists ingredients_code_key;

alter table public.products
  drop constraint if exists products_code_key;

alter table public.store_orders
  drop constraint if exists store_orders_code_key;

alter table public.store_occurrences
  drop constraint if exists store_occurrences_code_key;

alter table public.workflow_production_items
  drop constraint if exists workflow_production_items_production_item_key_key;

drop index if exists public.idx_ingredients_external_code_unique;
drop index if exists public.idx_products_external_code_unique;

alter table public.business_code_sequences
  drop constraint if exists business_code_sequences_pkey;

create unique index if not exists idx_stores_tenant_code_unique
on public.stores (tenant_id, code);

create unique index if not exists idx_categories_tenant_code_unique
on public.categories (tenant_id, code);

create unique index if not exists idx_subcategories_tenant_code_unique
on public.subcategories (tenant_id, code);

create unique index if not exists idx_schedule_lines_tenant_code_unique
on public.schedule_lines (tenant_id, code);

create unique index if not exists idx_ingredients_tenant_code_unique
on public.ingredients (tenant_id, code);

create unique index if not exists idx_products_tenant_code_unique
on public.products (tenant_id, code);

create unique index if not exists idx_store_orders_tenant_code_unique
on public.store_orders (tenant_id, code);

create unique index if not exists idx_store_occurrences_tenant_code_unique
on public.store_occurrences (tenant_id, code);

create unique index if not exists idx_workflow_production_items_tenant_key_unique
on public.workflow_production_items (tenant_id, production_item_key);

create unique index if not exists idx_profile_store_access_tenant_profile_store_unique
on public.profile_store_access (tenant_id, profile_id, store_id);

create unique index if not exists idx_user_permissions_tenant_profile_module_unique
on public.user_permissions (tenant_id, profile_id, module_key);

create unique index if not exists idx_workflow_order_releases_tenant_order_unique
on public.workflow_order_releases (tenant_id, order_id);

create unique index if not exists idx_delivery_executions_tenant_order_unique
on public.delivery_executions (tenant_id, order_id);

create unique index if not exists idx_operational_settings_tenant_unique
on public.operational_settings (tenant_id);

create unique index if not exists idx_ingredients_tenant_external_code_unique
on public.ingredients (tenant_id, lower(external_code))
where external_code is not null and btrim(external_code) <> '';

create unique index if not exists idx_products_tenant_external_code_unique
on public.products (tenant_id, lower(external_code))
where external_code is not null and btrim(external_code) <> '';

alter table public.business_code_sequences
  add constraint business_code_sequences_pkey primary key (tenant_id, prefix, scope_key);

create index if not exists idx_profiles_tenant on public.profiles (tenant_id);
create index if not exists idx_user_permissions_tenant on public.user_permissions (tenant_id);
create index if not exists idx_operational_settings_tenant on public.operational_settings (tenant_id);
create index if not exists idx_stores_tenant on public.stores (tenant_id);
create index if not exists idx_profile_store_access_tenant on public.profile_store_access (tenant_id);
create index if not exists idx_categories_tenant on public.categories (tenant_id);
create index if not exists idx_subcategories_tenant on public.subcategories (tenant_id);
create index if not exists idx_schedule_lines_tenant on public.schedule_lines (tenant_id);
create index if not exists idx_schedule_line_item_snapshots_tenant on public.schedule_line_item_snapshots (tenant_id);
create index if not exists idx_ingredients_tenant on public.ingredients (tenant_id);
create index if not exists idx_ingredient_components_tenant on public.ingredient_components (tenant_id);
create index if not exists idx_products_tenant on public.products (tenant_id);
create index if not exists idx_product_recipe_items_tenant on public.product_recipe_items (tenant_id);
create index if not exists idx_store_orders_tenant on public.store_orders (tenant_id);
create index if not exists idx_store_order_items_tenant on public.store_order_items (tenant_id);
create index if not exists idx_workflow_order_releases_tenant on public.workflow_order_releases (tenant_id);
create index if not exists idx_workflow_production_items_tenant on public.workflow_production_items (tenant_id);
create index if not exists idx_delivery_executions_tenant on public.delivery_executions (tenant_id);
create index if not exists idx_store_occurrences_tenant on public.store_occurrences (tenant_id);
create index if not exists idx_store_order_events_tenant on public.store_order_events (tenant_id);
create index if not exists idx_store_occurrence_events_tenant on public.store_occurrence_events (tenant_id);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.status = 'ativo'
  limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select profiles.role
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.status = 'ativo'
  limit 1;
$$;

create or replace function public.current_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.tenant_id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.status = 'ativo'
  limit 1;
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_tenant_id();
$$;

create or replace function public.is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'administrador-master'::public.user_role;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'administrador'::public.user_role;
$$;

create or replace function public.can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.current_tenant_id() is null then false
    when public.current_user_role() in (
      'administrador'::public.user_role,
      'gestor-dados'::public.user_role,
      'gestor-fabrica'::public.user_role,
      'chao-fabrica'::public.user_role
    ) then exists (
      select 1
      from public.stores
      where stores.id = target_store_id
        and stores.tenant_id = public.current_tenant_id()
    )
    when public.current_user_role() = 'loja'::public.user_role then exists (
      select 1
      from public.profile_store_access
      join public.stores on stores.id = profile_store_access.store_id
      where profile_store_access.profile_id = public.current_profile_id()
        and profile_store_access.store_id = target_store_id
        and profile_store_access.tenant_id = public.current_tenant_id()
        and stores.tenant_id = public.current_tenant_id()
    )
    else false
  end;
$$;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_tenant_id() to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_master_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_store(uuid) to authenticated;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.permission_modules enable row level security;
alter table public.user_permissions enable row level security;
alter table public.operational_settings enable row level security;
alter table public.stores enable row level security;
alter table public.profile_store_access enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.schedule_lines enable row level security;
alter table public.schedule_line_item_snapshots enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_components enable row level security;
alter table public.products enable row level security;
alter table public.product_recipe_items enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.workflow_order_releases enable row level security;
alter table public.workflow_production_items enable row level security;
alter table public.delivery_executions enable row level security;
alter table public.store_occurrences enable row level security;
alter table public.store_order_events enable row level security;
alter table public.store_occurrence_events enable row level security;
alter table public.business_code_sequences enable row level security;

drop policy if exists tenants_select_master_only on public.tenants;
create policy tenants_select_master_only
on public.tenants
for select
to authenticated
using (public.is_master_admin());

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  auth.uid() = auth_user_id
  or (
    tenant_id is not null
    and tenant_id = public.current_tenant_id()
    and public.is_admin()
  )
);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (
  auth.uid() = auth_user_id
  or (
    tenant_id is not null
    and tenant_id = public.current_tenant_id()
    and public.is_admin()
  )
)
with check (
  auth.uid() = auth_user_id
  or (
    tenant_id is not null
    and tenant_id = public.current_tenant_id()
    and public.is_admin()
  )
);

drop policy if exists permission_modules_select_authenticated on public.permission_modules;
create policy permission_modules_select_authenticated
on public.permission_modules
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists user_permissions_select_self_or_admin on public.user_permissions;
create policy user_permissions_select_self_or_admin
on public.user_permissions
for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or (
    tenant_id is not null
    and tenant_id = public.current_tenant_id()
    and public.is_admin()
  )
);

drop policy if exists user_permissions_manage_admin on public.user_permissions;
create policy user_permissions_manage_admin
on public.user_permissions
for all
to authenticated
using (
  tenant_id is not null
  and tenant_id = public.current_tenant_id()
  and public.is_admin()
)
with check (
  tenant_id is not null
  and tenant_id = public.current_tenant_id()
  and public.is_admin()
);

drop policy if exists operational_settings_select_authenticated on public.operational_settings;
create policy operational_settings_select_authenticated
on public.operational_settings
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists operational_settings_manage_catalog_admin on public.operational_settings;
create policy operational_settings_manage_catalog_admin
on public.operational_settings
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

drop policy if exists stores_select_by_scope on public.stores;
create policy stores_select_by_scope
on public.stores
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.can_access_store(id)
);

drop policy if exists stores_manage_catalog_admin on public.stores;
create policy stores_manage_catalog_admin
on public.stores
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

drop policy if exists profile_store_access_select_self_or_admin on public.profile_store_access;
create policy profile_store_access_select_self_or_admin
on public.profile_store_access
for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or (
    tenant_id = public.current_tenant_id()
    and public.is_admin()
  )
);

drop policy if exists profile_store_access_manage_admin on public.profile_store_access;
create policy profile_store_access_manage_admin
on public.profile_store_access
for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_admin()
)
with check (
  tenant_id = public.current_tenant_id()
  and public.is_admin()
);

drop policy if exists categories_select_authenticated on public.categories;
create policy categories_select_authenticated
on public.categories
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists categories_manage_catalog_admin on public.categories;
create policy categories_manage_catalog_admin
on public.categories
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

drop policy if exists subcategories_select_authenticated on public.subcategories;
create policy subcategories_select_authenticated
on public.subcategories
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists subcategories_manage_catalog_admin on public.subcategories;
create policy subcategories_manage_catalog_admin
on public.subcategories
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

drop policy if exists schedule_lines_select_authenticated on public.schedule_lines;
create policy schedule_lines_select_authenticated
on public.schedule_lines
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists schedule_lines_manage_catalog_admin on public.schedule_lines;
create policy schedule_lines_manage_catalog_admin
on public.schedule_lines
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

drop policy if exists schedule_line_item_snapshots_select_authenticated on public.schedule_line_item_snapshots;
create policy schedule_line_item_snapshots_select_authenticated
on public.schedule_line_item_snapshots
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists schedule_line_item_snapshots_manage_catalog_admin on public.schedule_line_item_snapshots;
create policy schedule_line_item_snapshots_manage_catalog_admin
on public.schedule_line_item_snapshots
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

drop policy if exists ingredients_select_authenticated on public.ingredients;
create policy ingredients_select_authenticated
on public.ingredients
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists ingredients_manage_catalog_admin on public.ingredients;
create policy ingredients_manage_catalog_admin
on public.ingredients
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

drop policy if exists ingredient_components_select_authenticated on public.ingredient_components;
create policy ingredient_components_select_authenticated
on public.ingredient_components
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists ingredient_components_manage_catalog_admin on public.ingredient_components;
create policy ingredient_components_manage_catalog_admin
on public.ingredient_components
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

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated
on public.products
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists products_manage_catalog_admin on public.products;
create policy products_manage_catalog_admin
on public.products
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

drop policy if exists product_recipe_items_select_authenticated on public.product_recipe_items;
create policy product_recipe_items_select_authenticated
on public.product_recipe_items
for select
to authenticated
using (tenant_id = public.current_tenant_id());

drop policy if exists product_recipe_items_manage_catalog_admin on public.product_recipe_items;
create policy product_recipe_items_manage_catalog_admin
on public.product_recipe_items
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

drop policy if exists store_orders_select_by_scope on public.store_orders;
create policy store_orders_select_by_scope
on public.store_orders
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.can_access_store(store_id)
);

drop policy if exists store_orders_insert_store_or_admin on public.store_orders;
create policy store_orders_insert_store_or_admin
on public.store_orders
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (
    (
      public.current_user_role() = 'loja'::public.user_role
      and created_by_profile_id = public.current_profile_id()
      and public.can_access_store(store_id)
    )
    or public.current_user_role() in (
      'administrador'::public.user_role,
      'gestor-fabrica'::public.user_role,
      'gestor-dados'::public.user_role
    )
  )
);

drop policy if exists store_orders_update_factory_or_admin on public.store_orders;
create policy store_orders_update_factory_or_admin
on public.store_orders
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.current_user_role() in (
      'administrador'::public.user_role,
      'gestor-fabrica'::public.user_role,
      'gestor-dados'::public.user_role
    )
    or (
      public.current_user_role() = 'loja'::public.user_role
      and created_by_profile_id = public.current_profile_id()
      and public.can_access_store(store_id)
    )
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.current_user_role() in (
      'administrador'::public.user_role,
      'gestor-fabrica'::public.user_role,
      'gestor-dados'::public.user_role
    )
    or (
      public.current_user_role() = 'loja'::public.user_role
      and created_by_profile_id = public.current_profile_id()
      and public.can_access_store(store_id)
    )
  )
);

drop policy if exists store_order_items_select_by_scope on public.store_order_items;
create policy store_order_items_select_by_scope
on public.store_order_items
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_items.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_order_items_insert_by_scope on public.store_order_items;
create policy store_order_items_insert_by_scope
on public.store_order_items
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_items.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and (
        public.current_user_role() in (
          'administrador'::public.user_role,
          'gestor-fabrica'::public.user_role,
          'gestor-dados'::public.user_role
        )
        or (
          public.current_user_role() = 'loja'::public.user_role
          and store_orders.created_by_profile_id = public.current_profile_id()
          and public.can_access_store(store_orders.store_id)
        )
      )
  )
);

drop policy if exists workflow_order_releases_select_by_scope on public.workflow_order_releases;
create policy workflow_order_releases_select_by_scope
on public.workflow_order_releases
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = workflow_order_releases.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists workflow_order_releases_manage_factory_or_admin on public.workflow_order_releases;
create policy workflow_order_releases_manage_factory_or_admin
on public.workflow_order_releases
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

drop policy if exists workflow_production_items_select_factory_scope on public.workflow_production_items;
create policy workflow_production_items_select_factory_scope
on public.workflow_production_items
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

drop policy if exists workflow_production_items_manage_factory_scope on public.workflow_production_items;
create policy workflow_production_items_manage_factory_scope
on public.workflow_production_items
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

drop policy if exists delivery_executions_select_by_scope on public.delivery_executions;
create policy delivery_executions_select_by_scope
on public.delivery_executions
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = delivery_executions.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists delivery_executions_manage_factory_scope on public.delivery_executions;
create policy delivery_executions_manage_factory_scope
on public.delivery_executions
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

drop policy if exists store_occurrences_select_by_scope on public.store_occurrences;
create policy store_occurrences_select_by_scope
on public.store_occurrences
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_occurrences_insert_store_or_admin on public.store_occurrences;
create policy store_occurrences_insert_store_or_admin
on public.store_occurrences
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and (
        public.current_user_role() in (
          'administrador'::public.user_role,
          'gestor-fabrica'::public.user_role
        )
        or (
          public.current_user_role() = 'loja'::public.user_role
          and store_occurrences.opened_by_profile_id = public.current_profile_id()
          and public.can_access_store(store_orders.store_id)
        )
      )
  )
);

drop policy if exists store_occurrences_update_factory_or_admin on public.store_occurrences;
drop policy if exists store_occurrences_update_by_scope on public.store_occurrences;
create policy store_occurrences_update_by_scope
on public.store_occurrences
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'loja'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'loja'::public.user_role
  )
);

drop policy if exists store_order_events_select_by_scope on public.store_order_events;
create policy store_order_events_select_by_scope
on public.store_order_events
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_events.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_order_events_insert_by_scope on public.store_order_events;
create policy store_order_events_insert_by_scope
on public.store_order_events
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_events.order_id
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role,
    'gestor-dados'::public.user_role,
    'loja'::public.user_role
  )
);

drop policy if exists store_occurrence_events_select_by_scope on public.store_occurrence_events;
create policy store_occurrence_events_select_by_scope
on public.store_occurrence_events
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_occurrences
    join public.store_orders on store_orders.id = store_occurrences.order_id
    where store_occurrences.id = store_occurrence_events.occurrence_id
      and store_occurrences.tenant_id = public.current_tenant_id()
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_occurrence_events_insert_by_scope on public.store_occurrence_events;
create policy store_occurrence_events_insert_by_scope
on public.store_occurrence_events
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.store_occurrences
    join public.store_orders on store_orders.id = store_occurrences.order_id
    where store_occurrences.id = store_occurrence_events.occurrence_id
      and store_occurrences.tenant_id = public.current_tenant_id()
      and store_orders.tenant_id = public.current_tenant_id()
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'loja'::public.user_role
  )
);

drop policy if exists business_code_sequences_no_direct_access on public.business_code_sequences;
create policy business_code_sequences_no_direct_access
on public.business_code_sequences
for all
to public
using (false)
with check (false);

create or replace function public.rebuild_business_code_sequences()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_code_sequences (tenant_id, prefix, scope_key, current_value)
  select
    source.tenant_id,
    source.prefix,
    source.scope_key,
    max(source.sequence_value) as current_value
  from (
    select
      tenant_id,
      split_part(code, '-', 1) as prefix,
      split_part(code, '-', 2) as scope_key,
      split_part(code, '-', 3)::bigint as sequence_value
    from public.store_orders
    where code ~ '^[A-Z]{2}-[0-9]{6}-[0-9]{4,}$'

    union all

    select
      tenant_id,
      split_part(code, '-', 1) as prefix,
      split_part(code, '-', 2) as scope_key,
      split_part(code, '-', 3)::bigint as sequence_value
    from public.store_occurrences
    where code ~ '^[A-Z]{2}-[0-9]{6}-[0-9]{4,}$'

    union all

    select
      tenant_id,
      split_part(code, '-', 1) as prefix,
      '' as scope_key,
      split_part(code, '-', 2)::bigint as sequence_value
    from public.store_orders
    where code ~ '^[A-Z]{2}-[0-9]{4,}$'

    union all

    select
      tenant_id,
      split_part(code, '-', 1) as prefix,
      '' as scope_key,
      split_part(code, '-', 2)::bigint as sequence_value
    from public.store_occurrences
    where code ~ '^[A-Z]{2}-[0-9]{4,}$'
  ) as source
  where source.tenant_id is not null
  group by source.tenant_id, source.prefix, source.scope_key
  on conflict (tenant_id, prefix, scope_key) do update
  set
    current_value = greatest(public.business_code_sequences.current_value, excluded.current_value),
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.next_business_code_number(
  p_prefix text,
  p_scope_key text default '',
  p_tenant_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_prefix text;
  normalized_scope_key text;
  normalized_tenant_id uuid;
  next_value bigint;
begin
  normalized_prefix := upper(btrim(coalesce(p_prefix, '')));
  normalized_scope_key := btrim(coalesce(p_scope_key, ''));
  normalized_tenant_id := coalesce(p_tenant_id, public.current_tenant_id());

  if normalized_prefix = '' then
    raise exception 'Business code prefix is required';
  end if;

  if normalized_tenant_id is null then
    raise exception 'Tenant id is required to allocate business codes';
  end if;

  insert into public.business_code_sequences as sequences (tenant_id, prefix, scope_key, current_value)
  values (normalized_tenant_id, normalized_prefix, normalized_scope_key, 1)
  on conflict (tenant_id, prefix, scope_key) do update
  set
    current_value = sequences.current_value + 1,
    updated_at = timezone('utc', now())
  returning current_value into next_value;

  return next_value;
end;
$$;

select public.rebuild_business_code_sequences();
