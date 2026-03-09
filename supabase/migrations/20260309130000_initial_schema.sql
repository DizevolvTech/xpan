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
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code text not null unique,
  name text not null,
  responsible text not null,
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
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
