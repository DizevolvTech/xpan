-- ============================================================
-- Initial schema
-- Source: supabase/migrations/20260309130000_initial_schema.sql
-- ============================================================
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'record_status') then
    create type public.record_status as enum ('ativo', 'inativo');
  end if;

  if not exists (select 1 from pg_type where typname = 'schedule_status') then
    create type public.schedule_status as enum ('pendente', 'ativo', 'inativo');
  end if;

  if not exists (select 1 from pg_type where typname = 'ingredient_type') then
    create type public.ingredient_type as enum ('puro', 'misturado');
  end if;

  if not exists (select 1 from pg_type where typname = 'recipe_source_type') then
    create type public.recipe_source_type as enum ('ingrediente', 'produto');
  end if;

  if not exists (select 1 from pg_type where typname = 'break_stage') then
    create type public.break_stage as enum ('antes_divisao', 'depois_divisao', 'antes_forno', 'depois_forno');
  end if;

  if not exists (select 1 from pg_type where typname = 'weekday_code') then
    create type public.weekday_code as enum ('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo');
  end if;

  if not exists (select 1 from pg_type where typname = 'line_type') then
    create type public.line_type as enum ('Seco', 'Úmido');
  end if;

  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('administrador', 'gestor-dados', 'gestor-fabrica', 'chao-fabrica', 'loja');
  end if;

  if not exists (select 1 from pg_type where typname = 'permission_group') then
    create type public.permission_group as enum ('administrador', 'gestor-dados', 'gestor-fabrica', 'chao-fabrica', 'loja');
  end if;

  if not exists (select 1 from pg_type where typname = 'permission_level') then
    create type public.permission_level as enum ('sem_acesso', 'visualizar', 'operar', 'gerenciar');
  end if;

  if not exists (select 1 from pg_type where typname = 'unit_code') then
    create type public.unit_code as enum ('Kg', 'g', 'L', 'ml', 'Un', 'Dz', 'Forma', 'Travessa', 'Pacote', 'Caixa', 'Bandeja', 'Saco', 'Carrinho', 'Assadeira', 'Tela');
  end if;

  if not exists (select 1 from pg_type where typname = 'production_item_status') then
    create type public.production_item_status as enum ('nao_iniciado', 'em_preparacao', 'em_producao', 'em_forno', 'embalando', 'concluido');
  end if;

  if not exists (select 1 from pg_type where typname = 'delivery_execution_status') then
    create type public.delivery_execution_status as enum ('aguardando_expedicao', 'pronto_coleta', 'em_rota', 'no_destino', 'entregue', 'tentativa_falha');
  end if;

  if not exists (select 1 from pg_type where typname = 'occurrence_quantity_type') then
    create type public.occurrence_quantity_type as enum ('percentual', 'kg', 'operacional');
  end if;

  if not exists (select 1 from pg_type where typname = 'occurrence_status') then
    create type public.occurrence_status as enum ('aberta', 'em_analise', 'resolvida', 'fechada');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  auth_user_id uuid unique,
  role public.user_role not null,
  status public.record_status not null default 'ativo',
  name text not null,
  email text not null unique,
  phone text,
  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  country text,
  avatar_path text,
  password_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.permission_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  label text not null,
  route text not null,
  group_key public.permission_group not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null references public.permission_modules(module_key) on delete cascade,
  access_level public.permission_level not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, module_key)
);

create table if not exists public.operational_settings (
  id uuid primary key default gen_random_uuid(),
  order_cutoff_time time not null,
  expedition_lead_days integer not null check (expedition_lead_days >= 0),
  sale_lead_days integer not null default 1 check (sale_lead_days >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique,
  name text not null,
  responsible text not null,
  responsible_profile_id uuid references public.profiles(id) on delete set null,
  email text not null,
  phone text not null,
  status public.record_status not null default 'ativo',
  receive_window text not null,
  ordering_days public.weekday_code[] not null default '{}'::public.weekday_code[],
  receiving_days public.weekday_code[] not null default '{}'::public.weekday_code[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profile_store_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, store_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique,
  name text not null,
  responsible text not null,
  status public.record_status not null default 'ativo',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.production_line_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status public.record_status not null default 'ativo',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, name)
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique,
  name text not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  type public.line_type not null,
  operating_hours text not null,
  capacity_per_day_kg numeric(12, 3) not null default 0,
  status public.record_status not null default 'ativo',
  line_type_id uuid references public.production_line_types(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_subcategories_line_type_id on public.subcategories(line_type_id);

create table if not exists public.schedule_lines (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique,
  name text not null,
  subcategory_id uuid not null references public.subcategories(id) on delete restrict,
  revision_of_id uuid references public.schedule_lines(id) on delete set null,
  status public.schedule_status not null default 'pendente',
  created_at timestamptz not null default timezone('utc', now()),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  audited_at timestamptz,
  audited_by_profile_id uuid references public.profiles(id) on delete set null,
  audit_notes text,
  deactivated_at timestamptz,
  deactivated_by_profile_id uuid references public.profiles(id) on delete set null
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique,
  name text not null,
  type public.ingredient_type not null,
  unit public.unit_code not null,
  purchase_unit public.unit_code,
  purchase_to_consumption_factor numeric(12, 6) not null default 1,
  metadata text not null default '',
  observation text not null default '',
  status public.record_status not null default 'ativo',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique,
  name text not null,
  description text not null default '',
  subcategory_id uuid not null references public.subcategories(id) on delete restrict,
  active boolean not null default true,
  available_for_ordering boolean not null default true,
  validity_days integer not null default 0,
  minimum_production_kg numeric(12, 3) not null default 0,
  economic_production_kg numeric(12, 3) not null default 0,
  allows_storage boolean not null default false,
  production_days public.weekday_code[] not null default '{}'::public.weekday_code[],
  sale_lead_days integer not null default 1,
  expedition_lead_days integer not null default 1 check (expedition_lead_days >= 0),
  unit_profiles jsonb not null default '{}'::jsonb,
  packaging_profile jsonb,
  is_sold_loose boolean not null default false,
  preparation_mode text not null default '',
  break_percent numeric(8, 3) not null default 0,
  break_stage public.break_stage not null default 'antes_divisao',
  break_comment text not null default '',
  can_be_ingredient boolean not null default false,
  ingredient_profile jsonb,
  weight_label text not null default '',
  production_unit public.unit_code not null,
  sales_unit public.unit_code not null,
  sales_to_kg_factor numeric(12, 6) not null default 1,
  expedition_unit public.unit_code not null,
  expedition_to_kg_factor numeric(12, 6) not null default 1,
  is_mpi_ingredient boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.schedule_line_item_snapshots (
  id uuid primary key default gen_random_uuid(),
  schedule_line_id uuid not null references public.schedule_lines(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  minimum_production numeric(12, 3) not null default 0,
  production_days public.weekday_code[] not null default '{}'::public.weekday_code[],
  created_at timestamptz not null default timezone('utc', now()),
  unique (schedule_line_id, product_id)
);

create table if not exists public.ingredient_components (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  ingredient_reference_id uuid references public.ingredients(id) on delete set null,
  product_reference_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity numeric(12, 6) not null check (quantity > 0),
  unit public.unit_code not null,
  observation text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (ingredient_reference_id is not null and product_reference_id is null)
    or (ingredient_reference_id is null and product_reference_id is not null)
  )
);

create table if not exists public.product_recipe_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source_type public.recipe_source_type not null,
  ingredient_source_id uuid references public.ingredients(id) on delete set null,
  product_source_id uuid references public.products(id) on delete set null,
  label text not null,
  quantity numeric(12, 6) not null check (quantity > 0),
  unit public.unit_code not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (source_type = 'ingrediente' and ingredient_source_id is not null and product_source_id is null)
    or (source_type = 'produto' and ingredient_source_id is null and product_source_id is not null)
  )
);

create table if not exists public.product_changelog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  version_number integer not null,
  change_description text not null,
  changed_by_profile_id uuid references public.profiles(id) on delete set null,
  changed_by_name text not null default '',
  snapshot_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (product_id, version_number)
);

create index if not exists idx_product_changelog_product on public.product_changelog(product_id);
create index if not exists idx_product_changelog_tenant_id on public.product_changelog(tenant_id);
create index if not exists idx_product_changelog_changed_by_profile_id on public.product_changelog(changed_by_profile_id);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique,
  store_id uuid not null references public.stores(id) on delete restrict,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  ordered_at timestamptz not null,
  base_date date not null,
  delivery_date date not null,
  receive_window_snapshot text not null,
  expedition_lead_days_snapshot integer not null check (expedition_lead_days_snapshot >= 0),
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  requested_quantity numeric(12, 3) not null check (requested_quantity >= 0),
  requested_unit public.unit_code not null,
  sales_to_kg_factor_snapshot numeric(12, 6) not null default 1,
  internal_kg_snapshot numeric(12, 6) not null default 0,
  expedition_unit_snapshot public.unit_code not null,
  expedition_to_kg_factor_snapshot numeric(12, 6) not null default 1,
  operational_unit_snapshot public.unit_code not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workflow_order_releases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.store_orders(id) on delete cascade,
  released_at timestamptz not null default timezone('utc', now()),
  released_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workflow_production_items (
  id uuid primary key default gen_random_uuid(),
  production_item_key text not null unique,
  status public.production_item_status not null default 'nao_iniciado',
  progress numeric(5, 2) not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.delivery_executions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.store_orders(id) on delete cascade,
  status public.delivery_execution_status not null default 'aguardando_expedicao',
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_occurrences (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  order_item_id uuid references public.store_order_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  problem_type text not null,
  quantity_type public.occurrence_quantity_type not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  quantity_unit_snapshot text not null,
  description text not null,
  status public.occurrence_status not null default 'aberta',
  opened_by_profile_id uuid references public.profiles(id) on delete set null,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_user_permissions_profile on public.user_permissions(profile_id);
create index if not exists idx_profile_store_access_profile on public.profile_store_access(profile_id);
create index if not exists idx_stores_responsible_profile_id on public.stores(responsible_profile_id);
create index if not exists idx_subcategories_category on public.subcategories(category_id);
create index if not exists idx_schedule_lines_subcategory on public.schedule_lines(subcategory_id);
create index if not exists idx_products_subcategory on public.products(subcategory_id);
create index if not exists idx_store_orders_store_date on public.store_orders(store_id, delivery_date);
create index if not exists idx_store_order_items_order on public.store_order_items(order_id);
create index if not exists idx_workflow_production_items_status on public.workflow_production_items(status);
create index if not exists idx_store_occurrences_order on public.store_occurrences(order_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_user_permissions_updated_at on public.user_permissions;
create trigger set_user_permissions_updated_at before update on public.user_permissions for each row execute function public.set_updated_at();

drop trigger if exists set_operational_settings_updated_at on public.operational_settings;
create trigger set_operational_settings_updated_at before update on public.operational_settings for each row execute function public.set_updated_at();

drop trigger if exists set_stores_updated_at on public.stores;
create trigger set_stores_updated_at before update on public.stores for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();

drop trigger if exists set_subcategories_updated_at on public.subcategories;
create trigger set_subcategories_updated_at before update on public.subcategories for each row execute function public.set_updated_at();
drop trigger if exists set_production_line_types_updated_at on public.production_line_types;
create trigger set_production_line_types_updated_at before update on public.production_line_types for each row execute function public.set_updated_at();

drop trigger if exists set_ingredients_updated_at on public.ingredients;
create trigger set_ingredients_updated_at before update on public.ingredients for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products for each row execute function public.set_updated_at();

drop trigger if exists set_ingredient_components_updated_at on public.ingredient_components;
create trigger set_ingredient_components_updated_at before update on public.ingredient_components for each row execute function public.set_updated_at();

drop trigger if exists set_product_recipe_items_updated_at on public.product_recipe_items;
create trigger set_product_recipe_items_updated_at before update on public.product_recipe_items for each row execute function public.set_updated_at();

drop trigger if exists set_store_orders_updated_at on public.store_orders;
create trigger set_store_orders_updated_at before update on public.store_orders for each row execute function public.set_updated_at();

drop trigger if exists set_store_order_items_updated_at on public.store_order_items;
create trigger set_store_order_items_updated_at before update on public.store_order_items for each row execute function public.set_updated_at();

drop trigger if exists set_workflow_order_releases_updated_at on public.workflow_order_releases;
create trigger set_workflow_order_releases_updated_at before update on public.workflow_order_releases for each row execute function public.set_updated_at();

drop trigger if exists set_store_occurrences_updated_at on public.store_occurrences;
create trigger set_store_occurrences_updated_at before update on public.store_occurrences for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do nothing;

-- ============================================================
-- Row level security
-- Source: supabase/migrations/20260309170000_row_level_security.sql
-- ============================================================
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
    when public.current_user_role() in (
      'administrador'::public.user_role,
      'gestor-dados'::public.user_role,
      'gestor-fabrica'::public.user_role,
      'chao-fabrica'::public.user_role
    ) then true
    when public.current_user_role() = 'loja'::public.user_role then exists (
      select 1
      from public.profile_store_access
      where profile_store_access.profile_id = public.current_profile_id()
        and profile_store_access.store_id = target_store_id
    )
    else false
  end;
$$;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_store(uuid) to authenticated;

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
alter table public.product_changelog enable row level security;
alter table public.production_line_types enable row level security;
drop policy if exists product_changelog_tenant_scope on public.product_changelog;
create policy product_changelog_tenant_scope on public.product_changelog for all to authenticated using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
drop policy if exists production_line_types_tenant_scope on public.production_line_types;
create policy production_line_types_tenant_scope on public.production_line_types for all to authenticated using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.workflow_order_releases enable row level security;
alter table public.workflow_production_items enable row level security;
alter table public.delivery_executions enable row level security;
alter table public.store_occurrences enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  auth.uid() = auth_user_id
  or public.is_admin()
);

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
to authenticated
using (
  auth.uid() = auth_user_id
  or public.is_admin()
)
with check (
  auth.uid() = auth_user_id
  or public.is_admin()
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
  or public.is_admin()
);

drop policy if exists user_permissions_manage_admin on public.user_permissions;
create policy user_permissions_manage_admin
on public.user_permissions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists operational_settings_select_authenticated on public.operational_settings;
create policy operational_settings_select_authenticated
on public.operational_settings
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists stores_select_by_scope on public.stores;
create policy stores_select_by_scope
on public.stores
for select
to authenticated
using (public.can_access_store(id));

drop policy if exists profile_store_access_select_self_or_admin on public.profile_store_access;
create policy profile_store_access_select_self_or_admin
on public.profile_store_access
for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists profile_store_access_manage_admin on public.profile_store_access;
create policy profile_store_access_manage_admin
on public.profile_store_access
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists categories_select_authenticated on public.categories;
create policy categories_select_authenticated
on public.categories
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists subcategories_select_authenticated on public.subcategories;
create policy subcategories_select_authenticated
on public.subcategories
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists schedule_lines_select_authenticated on public.schedule_lines;
create policy schedule_lines_select_authenticated
on public.schedule_lines
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists schedule_line_item_snapshots_select_authenticated on public.schedule_line_item_snapshots;
create policy schedule_line_item_snapshots_select_authenticated
on public.schedule_line_item_snapshots
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists ingredients_select_authenticated on public.ingredients;
create policy ingredients_select_authenticated
on public.ingredients
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists ingredient_components_select_authenticated on public.ingredient_components;
create policy ingredient_components_select_authenticated
on public.ingredient_components
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated
on public.products
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists product_recipe_items_select_authenticated on public.product_recipe_items;
create policy product_recipe_items_select_authenticated
on public.product_recipe_items
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists store_orders_select_by_scope on public.store_orders;
create policy store_orders_select_by_scope
on public.store_orders
for select
to authenticated
using (public.can_access_store(store_id));

drop policy if exists store_orders_insert_store_or_admin on public.store_orders;
create policy store_orders_insert_store_or_admin
on public.store_orders
for insert
to authenticated
with check (
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
);

drop policy if exists store_orders_update_factory_or_admin on public.store_orders;
create policy store_orders_update_factory_or_admin
on public.store_orders
for update
to authenticated
using (
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
with check (
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
);

drop policy if exists store_order_items_select_by_scope on public.store_order_items;
create policy store_order_items_select_by_scope
on public.store_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_items.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_order_items_insert_by_scope on public.store_order_items;
create policy store_order_items_insert_by_scope
on public.store_order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_items.order_id
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
  exists (
    select 1
    from public.store_orders
    where store_orders.id = workflow_order_releases.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists workflow_order_releases_manage_factory_or_admin on public.workflow_order_releases;
create policy workflow_order_releases_manage_factory_or_admin
on public.workflow_order_releases
for all
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  public.current_user_role() in (
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
  public.current_user_role() in (
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
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  public.current_user_role() in (
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
  exists (
    select 1
    from public.store_orders
    where store_orders.id = delivery_executions.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists delivery_executions_manage_factory_scope on public.delivery_executions;
create policy delivery_executions_manage_factory_scope
on public.delivery_executions
for all
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  public.current_user_role() in (
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
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_occurrences_insert_store_or_admin on public.store_occurrences;
create policy store_occurrences_insert_store_or_admin
on public.store_occurrences
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
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
create policy store_occurrences_update_factory_or_admin
on public.store_occurrences
for update
to authenticated
using (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role
  )
)
with check (
  public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role
  )
);

-- ============================================================
-- Seed
-- Source: supabase/seed.sql
-- ============================================================
-- Generated by scripts/supabase/generate-seed.ts
begin;

truncate table public.store_occurrence_events, public.store_order_events, public.store_occurrences, public.delivery_executions, public.workflow_production_items, public.workflow_order_releases, public.store_order_items, public.store_orders, public.business_code_sequences, public.product_changelog, public.product_recipe_items, public.ingredient_components, public.schedule_line_item_snapshots, public.schedule_lines, public.products, public.ingredients, public.profile_store_access, public.user_permissions, public.permission_modules, public.subcategories, public.production_line_types, public.categories, public.stores, public.operational_settings, public.profiles, public.tenants restart identity cascade;

insert into public.tenants (legacy_id, slug, name, status) values ('tenant-seed', 'tenant-seed', 'Ecossistema Seed', 'ativo'::public.record_status);

insert into public.operational_settings (tenant_id, order_cutoff_time, expedition_lead_days, sale_lead_days) values ((select id from public.tenants where legacy_id = 'tenant-seed'), '18:00', 2, 1);

insert into public.categories (legacy_id, tenant_id, code, name, responsible, status) values
  ('sector-panificacao', (select id from public.tenants where legacy_id = 'tenant-seed'), 'SE-001', 'Panificação', 'Maria Santos', 'ativo'::public.record_status),
  ('sector-confeitaria', (select id from public.tenants where legacy_id = 'tenant-seed'), 'SE-002', 'Confeitaria', 'João Silva', 'ativo'::public.record_status),
  ('sector-rotisseria', (select id from public.tenants where legacy_id = 'tenant-seed'), 'SE-003', 'Rotisseria', 'Rafaela Moura', 'ativo'::public.record_status);

insert into public.subcategories (legacy_id, tenant_id, code, name, category_id, type, operating_hours, capacity_per_day_kg, status) values
  ('line-paes', (select id from public.tenants where legacy_id = 'tenant-seed'), 'LP-001', 'Linha de Pães', (select id from public.categories where legacy_id = 'sector-panificacao'), 'Seco'::public.line_type, '04:30 - 13:30', 1500, 'ativo'::public.record_status),
  ('line-confeitaria', (select id from public.tenants where legacy_id = 'tenant-seed'), 'LP-002', 'Linha de Confeitaria', (select id from public.categories where legacy_id = 'sector-confeitaria'), 'Úmido'::public.line_type, '05:30 - 14:30', 900, 'ativo'::public.record_status),
  ('line-rotisseria', (select id from public.tenants where legacy_id = 'tenant-seed'), 'LP-003', 'Linha de Rotisseria', (select id from public.categories where legacy_id = 'sector-rotisseria'), 'Úmido'::public.line_type, '06:00 - 15:00', 1100, 'ativo'::public.record_status),
  ('line-salgados', (select id from public.tenants where legacy_id = 'tenant-seed'), 'LP-004', 'Linha de Salgados', (select id from public.categories where legacy_id = 'sector-rotisseria'), 'Úmido'::public.line_type, '07:00 - 16:30', 850, 'ativo'::public.record_status);

insert into public.stores (legacy_id, tenant_id, code, name, responsible, email, phone, status, receive_window, ordering_days, receiving_days) values
  ('store-01', (select id from public.tenants where legacy_id = 'tenant-seed'), 'LJ-001', 'Empório do Pão', 'Rommel Filho', 'loja1@casaexpress.com', '(85) 98888-1101', 'ativo'::public.record_status, '07:00 - 10:00', array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']::public.weekday_code[], array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']::public.weekday_code[]),
  ('store-02', (select id from public.tenants where legacy_id = 'tenant-seed'), 'LJ-002', 'Padaria Central', 'Carlos Silva', 'loja2@casaexpress.com', '(85) 98888-1102', 'ativo'::public.record_status, '08:00 - 11:00', array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']::public.weekday_code[], array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']::public.weekday_code[]),
  ('store-03', (select id from public.tenants where legacy_id = 'tenant-seed'), 'LJ-003', 'Casa Express Pinheiros', 'Michele Nunes', 'loja3@casaexpress.com', '(85) 98888-1103', 'ativo'::public.record_status, '06:30 - 09:00', array['segunda', 'terca', 'quarta', 'quinta', 'sexta']::public.weekday_code[], array['segunda', 'terca', 'quarta', 'quinta', 'sexta']::public.weekday_code[]);

insert into public.ingredients (legacy_id, tenant_id, code, name, type, unit, metadata, observation, status) values
  ('ing-farinha', (select id from public.tenants where legacy_id = 'tenant-seed'), 'IN-572015', 'Farinha de Trigo', 'puro'::public.ingredient_type, 'Kg'::public.unit_code, 'Matéria-prima base de panificação.', '', 'ativo'::public.record_status),
  ('ing-acucar', (select id from public.tenants where legacy_id = 'tenant-seed'), 'IN-572016', 'Açúcar', 'puro'::public.ingredient_type, 'Kg'::public.unit_code, 'Açúcar refinado padrão.', '', 'ativo'::public.record_status),
  ('ing-fermento', (select id from public.tenants where legacy_id = 'tenant-seed'), 'IN-572017', 'Fermento', 'puro'::public.ingredient_type, 'Kg'::public.unit_code, 'Fermentação panificação.', '', 'ativo'::public.record_status),
  ('ing-leite-condensado', (select id from public.tenants where legacy_id = 'tenant-seed'), 'IN-572018', 'Leite Condensado', 'puro'::public.ingredient_type, 'Kg'::public.unit_code, 'Base de confeitaria.', '', 'ativo'::public.record_status),
  ('ing-leite', (select id from public.tenants where legacy_id = 'tenant-seed'), 'IN-572019', 'Leite Tipo C', 'puro'::public.ingredient_type, 'L'::public.unit_code, 'Leite integral.', '', 'ativo'::public.record_status),
  ('ing-ovo', (select id from public.tenants where legacy_id = 'tenant-seed'), 'IN-572020', 'Ovo Pasteurizado', 'puro'::public.ingredient_type, 'Kg'::public.unit_code, 'Ovos líquidos para produção.', '', 'ativo'::public.record_status),
  ('ing-calda-pudim', (select id from public.tenants where legacy_id = 'tenant-seed'), 'IN-572021', 'Calda para Pudim', 'puro'::public.ingredient_type, 'Kg'::public.unit_code, 'Cobertura final de pudim.', '', 'ativo'::public.record_status),
  ('ing-mistura-neutra', (select id from public.tenants where legacy_id = 'tenant-seed'), 'IN-572022', 'Mistura Neutra de Bolo', 'misturado'::public.ingredient_type, 'Kg'::public.unit_code, 'MPI de confeitaria usada como base.', 'Usar como base para bolos especiais e receitas padronizadas.', 'ativo'::public.record_status);

insert into public.products (legacy_id, tenant_id, code, name, description, subcategory_id, operational_subcategory_id, active, available_for_ordering, validity_days, minimum_production_kg, economic_production_kg, allows_storage, production_days, unit_profiles, packaging_profile, is_sold_loose, preparation_mode, break_percent, break_stage, break_comment, can_be_ingredient, ingredient_profile, weight_label, production_unit, sales_unit, sales_to_kg_factor, expedition_unit, expedition_to_kg_factor, is_mpi_ingredient) values
  ('product-pao-frances', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-83374', 'Pão Francês', 'Pão francês tradicional para venda unitária.', (select id from public.subcategories where legacy_id = 'line-paes'), (select id from public.subcategories where legacy_id = 'line-paes'), true, true, 5, 220, 280, false, array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']::public.weekday_code[], '{"sales":{"unit":"Un","description":"Unidade de venda","weightKg":0.05},"production":{"unit":"Kg","description":"Massa padrão","weightKg":1},"expedition":{"unit":"Pacote","description":"Pacote para separação","weightKg":0.5}}'::jsonb, '{"unit":"Pacote","description":"Pacote de balcão","weightKg":0.5,"quantityPerPackage":10}'::jsonb, false, 'Fermentar, dividir, modelar e assar.', 4, 'depois_divisao'::public.break_stage, 'Perda usual depois da divisão e modelagem.', false, null, '0,050 Kg', 'Kg'::public.unit_code, 'Un'::public.unit_code, 0.05, 'Pacote'::public.unit_code, 0.5, false),
  ('product-pao-forma', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-83375', 'Pão de Forma', 'Pão de forma fatiado.', (select id from public.subcategories where legacy_id = 'line-paes'), (select id from public.subcategories where legacy_id = 'line-paes'), true, true, 6, 150, 190, true, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"sales":{"unit":"Un","description":"Unidade de venda","weightKg":0.45},"production":{"unit":"Forma","description":"Forma de produção","weightKg":0.9},"expedition":{"unit":"Caixa","description":"Caixa de expedição","weightKg":5.4}}'::jsonb, '{"unit":"Pacote","description":"Pacote fatiado","weightKg":0.45,"quantityPerPackage":1}'::jsonb, false, 'Misturar, cilindrar e assar em forma fechada.', 5, 'depois_divisao'::public.break_stage, 'Compensar perda antes do forno para manter peso final.', true, '{"unit":"Un","weightKg":0.45,"metadata":"Produto pode ser consumido como base de sanduíches.","observation":"Usar somente após resfriamento."}'::jsonb, '0,450 Kg', 'Forma'::public.unit_code, 'Un'::public.unit_code, 0.45, 'Caixa'::public.unit_code, 5.4, true),
  ('product-pao-doce', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-83376', 'Pão Doce', 'Pão doce individual.', (select id from public.subcategories where legacy_id = 'line-paes'), (select id from public.subcategories where legacy_id = 'line-paes'), true, true, 4, 120, 180, false, array['terca', 'quinta', 'sabado']::public.weekday_code[], '{"sales":{"unit":"Un","description":"Unidade de venda","weightKg":0.08},"production":{"unit":"Assadeira","description":"Assadeira de produção","weightKg":1.6},"expedition":{"unit":"Bandeja","description":"Bandeja para loja","weightKg":0.96}}'::jsonb, '{"unit":"Bandeja","description":"Bandeja padrão","weightKg":0.96,"quantityPerPackage":12}'::jsonb, false, 'Modelar, fermentar e finalizar com cobertura.', 6, 'depois_divisao'::public.break_stage, 'Quebra calculada após divisão e acabamento.', false, null, '0,080 Kg', 'Assadeira'::public.unit_code, 'Un'::public.unit_code, 0.08, 'Bandeja'::public.unit_code, 0.96, false),
  ('product-mpi-base-pudim', (select id from public.tenants where legacy_id = 'tenant-seed'), 'MPI-001', 'MPI Base para Pudim', 'Base industrializada produzida internamente para família de pudins.', (select id from public.subcategories where legacy_id = 'line-confeitaria'), (select id from public.subcategories where legacy_id = 'line-confeitaria'), true, false, 2, 8, 15, false, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"sales":{"unit":"Kg","description":"Unidade interna de engenharia","weightKg":1},"production":{"unit":"Kg","description":"Batida de base","weightKg":1},"expedition":{"unit":"Kg","description":"Consumo interno","weightKg":1}}'::jsonb, null, true, 'Bater até homogeneizar e reservar para montagem dos pudins.', 0, 'antes_divisao'::public.break_stage, 'Sem quebra planejada na base.', true, '{"unit":"Kg","weightKg":1,"metadata":"MPI produzido na própria fábrica.","observation":"Consumir no mesmo dia da produção."}'::jsonb, '1,000 Kg', 'Kg'::public.unit_code, 'Kg'::public.unit_code, 1, 'Kg'::public.unit_code, 1, true),
  ('product-pudim-mini', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-02197', 'Pudim Leite Condensado Mini', 'Pudim mini moldado individualmente.', (select id from public.subcategories where legacy_id = 'line-confeitaria'), (select id from public.subcategories where legacy_id = 'line-confeitaria'), true, true, 4, 12, 18, true, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"sales":{"unit":"Un","description":"Unidade de venda","weightKg":0.098},"production":{"unit":"Forma","description":"Forma mini","weightKg":4.218},"expedition":{"unit":"Caixa","description":"Caixa térmica","weightKg":4.218}}'::jsonb, '{"unit":"Caixa","description":"Caixa com 43 unidades","weightKg":4.218,"quantityPerPackage":43}'::jsonb, false, 'Porcionar a base, finalizar com calda e assar em banho-maria.', 1.5, 'depois_divisao'::public.break_stage, 'Pequena perda após desenformar.', false, null, '0,098 Kg', 'Forma'::public.unit_code, 'Un'::public.unit_code, 0.098, 'Caixa'::public.unit_code, 4.218, false),
  ('product-pudim-medio', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-02205', 'Pudim Leite Condensado Médio', 'Pudim médio para exposição e encomenda.', (select id from public.subcategories where legacy_id = 'line-confeitaria'), (select id from public.subcategories where legacy_id = 'line-confeitaria'), true, true, 4, 10, 16, true, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"sales":{"unit":"Un","description":"Unidade de venda","weightKg":0.311},"production":{"unit":"Forma","description":"Forma média","weightKg":8.698},"expedition":{"unit":"Caixa","description":"Caixa média","weightKg":8.698}}'::jsonb, '{"unit":"Caixa","description":"Caixa com 28 unidades","weightKg":8.698,"quantityPerPackage":28}'::jsonb, false, 'Dosar a base, cobrir com calda e finalizar no forno.', 1.2, 'depois_divisao'::public.break_stage, 'Ajuste de rendimento após resfriamento.', false, null, '0,311 Kg', 'Forma'::public.unit_code, 'Un'::public.unit_code, 0.311, 'Caixa'::public.unit_code, 8.698, false),
  ('product-pudim-grande', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-00378', 'Pudim Leite Condensado Grande', 'Pudim grande para confeitaria.', (select id from public.subcategories where legacy_id = 'line-confeitaria'), (select id from public.subcategories where legacy_id = 'line-confeitaria'), true, true, 4, 8, 12, true, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"sales":{"unit":"Un","description":"Unidade de venda","weightKg":1.065},"production":{"unit":"Forma","description":"Forma grande","weightKg":2.13},"expedition":{"unit":"Caixa","description":"Caixa grande","weightKg":2.13}}'::jsonb, '{"unit":"Caixa","description":"Caixa com 2 unidades","weightKg":2.13,"quantityPerPackage":2}'::jsonb, false, 'Montagem em forma grande com calda e cocção lenta.', 0.8, 'depois_divisao'::public.break_stage, 'Perda mínima após desenformar.', false, null, '1,065 Kg', 'Forma'::public.unit_code, 'Un'::public.unit_code, 1.065, 'Caixa'::public.unit_code, 2.13, false),
  ('product-brownie', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-74090', 'Brownie Tradicional', 'Brownie embalado individualmente, vendido em kg.', (select id from public.subcategories where legacy_id = 'line-confeitaria'), (select id from public.subcategories where legacy_id = 'line-confeitaria'), true, true, 6, 70, 110, true, array['terca', 'quinta', 'sabado']::public.weekday_code[], '{"sales":{"unit":"Kg","description":"Venda a granel","weightKg":1},"production":{"unit":"Assadeira","description":"Assadeira padrão","weightKg":1.2},"expedition":{"unit":"Caixa","description":"Caixa fechada","weightKg":2.4}}'::jsonb, '{"unit":"Un","description":"Brownie embalado individualmente","weightKg":0.12,"quantityPerPackage":20}'::jsonb, true, 'Misturar, assar e porcionar individualmente.', 8, 'depois_divisao'::public.break_stage, 'Considerar rebarbas no porcionamento individual.', false, null, '1,000 Kg', 'Assadeira'::public.unit_code, 'Kg'::public.unit_code, 1, 'Caixa'::public.unit_code, 2.4, false),
  ('product-frango-assado', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-44810', 'Frango Assado', 'Frango inteiro assado para rotisseria.', (select id from public.subcategories where legacy_id = 'line-rotisseria'), (select id from public.subcategories where legacy_id = 'line-rotisseria'), true, true, 2, 180, 260, false, array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']::public.weekday_code[], '{"sales":{"unit":"Un","description":"Unidade de venda","weightKg":1.6},"production":{"unit":"Assadeira","description":"Assadeira do forno","weightKg":8},"expedition":{"unit":"Caixa","description":"Caixa térmica","weightKg":8}}'::jsonb, '{"unit":"Caixa","description":"Caixa térmica com 5 unidades","weightKg":8,"quantityPerPackage":5}'::jsonb, false, 'Temperar, assar e embalar em caixa térmica.', 3, 'depois_divisao'::public.break_stage, 'Ajuste de perda de cocção antes do forno.', false, null, '1,600 Kg', 'Assadeira'::public.unit_code, 'Un'::public.unit_code, 1.6, 'Caixa'::public.unit_code, 8, false),
  ('product-lasanha', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-44811', 'Lasanha Bolonhesa', 'Travessa de lasanha para rotisseria.', (select id from public.subcategories where legacy_id = 'line-rotisseria'), (select id from public.subcategories where legacy_id = 'line-rotisseria'), true, true, 5, 140, 210, true, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"sales":{"unit":"Travessa","description":"Travessa de venda","weightKg":3.8},"production":{"unit":"Travessa","description":"Travessa de produção","weightKg":3.8},"expedition":{"unit":"Caixa","description":"Caixa de transporte","weightKg":7.6}}'::jsonb, '{"unit":"Caixa","description":"Caixa com 2 travessas","weightKg":7.6,"quantityPerPackage":2}'::jsonb, false, 'Montar em camadas, assar e resfriar antes da expedição.', 2.5, 'depois_divisao'::public.break_stage, 'Quebra após assar e resfriar.', false, null, '3,800 Kg', 'Travessa'::public.unit_code, 'Travessa'::public.unit_code, 3.8, 'Caixa'::public.unit_code, 7.6, false),
  ('product-coxinha', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-33991', 'Coxinha', 'Salgado unitário de vitrine.', (select id from public.subcategories where legacy_id = 'line-salgados'), (select id from public.subcategories where legacy_id = 'line-salgados'), true, true, 2, 110, 145, false, array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']::public.weekday_code[], '{"sales":{"unit":"Un","description":"Unidade de venda","weightKg":0.11},"production":{"unit":"Bandeja","description":"Bandeja de fritura","weightKg":2.2},"expedition":{"unit":"Caixa","description":"Caixa de expedição","weightKg":2.2}}'::jsonb, '{"unit":"Caixa","description":"Caixa com 20 unidades","weightKg":2.2,"quantityPerPackage":20}'::jsonb, false, 'Modelar, empanar e fritar.', 3, 'depois_divisao'::public.break_stage, 'Ajuste por empanamento e fritura.', false, null, '0,110 Kg', 'Bandeja'::public.unit_code, 'Un'::public.unit_code, 0.11, 'Caixa'::public.unit_code, 2.2, false),
  ('product-empada-frango', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PR-33992', 'Empada de Frango', 'Empada unitária de balcão.', (select id from public.subcategories where legacy_id = 'line-salgados'), (select id from public.subcategories where legacy_id = 'line-salgados'), true, true, 3, 95, 130, false, array['segunda', 'terca', 'quarta', 'quinta', 'sexta']::public.weekday_code[], '{"sales":{"unit":"Un","description":"Unidade de venda","weightKg":0.13},"production":{"unit":"Bandeja","description":"Bandeja de forno","weightKg":2.6},"expedition":{"unit":"Caixa","description":"Caixa padrão","weightKg":2.6}}'::jsonb, '{"unit":"Caixa","description":"Caixa com 20 unidades","weightKg":2.6,"quantityPerPackage":20}'::jsonb, false, 'Forrar, rechear e assar.', 2.8, 'depois_divisao'::public.break_stage, 'Pequenas perdas na saída do forno.', false, null, '0,130 Kg', 'Bandeja'::public.unit_code, 'Un'::public.unit_code, 0.13, 'Caixa'::public.unit_code, 2.6, false);

insert into public.ingredient_components (tenant_id, ingredient_id, ingredient_reference_id, product_reference_id, name, quantity, unit, observation, sort_order) values
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.ingredients where legacy_id = 'ing-mistura-neutra'), (select id from public.ingredients where legacy_id = 'ing-farinha'), null, 'Farinha de Trigo', 0.68, 'Kg'::public.unit_code, '', 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.ingredients where legacy_id = 'ing-mistura-neutra'), (select id from public.ingredients where legacy_id = 'ing-acucar'), null, 'Açúcar', 0.18, 'Kg'::public.unit_code, '', 1),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.ingredients where legacy_id = 'ing-mistura-neutra'), (select id from public.ingredients where legacy_id = 'ing-fermento'), null, 'Fermento', 0.14, 'Kg'::public.unit_code, '', 2);

insert into public.product_recipe_items (tenant_id, product_id, source_type, ingredient_source_id, product_source_id, label, quantity, unit, sort_order) values
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pao-frances'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-farinha'), null, 'Farinha de Trigo', 0.88, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pao-frances'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-fermento'), null, 'Fermento', 0.03, 'Kg'::public.unit_code, 1),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pao-forma'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-farinha'), null, 'Farinha de Trigo', 0.82, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pao-forma'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-acucar'), null, 'Açúcar', 0.05, 'Kg'::public.unit_code, 1),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pao-doce'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-farinha'), null, 'Farinha de Trigo', 0.78, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pao-doce'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-acucar'), null, 'Açúcar', 0.11, 'Kg'::public.unit_code, 1),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pao-doce'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-fermento'), null, 'Fermento', 0.025, 'Kg'::public.unit_code, 2),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-mpi-base-pudim'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-leite-condensado'), null, 'Leite Condensado', 5.651, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-mpi-base-pudim'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-leite'), null, 'Leite Tipo C', 2.129, 'L'::public.unit_code, 1),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-mpi-base-pudim'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-ovo'), null, 'Ovo Pasteurizado', 0.398, 'Kg'::public.unit_code, 2),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pudim-mini'), 'produto'::public.recipe_source_type, null, (select id from public.products where legacy_id = 'product-mpi-base-pudim'), 'MPI Base para Pudim', 4.218, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pudim-mini'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-calda-pudim'), null, 'Calda para Pudim', 0.398, 'Kg'::public.unit_code, 1),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pudim-medio'), 'produto'::public.recipe_source_type, null, (select id from public.products where legacy_id = 'product-mpi-base-pudim'), 'MPI Base para Pudim', 8.697, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pudim-medio'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-calda-pudim'), null, 'Calda para Pudim', 0.571, 'Kg'::public.unit_code, 1),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pudim-grande'), 'produto'::public.recipe_source_type, null, (select id from public.products where legacy_id = 'product-mpi-base-pudim'), 'MPI Base para Pudim', 2.13, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-pudim-grande'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-calda-pudim'), null, 'Calda para Pudim', 0.089, 'Kg'::public.unit_code, 1),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-brownie'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-mistura-neutra'), null, 'Mistura Neutra de Bolo', 0.82, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-brownie'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-ovo'), null, 'Ovo Pasteurizado', 0.18, 'Kg'::public.unit_code, 1),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-frango-assado'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-acucar'), null, 'Tempero Base', 0.04, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-lasanha'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-mistura-neutra'), null, 'Base Molho', 0.72, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-coxinha'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-farinha'), null, 'Farinha de Trigo', 0.4, 'Kg'::public.unit_code, 0),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.products where legacy_id = 'product-empada-frango'), 'ingrediente'::public.recipe_source_type, (select id from public.ingredients where legacy_id = 'ing-farinha'), null, 'Farinha de Trigo', 0.46, 'Kg'::public.unit_code, 0);

insert into public.schedule_lines (legacy_id, tenant_id, code, name, subcategory_id, revision_of_id, status, created_at, created_by_profile_id, audited_at, audited_by_profile_id, audit_notes, deactivated_at, deactivated_by_profile_id) values
  ('schedule-paes', (select id from public.tenants where legacy_id = 'tenant-seed'), 'SL-8401', 'Linha Pães Tradicionais', (select id from public.subcategories where legacy_id = 'line-paes'), null, 'ativo'::public.schedule_status, '2026-02-10', null, '2026-02-11', null, 'Linha liberada para execução contínua.', null, null),
  ('schedule-confeitaria', (select id from public.tenants where legacy_id = 'tenant-seed'), 'SL-8402', 'Linha Confeitaria Base', (select id from public.subcategories where legacy_id = 'line-confeitaria'), null, 'ativo'::public.schedule_status, '2026-02-12', null, '2026-02-13', null, 'Linha validada com foco em pudins e confeitaria fina.', null, null),
  ('schedule-rotisseria', (select id from public.tenants where legacy_id = 'tenant-seed'), 'SL-8403', 'Linha Rotisseria Quentes', (select id from public.subcategories where legacy_id = 'line-rotisseria'), null, 'ativo'::public.schedule_status, '2026-02-14', null, '2026-02-15', null, 'Linha preparada para assados e travessas.', null, null),
  ('schedule-salgados', (select id from public.tenants where legacy_id = 'tenant-seed'), 'SL-8404', 'Linha Salgados Forno e Frito', (select id from public.subcategories where legacy_id = 'line-salgados'), null, 'ativo'::public.schedule_status, '2026-02-14', null, '2026-02-15', null, 'Linha ativa para abastecimento diário de salgado.', null, null);

insert into public.schedule_line_item_snapshots (tenant_id, schedule_line_id, product_id, minimum_production, production_days, day_priorities) values
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-paes'), (select id from public.products where legacy_id = 'product-pao-frances'), 220, array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']::public.weekday_code[], '{"segunda":1,"terca":1,"quarta":1,"quinta":1,"sexta":1,"sabado":1}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-paes'), (select id from public.products where legacy_id = 'product-pao-forma'), 150, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"segunda":2,"quarta":2,"sexta":2}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-paes'), (select id from public.products where legacy_id = 'product-pao-doce'), 120, array['terca', 'quinta', 'sabado']::public.weekday_code[], '{"terca":2,"quinta":2,"sabado":2}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-confeitaria'), (select id from public.products where legacy_id = 'product-mpi-base-pudim'), 8, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"segunda":1,"quarta":1,"sexta":1}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-confeitaria'), (select id from public.products where legacy_id = 'product-pudim-mini'), 12, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"segunda":2,"quarta":2,"sexta":2}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-confeitaria'), (select id from public.products where legacy_id = 'product-pudim-medio'), 10, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"segunda":3,"quarta":3,"sexta":3}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-confeitaria'), (select id from public.products where legacy_id = 'product-pudim-grande'), 8, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"segunda":4,"quarta":4,"sexta":4}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-confeitaria'), (select id from public.products where legacy_id = 'product-brownie'), 70, array['terca', 'quinta', 'sabado']::public.weekday_code[], '{"terca":1,"quinta":1,"sabado":1}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-rotisseria'), (select id from public.products where legacy_id = 'product-frango-assado'), 180, array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']::public.weekday_code[], '{"segunda":1,"terca":1,"quarta":1,"quinta":1,"sexta":1,"sabado":1}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-rotisseria'), (select id from public.products where legacy_id = 'product-lasanha'), 140, array['segunda', 'quarta', 'sexta']::public.weekday_code[], '{"segunda":2,"quarta":2,"sexta":2}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-salgados'), (select id from public.products where legacy_id = 'product-coxinha'), 110, array['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']::public.weekday_code[], '{"segunda":1,"terca":1,"quarta":1,"quinta":1,"sexta":1,"sabado":1}'::jsonb),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.schedule_lines where legacy_id = 'schedule-salgados'), (select id from public.products where legacy_id = 'product-empada-frango'), 95, array['segunda', 'terca', 'quarta', 'quinta', 'sexta']::public.weekday_code[], '{"segunda":2,"terca":2,"quarta":2,"quinta":2,"sexta":2}'::jsonb);

insert into public.permission_modules (module_key, label, route, group_key) values
  ('administrador-master.dashboard', 'Painel SaaS', '/administrador-master', 'administrador-master'::public.permission_group),
  ('administrador-master.clientes', 'Clientes', '/administrador-master/clientes', 'administrador-master'::public.permission_group),
  ('administrador.dashboard', 'Dashboard Executivo', '/administrador', 'administrador'::public.permission_group),
  ('administrador.usuarios', 'Usuários e Permissões', '/administrador/usuarios', 'administrador'::public.permission_group),
  ('administrador.ocorrencias', 'Canal com o Sistema', '/administrador/ocorrencias', 'administrador'::public.permission_group),
  ('gestor-dados.dashboard', 'Visão Geral', '/gestor-dados', 'gestor-dados'::public.permission_group),
  ('gestor-dados.ingredientes', 'Ingredientes', '/gestor-dados/ingredientes', 'gestor-dados'::public.permission_group),
  ('gestor-dados.produtos', 'Produtos', '/gestor-dados/produtos', 'gestor-dados'::public.permission_group),
  ('gestor-dados.setores', 'Categorias', '/gestor-dados/setores', 'gestor-dados'::public.permission_group),
  ('gestor-dados.linhas', 'Linhas de produção', '/gestor-dados/linhas-producao', 'gestor-dados'::public.permission_group),
  ('gestor-dados.lojas', 'Lojas', '/gestor-dados/lojas', 'gestor-dados'::public.permission_group),
  ('gestor-fabrica.dashboard', 'Visão Geral', '/gestor-fabrica', 'gestor-fabrica'::public.permission_group),
  ('gestor-fabrica.sublinhas', 'Auditoria do cronograma ativo', '/gestor-fabrica/sublinhas-producao', 'gestor-fabrica'::public.permission_group),
  ('gestor-fabrica.pedidos', 'Pedidos', '/gestor-fabrica/pedidos', 'gestor-fabrica'::public.permission_group),
  ('gestor-fabrica.ops', 'Ordens de Produção', '/gestor-fabrica/ordens-producao', 'gestor-fabrica'::public.permission_group),
  ('gestor-fabrica.expedicao', 'Expedição', '/gestor-fabrica/expedicao', 'gestor-fabrica'::public.permission_group),
  ('gestor-fabrica.ocorrencias', 'Ocorrências', '/gestor-fabrica/ocorrencias', 'gestor-fabrica'::public.permission_group),
  ('chao-fabrica.dashboard', 'Visão Geral', '/chao-fabrica', 'chao-fabrica'::public.permission_group),
  ('chao-fabrica.ops', 'Ordens de Produção', '/chao-fabrica/ordens-producao', 'chao-fabrica'::public.permission_group),
  ('chao-fabrica.expedicao', 'Expedição', '/chao-fabrica/expedicao', 'chao-fabrica'::public.permission_group),
  ('chao-fabrica.entregas', 'Entregas', '/chao-fabrica/entregas', 'chao-fabrica'::public.permission_group),
  ('loja.dashboard', 'Visão Geral', '/loja', 'loja'::public.permission_group),
  ('loja.pedidos', 'Meus Pedidos', '/loja/pedidos', 'loja'::public.permission_group),
  ('loja.ocorrencias', 'Ocorrências', '/loja/ocorrencias', 'loja'::public.permission_group);

insert into public.profiles (legacy_id, tenant_id, role, status, name, email, phone, zip_code, street, number, complement, neighborhood, city, state, country, avatar_path, password_updated_at, created_at, updated_at) values
  ('user-master', null, 'administrador-master'::public.user_role, 'ativo'::public.record_status, 'Administrador Master', 'master@danielaugusto.com', '(85) 98888-0999', '60160-230', 'Av. Santos Dumont', '2200', 'Sala 900', 'Aldeota', 'Fortaleza', 'CE', 'Brasil', null, '2026-02-19T08:00:00Z', '2026-02-19T08:00:00Z', '2026-02-19T10:00:00Z'),
  ('user-admin', (select id from public.tenants where legacy_id = 'tenant-seed'), 'administrador'::public.user_role, 'ativo'::public.record_status, 'Administrador Geral', 'admin@danielaugusto.com', '(85) 98888-1000', '60000-001', 'Av. Dom Luis', '1000', 'Sala 201', 'Aldeota', 'Fortaleza', 'CE', 'Brasil', null, '2026-02-19T08:00:00Z', '2026-02-19T08:00:00Z', '2026-02-19T10:00:00Z'),
  ('user-dados', (select id from public.tenants where legacy_id = 'tenant-seed'), 'gestor-dados'::public.user_role, 'ativo'::public.record_status, 'Fernanda Engenharia', 'engenharia@danielaugusto.com', '(85) 98888-1001', '60115-080', 'Rua Joaquim Nabuco', '340', 'Bloco B', 'Meireles', 'Fortaleza', 'CE', 'Brasil', null, '2026-02-19T08:00:00Z', '2026-02-19T08:00:00Z', '2026-02-19T10:00:00Z'),
  ('user-fabrica', (select id from public.tenants where legacy_id = 'tenant-seed'), 'gestor-fabrica'::public.user_role, 'ativo'::public.record_status, 'Marcos Fabrica', 'fabrica@danielaugusto.com', '(85) 98888-1002', '60833-120', 'Rua das Oficinas', '82', null, 'Distrito Industrial', 'Fortaleza', 'CE', 'Brasil', null, '2026-02-19T08:00:00Z', '2026-02-19T08:00:00Z', '2026-02-19T10:00:00Z'),
  ('user-chao', (select id from public.tenants where legacy_id = 'tenant-seed'), 'chao-fabrica'::public.user_role, 'ativo'::public.record_status, 'Equipe Chao', 'chao@danielaugusto.com', '(85) 98888-1003', '60833-120', 'Rua das Oficinas', '120', 'Galpao 3', 'Distrito Industrial', 'Fortaleza', 'CE', 'Brasil', null, '2026-02-19T08:00:00Z', '2026-02-19T08:00:00Z', '2026-02-19T10:00:00Z'),
  ('user-loja', (select id from public.tenants where legacy_id = 'tenant-seed'), 'loja'::public.user_role, 'ativo'::public.record_status, 'Rommel Filho', 'loja@danielaugusto.com', null, null, null, null, null, null, null, null, 'Brasil', null, '2026-02-19T08:00:00Z', '2026-02-19T08:00:00Z', '2026-02-19T10:00:00Z');

update public.stores
set responsible_profile_id = (select id from public.profiles where legacy_id = 'user-loja')
where tenant_id = (select id from public.tenants where legacy_id = 'tenant-seed');

update public.schedule_lines
set created_by_profile_id = (select id from public.profiles where legacy_id = 'user-dados'),
    audited_by_profile_id = case
      when status = 'ativo'::public.schedule_status then (select id from public.profiles where legacy_id = 'user-fabrica')
      else null
    end,
    audit_notes = case
      when status = 'ativo'::public.schedule_status and (audit_notes is null or audit_notes = '') then 'Cronograma homologado para a semana operacional de 09/03.'
      else audit_notes
    end;

insert into public.user_permissions (tenant_id, profile_id, module_key, access_level) values
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'administrador-master.dashboard', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'administrador-master.clientes', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'administrador.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'administrador.usuarios', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'administrador.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-dados.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-dados.ingredientes', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-dados.produtos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-dados.setores', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-dados.linhas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-dados.lojas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-fabrica.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-fabrica.sublinhas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-fabrica.pedidos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-fabrica.ops', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-fabrica.expedicao', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'gestor-fabrica.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'chao-fabrica.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'chao-fabrica.ops', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'chao-fabrica.expedicao', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'chao-fabrica.entregas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'loja.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'loja.pedidos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-master'), (select id from public.profiles where legacy_id = 'user-master'), 'loja.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'administrador-master.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'administrador-master.clientes', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'administrador.dashboard', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'administrador.usuarios', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'administrador.ocorrencias', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-dados.dashboard', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-dados.ingredientes', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-dados.produtos', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-dados.setores', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-dados.linhas', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-dados.lojas', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-fabrica.dashboard', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-fabrica.sublinhas', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-fabrica.pedidos', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-fabrica.ops', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-fabrica.expedicao', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'gestor-fabrica.ocorrencias', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'chao-fabrica.dashboard', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'chao-fabrica.ops', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'chao-fabrica.expedicao', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'chao-fabrica.entregas', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'loja.dashboard', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'loja.pedidos', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-admin'), (select id from public.profiles where legacy_id = 'user-admin'), 'loja.ocorrencias', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'administrador-master.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'administrador-master.clientes', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'administrador.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'administrador.usuarios', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'administrador.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-dados.dashboard', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-dados.ingredientes', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-dados.produtos', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-dados.setores', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-dados.linhas', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-dados.lojas', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-fabrica.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-fabrica.sublinhas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-fabrica.pedidos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-fabrica.ops', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-fabrica.expedicao', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'gestor-fabrica.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'chao-fabrica.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'chao-fabrica.ops', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'chao-fabrica.expedicao', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'chao-fabrica.entregas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'loja.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'loja.pedidos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-dados'), (select id from public.profiles where legacy_id = 'user-dados'), 'loja.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'administrador-master.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'administrador-master.clientes', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'administrador.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'administrador.usuarios', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'administrador.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-dados.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-dados.ingredientes', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-dados.produtos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-dados.setores', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-dados.linhas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-dados.lojas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-fabrica.dashboard', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-fabrica.sublinhas', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-fabrica.pedidos', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-fabrica.ops', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-fabrica.expedicao', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'gestor-fabrica.ocorrencias', 'gerenciar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'chao-fabrica.dashboard', 'visualizar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'chao-fabrica.ops', 'visualizar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'chao-fabrica.expedicao', 'visualizar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'chao-fabrica.entregas', 'visualizar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'loja.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'loja.pedidos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-fabrica'), (select id from public.profiles where legacy_id = 'user-fabrica'), 'loja.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'administrador-master.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'administrador-master.clientes', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'administrador.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'administrador.usuarios', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'administrador.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-dados.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-dados.ingredientes', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-dados.produtos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-dados.setores', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-dados.linhas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-dados.lojas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-fabrica.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-fabrica.sublinhas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-fabrica.pedidos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-fabrica.ops', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-fabrica.expedicao', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'gestor-fabrica.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'chao-fabrica.dashboard', 'operar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'chao-fabrica.ops', 'operar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'chao-fabrica.expedicao', 'operar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'chao-fabrica.entregas', 'operar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'loja.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'loja.pedidos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-chao'), (select id from public.profiles where legacy_id = 'user-chao'), 'loja.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'administrador-master.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'administrador-master.clientes', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'administrador.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'administrador.usuarios', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'administrador.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-dados.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-dados.ingredientes', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-dados.produtos', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-dados.setores', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-dados.linhas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-dados.lojas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-fabrica.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-fabrica.sublinhas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-fabrica.pedidos', 'visualizar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-fabrica.ops', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-fabrica.expedicao', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'gestor-fabrica.ocorrencias', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'chao-fabrica.dashboard', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'chao-fabrica.ops', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'chao-fabrica.expedicao', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'chao-fabrica.entregas', 'sem_acesso'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'loja.dashboard', 'operar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'loja.pedidos', 'operar'::public.permission_level),
  ((select tenant_id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-loja'), 'loja.ocorrencias', 'operar'::public.permission_level);

insert into public.profile_store_access (tenant_id, profile_id, store_id) values
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.profiles where legacy_id = 'user-loja'), (select id from public.stores where legacy_id = 'store-01')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.profiles where legacy_id = 'user-loja'), (select id from public.stores where legacy_id = 'store-02')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.profiles where legacy_id = 'user-loja'), (select id from public.stores where legacy_id = 'store-03'));

insert into public.store_orders (legacy_id, tenant_id, code, store_id, created_by_profile_id, ordered_at, base_date, delivery_date, receive_window_snapshot, expedition_lead_days_snapshot, note) values
  ('seed-order-001', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0001', (select id from public.stores where legacy_id = 'store-01'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-07T16:42:00Z', '2026-03-07', '2026-03-09', '07:00 - 10:00', 2, 'Pedido fictício PD-260309-0001 para validação integrada do fluxo.'),
  ('seed-order-002', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0002', (select id from public.stores where legacy_id = 'store-02'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-08T13:20:00Z', '2026-03-08', '2026-03-10', '08:00 - 11:00', 2, 'Pedido fictício PD-260309-0002 para validação integrada do fluxo.'),
  ('seed-order-003', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0003', (select id from public.stores where legacy_id = 'store-03'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-09T10:15:00Z', '2026-03-09', '2026-03-11', '06:30 - 09:00', 2, 'Pedido fictício PD-260309-0003 para validação integrada do fluxo.'),
  ('seed-order-004', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0004', (select id from public.stores where legacy_id = 'store-01'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-08T18:25:00Z', '2026-03-08', '2026-03-10', '07:00 - 10:00', 2, 'Pedido fictício PD-260309-0004 para validação integrada do fluxo.'),
  ('seed-order-005', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0005', (select id from public.stores where legacy_id = 'store-02'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-08T17:55:00Z', '2026-03-08', '2026-03-10', '08:00 - 11:00', 2, 'Pedido fictício PD-260309-0005 para validação integrada do fluxo.'),
  ('seed-order-006', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0006', (select id from public.stores where legacy_id = 'store-03'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-06T14:10:00Z', '2026-03-06', '2026-03-09', '06:30 - 09:00', 2, 'Pedido fictício PD-260309-0006 para validação integrada do fluxo.'),
  ('seed-order-007', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0007', (select id from public.stores where legacy_id = 'store-02'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-07T09:30:00Z', '2026-03-07', '2026-03-09', '08:00 - 11:00', 2, 'Pedido fictício PD-260309-0007 para validação integrada do fluxo.'),
  ('seed-order-008', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0008', (select id from public.stores where legacy_id = 'store-01'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-09T08:45:00Z', '2026-03-09', '2026-03-11', '07:00 - 10:00', 2, 'Pedido fictício PD-260309-0008 para validação integrada do fluxo.'),
  ('seed-order-009', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0009', (select id from public.stores where legacy_id = 'store-03'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-09T17:05:00Z', '2026-03-09', '2026-03-11', '06:30 - 09:00', 2, 'Pedido fictício PD-260309-0009 para validação integrada do fluxo.'),
  ('seed-order-010', (select id from public.tenants where legacy_id = 'tenant-seed'), 'PD-260309-0010', (select id from public.stores where legacy_id = 'store-02'), (select id from public.profiles where legacy_id = 'user-loja'), '2026-03-09T11:40:00Z', '2026-03-09', '2026-03-11', '08:00 - 11:00', 2, 'Pedido fictício PD-260309-0010 para validação integrada do fluxo.');

insert into public.store_order_items (legacy_id, tenant_id, order_id, product_id, product_code_snapshot, product_name_snapshot, requested_quantity, requested_unit, sales_to_kg_factor_snapshot, internal_kg_snapshot, expedition_unit_snapshot, expedition_to_kg_factor_snapshot, operational_unit_snapshot) values
  ('seed-order-001-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-001'), (select id from public.products where legacy_id = 'product-pao-frances'), 'PR-83374', 'Pão Francês', 220, 'Un'::public.unit_code, 0.05, 11, 'Pacote'::public.unit_code, 0.5, 'Kg'::public.unit_code),
  ('seed-order-001-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-001'), (select id from public.products where legacy_id = 'product-pudim-mini'), 'PR-02197', 'Pudim Leite Condensado Mini', 43, 'Un'::public.unit_code, 0.098, 4.214, 'Caixa'::public.unit_code, 4.218, 'Forma'::public.unit_code),
  ('seed-order-001-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-001'), (select id from public.products where legacy_id = 'product-coxinha'), 'PR-33991', 'Coxinha', 60, 'Un'::public.unit_code, 0.11, 6.6, 'Caixa'::public.unit_code, 2.2, 'Bandeja'::public.unit_code),
  ('seed-order-002-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-002'), (select id from public.products where legacy_id = 'product-pao-forma'), 'PR-83375', 'Pão de Forma', 12, 'Un'::public.unit_code, 0.45, 5.4, 'Caixa'::public.unit_code, 5.4, 'Forma'::public.unit_code),
  ('seed-order-002-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-002'), (select id from public.products where legacy_id = 'product-brownie'), 'PR-74090', 'Brownie Tradicional', 6, 'Kg'::public.unit_code, 1, 6, 'Caixa'::public.unit_code, 2.4, 'Assadeira'::public.unit_code),
  ('seed-order-002-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-002'), (select id from public.products where legacy_id = 'product-lasanha'), 'PR-44811', 'Lasanha Bolonhesa', 4, 'Travessa'::public.unit_code, 3.8, 15.2, 'Caixa'::public.unit_code, 7.6, 'Travessa'::public.unit_code),
  ('seed-order-003-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-003'), (select id from public.products where legacy_id = 'product-pudim-medio'), 'PR-02205', 'Pudim Leite Condensado Médio', 14, 'Un'::public.unit_code, 0.311, 4.354, 'Caixa'::public.unit_code, 8.698, 'Forma'::public.unit_code),
  ('seed-order-003-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-003'), (select id from public.products where legacy_id = 'product-frango-assado'), 'PR-44810', 'Frango Assado', 10, 'Un'::public.unit_code, 1.6, 16, 'Caixa'::public.unit_code, 8, 'Assadeira'::public.unit_code),
  ('seed-order-003-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-003'), (select id from public.products where legacy_id = 'product-pao-doce'), 'PR-83376', 'Pão Doce', 48, 'Un'::public.unit_code, 0.08, 3.84, 'Bandeja'::public.unit_code, 0.96, 'Assadeira'::public.unit_code),
  ('seed-order-004-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-004'), (select id from public.products where legacy_id = 'product-pudim-grande'), 'PR-00378', 'Pudim Leite Condensado Grande', 6, 'Un'::public.unit_code, 1.065, 6.39, 'Caixa'::public.unit_code, 2.13, 'Forma'::public.unit_code),
  ('seed-order-004-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-004'), (select id from public.products where legacy_id = 'product-empada-frango'), 'PR-33992', 'Empada de Frango', 72, 'Un'::public.unit_code, 0.13, 9.36, 'Caixa'::public.unit_code, 2.6, 'Bandeja'::public.unit_code),
  ('seed-order-004-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-004'), (select id from public.products where legacy_id = 'product-brownie'), 'PR-74090', 'Brownie Tradicional', 3, 'Kg'::public.unit_code, 1, 3, 'Caixa'::public.unit_code, 2.4, 'Assadeira'::public.unit_code),
  ('seed-order-005-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-005'), (select id from public.products where legacy_id = 'product-pao-frances'), 'PR-83374', 'Pão Francês', 300, 'Un'::public.unit_code, 0.05, 15, 'Pacote'::public.unit_code, 0.5, 'Kg'::public.unit_code),
  ('seed-order-005-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-005'), (select id from public.products where legacy_id = 'product-frango-assado'), 'PR-44810', 'Frango Assado', 8, 'Un'::public.unit_code, 1.6, 12.8, 'Caixa'::public.unit_code, 8, 'Assadeira'::public.unit_code),
  ('seed-order-005-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-005'), (select id from public.products where legacy_id = 'product-empada-frango'), 'PR-33992', 'Empada de Frango', 90, 'Un'::public.unit_code, 0.13, 11.7, 'Caixa'::public.unit_code, 2.6, 'Bandeja'::public.unit_code),
  ('seed-order-006-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-006'), (select id from public.products where legacy_id = 'product-lasanha'), 'PR-44811', 'Lasanha Bolonhesa', 3, 'Travessa'::public.unit_code, 3.8, 11.4, 'Caixa'::public.unit_code, 7.6, 'Travessa'::public.unit_code),
  ('seed-order-006-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-006'), (select id from public.products where legacy_id = 'product-pao-forma'), 'PR-83375', 'Pão de Forma', 10, 'Un'::public.unit_code, 0.45, 4.5, 'Caixa'::public.unit_code, 5.4, 'Forma'::public.unit_code),
  ('seed-order-006-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-006'), (select id from public.products where legacy_id = 'product-coxinha'), 'PR-33991', 'Coxinha', 80, 'Un'::public.unit_code, 0.11, 8.8, 'Caixa'::public.unit_code, 2.2, 'Bandeja'::public.unit_code),
  ('seed-order-007-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-007'), (select id from public.products where legacy_id = 'product-pudim-mini'), 'PR-02197', 'Pudim Leite Condensado Mini', 86, 'Un'::public.unit_code, 0.098, 8.428, 'Caixa'::public.unit_code, 4.218, 'Forma'::public.unit_code),
  ('seed-order-007-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-007'), (select id from public.products where legacy_id = 'product-brownie'), 'PR-74090', 'Brownie Tradicional', 4, 'Kg'::public.unit_code, 1, 4, 'Caixa'::public.unit_code, 2.4, 'Assadeira'::public.unit_code),
  ('seed-order-007-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-007'), (select id from public.products where legacy_id = 'product-coxinha'), 'PR-33991', 'Coxinha', 100, 'Un'::public.unit_code, 0.11, 11, 'Caixa'::public.unit_code, 2.2, 'Bandeja'::public.unit_code),
  ('seed-order-008-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-008'), (select id from public.products where legacy_id = 'product-pao-doce'), 'PR-83376', 'Pão Doce', 84, 'Un'::public.unit_code, 0.08, 6.72, 'Bandeja'::public.unit_code, 0.96, 'Assadeira'::public.unit_code),
  ('seed-order-008-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-008'), (select id from public.products where legacy_id = 'product-pudim-medio'), 'PR-02205', 'Pudim Leite Condensado Médio', 20, 'Un'::public.unit_code, 0.311, 6.22, 'Caixa'::public.unit_code, 8.698, 'Forma'::public.unit_code),
  ('seed-order-008-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-008'), (select id from public.products where legacy_id = 'product-empada-frango'), 'PR-33992', 'Empada de Frango', 48, 'Un'::public.unit_code, 0.13, 6.24, 'Caixa'::public.unit_code, 2.6, 'Bandeja'::public.unit_code),
  ('seed-order-009-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-009'), (select id from public.products where legacy_id = 'product-pao-frances'), 'PR-83374', 'Pão Francês', 180, 'Un'::public.unit_code, 0.05, 9, 'Pacote'::public.unit_code, 0.5, 'Kg'::public.unit_code),
  ('seed-order-009-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-009'), (select id from public.products where legacy_id = 'product-pudim-grande'), 'PR-00378', 'Pudim Leite Condensado Grande', 4, 'Un'::public.unit_code, 1.065, 4.26, 'Caixa'::public.unit_code, 2.13, 'Forma'::public.unit_code),
  ('seed-order-009-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-009'), (select id from public.products where legacy_id = 'product-frango-assado'), 'PR-44810', 'Frango Assado', 6, 'Un'::public.unit_code, 1.6, 9.6, 'Caixa'::public.unit_code, 8, 'Assadeira'::public.unit_code),
  ('seed-order-010-item-1', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-010'), (select id from public.products where legacy_id = 'product-pao-forma'), 'PR-83375', 'Pão de Forma', 8, 'Un'::public.unit_code, 0.45, 3.6, 'Caixa'::public.unit_code, 5.4, 'Forma'::public.unit_code),
  ('seed-order-010-item-2', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-010'), (select id from public.products where legacy_id = 'product-pudim-mini'), 'PR-02197', 'Pudim Leite Condensado Mini', 20, 'Un'::public.unit_code, 0.098, 1.96, 'Caixa'::public.unit_code, 4.218, 'Forma'::public.unit_code),
  ('seed-order-010-item-3', (select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-010'), (select id from public.products where legacy_id = 'product-frango-assado'), 'PR-44810', 'Frango Assado', 5, 'Un'::public.unit_code, 1.6, 8, 'Caixa'::public.unit_code, 8, 'Assadeira'::public.unit_code);

insert into public.workflow_order_releases (tenant_id, order_id, released_at, released_by_profile_id) values
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-001'), '2026-03-09T08:20:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-002'), '2026-03-09T08:35:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-004'), '2026-03-10T06:50:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-005'), '2026-03-10T07:05:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-006'), '2026-03-08T06:40:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-007'), '2026-03-08T07:10:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-008'), '2026-03-10T08:10:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-010'), '2026-03-10T08:30:00Z', (select id from public.profiles where legacy_id = 'user-fabrica'));

insert into public.delivery_executions (tenant_id, order_id, status, updated_at, updated_by_profile_id) values
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-001'), 'pronto_coleta'::public.delivery_execution_status, '2026-03-09T12:15:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-002'), 'aguardando_expedicao'::public.delivery_execution_status, '2026-03-09T12:20:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-004'), 'em_rota'::public.delivery_execution_status, '2026-03-10T14:05:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-005'), 'no_destino'::public.delivery_execution_status, '2026-03-10T15:10:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-006'), 'entregue'::public.delivery_execution_status, '2026-03-08T17:25:00Z', (select id from public.profiles where legacy_id = 'user-fabrica')),
  ((select id from public.tenants where legacy_id = 'tenant-seed'), (select id from public.store_orders where legacy_id = 'seed-order-007'), 'tentativa_falha'::public.delivery_execution_status, '2026-03-08T18:40:00Z', (select id from public.profiles where legacy_id = 'user-fabrica'));

insert into public.store_occurrences (legacy_id, tenant_id, code, order_id, order_item_id, product_id, product_name_snapshot, problem_type, quantity_type, quantity, quantity_unit_snapshot, description, status, opened_by_profile_id, resolved_by_profile_id, resolved_at, created_at, updated_at) values
  ('seed-occ-001', (select id from public.tenants where legacy_id = 'tenant-seed'), 'OC-0001', (select id from public.store_orders where legacy_id = 'seed-order-001'), (select id from public.store_order_items where legacy_id = 'seed-order-001-item-1'), (select id from public.products where legacy_id = 'product-pao-frances'), 'Pão Francês', 'Quantidade incorreta', 'operacional'::public.occurrence_quantity_type, 12, 'Un', 'Volume recebido abaixo do solicitado na separação final da loja.', 'aberta'::public.occurrence_status, (select id from public.profiles where legacy_id = 'user-loja'), null, null, '2026-03-09T12:30:00Z', '2026-03-09T12:30:00Z'),
  ('seed-occ-002', (select id from public.tenants where legacy_id = 'tenant-seed'), 'OC-0002', (select id from public.store_orders where legacy_id = 'seed-order-004'), (select id from public.store_order_items where legacy_id = 'seed-order-004-item-3'), (select id from public.products where legacy_id = 'product-brownie'), 'Brownie Tradicional', 'Peso divergente', 'kg'::public.occurrence_quantity_type, 0.8, 'Kg', 'Parte do lote embalado apresentou peso abaixo do acordado no recebimento.', 'em_analise'::public.occurrence_status, (select id from public.profiles where legacy_id = 'user-loja'), null, null, '2026-03-10T15:20:00Z', '2026-03-10T15:20:00Z'),
  ('seed-occ-003', (select id from public.tenants where legacy_id = 'tenant-seed'), 'OC-0003', (select id from public.store_orders where legacy_id = 'seed-order-005'), (select id from public.store_order_items where legacy_id = 'seed-order-005-item-2'), (select id from public.products where legacy_id = 'product-frango-assado'), 'Frango Assado', 'Embalagem violada', 'operacional'::public.occurrence_quantity_type, 2, 'Un', 'Duas unidades chegaram com a tampa térmica desalinhada e precisaram ser devolvidas.', 'fechada'::public.occurrence_status, (select id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-fabrica'), '2026-03-10T18:00:00Z', '2026-03-10T16:10:00Z', '2026-03-10T18:00:00Z'),
  ('seed-occ-004', (select id from public.tenants where legacy_id = 'tenant-seed'), 'OC-0004', (select id from public.store_orders where legacy_id = 'seed-order-006'), (select id from public.store_order_items where legacy_id = 'seed-order-006-item-1'), (select id from public.products where legacy_id = 'product-lasanha'), 'Lasanha Bolonhesa', 'Quebra de rendimento', 'percentual'::public.occurrence_quantity_type, 50, '%', 'Metade das travessas apresentou perda visual após a exposição na ilha quente.', 'resolvida'::public.occurrence_status, (select id from public.profiles where legacy_id = 'user-loja'), (select id from public.profiles where legacy_id = 'user-fabrica'), '2026-03-08T19:00:00Z', '2026-03-08T18:10:00Z', '2026-03-08T19:00:00Z'),
  ('seed-occ-005', (select id from public.tenants where legacy_id = 'tenant-seed'), 'OC-0005', (select id from public.store_orders where legacy_id = 'seed-order-007'), (select id from public.store_order_items where legacy_id = 'seed-order-007-item-3'), (select id from public.products where legacy_id = 'product-coxinha'), 'Coxinha', 'Tentativa de entrega sem recebimento', 'operacional'::public.occurrence_quantity_type, 24, 'Un', 'A equipe da loja não estava na doca e parte do pedido retornou para a central.', 'aberta'::public.occurrence_status, (select id from public.profiles where legacy_id = 'user-loja'), null, null, '2026-03-08T18:50:00Z', '2026-03-08T18:50:00Z'),
  ('seed-occ-006', (select id from public.tenants where legacy_id = 'tenant-seed'), 'OC-0006', (select id from public.store_orders where legacy_id = 'seed-order-001'), (select id from public.store_order_items where legacy_id = 'seed-order-001-item-2'), (select id from public.products where legacy_id = 'product-pudim-mini'), 'Pudim Leite Condensado Mini', 'Falta de identificação', 'operacional'::public.occurrence_quantity_type, 5, 'Un', 'Cinco unidades saíram sem etiqueta de validade e foram segregadas na loja.', 'em_analise'::public.occurrence_status, (select id from public.profiles where legacy_id = 'user-loja'), null, null, '2026-03-09T12:50:00Z', '2026-03-09T12:50:00Z');

insert into storage.buckets (id, name, public) values ('profile-avatars', 'profile-avatars', false) on conflict (id) do nothing;

select public.rebuild_business_code_sequences();

commit;

