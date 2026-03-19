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
  ordering_blocked_days public.weekday_code[] not null default '{}'::public.weekday_code[],
  receiving_blocked_days public.weekday_code[] not null default '{}'::public.weekday_code[],
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
  external_code text,
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
  external_code text,
  name text not null,
  description text not null default '',
  subcategory_id uuid not null references public.subcategories(id) on delete restrict,
  operational_subcategory_id uuid references public.subcategories(id) on delete set null,
  active boolean not null default true,
  available_for_ordering boolean not null default true,
  validity_days integer not null default 0,
  minimum_production_kg numeric(12, 3) not null default 0,
  economic_production_kg numeric(12, 3) not null default 0,
  allows_storage boolean not null default false,
  production_days public.weekday_code[] not null default '{}'::public.weekday_code[],
  sale_lead_days integer not null default 0,
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
  management_status text not null default 'ativo' check (management_status in ('ativo', 'cancelado')),
  cancelled_at timestamptz,
  cancelled_by_profile_id uuid references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  reopened_by_profile_id uuid references public.profiles(id) on delete set null,
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
  checklist_state jsonb not null default '{}'::jsonb,
  checklist_completed_at timestamptz,
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

create table if not exists public.store_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_occurrence_events (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.store_occurrences(id) on delete cascade,
  event_type text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.business_code_sequences (
  prefix text not null,
  scope_key text not null default '',
  current_value bigint not null default 0 check (current_value >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (prefix, scope_key)
);

alter table public.business_code_sequences enable row level security;

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
  insert into public.business_code_sequences (prefix, scope_key, current_value)
  select
    source.prefix,
    source.scope_key,
    max(source.sequence_value) as current_value
  from (
    select
      split_part(code, '-', 1) as prefix,
      split_part(code, '-', 2) as scope_key,
      split_part(code, '-', 3)::bigint as sequence_value
    from public.store_orders
    where code ~ '^[A-Z]{2}-[0-9]{6}-[0-9]{4,}$'

    union all

    select
      split_part(code, '-', 1) as prefix,
      split_part(code, '-', 2) as scope_key,
      split_part(code, '-', 3)::bigint as sequence_value
    from public.store_occurrences
    where code ~ '^[A-Z]{2}-[0-9]{6}-[0-9]{4,}$'

    union all

    select
      split_part(code, '-', 1) as prefix,
      '' as scope_key,
      split_part(code, '-', 2)::bigint as sequence_value
    from public.store_orders
    where code ~ '^[A-Z]{2}-[0-9]{4,}$'

    union all

    select
      split_part(code, '-', 1) as prefix,
      '' as scope_key,
      split_part(code, '-', 2)::bigint as sequence_value
    from public.store_occurrences
    where code ~ '^[A-Z]{2}-[0-9]{4,}$'
  ) as source
  group by source.prefix, source.scope_key
  on conflict (prefix, scope_key) do update
  set
    current_value = greatest(public.business_code_sequences.current_value, excluded.current_value),
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.next_business_code_number(
  p_prefix text,
  p_scope_key text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_prefix text;
  normalized_scope_key text;
  next_value bigint;
begin
  normalized_prefix := upper(btrim(coalesce(p_prefix, '')));
  normalized_scope_key := btrim(coalesce(p_scope_key, ''));

  if normalized_prefix = '' then
    raise exception 'Business code prefix is required';
  end if;

  insert into public.business_code_sequences as sequences (prefix, scope_key, current_value)
  values (normalized_prefix, normalized_scope_key, 1)
  on conflict (prefix, scope_key) do update
  set
    current_value = sequences.current_value + 1,
    updated_at = timezone('utc', now())
  returning current_value into next_value;

  return next_value;
end;
$$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_user_permissions_profile on public.user_permissions(profile_id);
create index if not exists idx_profile_store_access_profile on public.profile_store_access(profile_id);
create index if not exists idx_subcategories_category on public.subcategories(category_id);
create index if not exists idx_schedule_lines_subcategory on public.schedule_lines(subcategory_id);
create index if not exists idx_products_subcategory on public.products(subcategory_id);
create index if not exists idx_products_operational_subcategory on public.products(operational_subcategory_id);
create index if not exists idx_store_orders_store_date on public.store_orders(store_id, delivery_date);
create index if not exists idx_store_order_items_order on public.store_order_items(order_id);
create index if not exists idx_workflow_production_items_status on public.workflow_production_items(status);
create index if not exists idx_store_occurrences_order on public.store_occurrences(order_id);
create index if not exists idx_store_order_events_order on public.store_order_events(order_id);
create index if not exists idx_store_occurrence_events_occurrence on public.store_occurrence_events(occurrence_id);
create unique index if not exists idx_ingredients_external_code_unique
on public.ingredients (lower(external_code))
where external_code is not null and btrim(external_code) <> '';
create unique index if not exists idx_products_external_code_unique
on public.products (lower(external_code))
where external_code is not null and btrim(external_code) <> '';

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
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.workflow_order_releases enable row level security;
alter table public.workflow_production_items enable row level security;
alter table public.delivery_executions enable row level security;
alter table public.store_occurrences enable row level security;
alter table public.store_order_events enable row level security;
alter table public.store_occurrence_events enable row level security;

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

drop policy if exists store_occurrences_update_by_scope on public.store_occurrences;
drop policy if exists store_occurrences_update_factory_or_admin on public.store_occurrences;
create policy store_occurrences_update_by_scope
on public.store_occurrences
for update
to authenticated
using (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'loja'::public.user_role
  )
)
with check (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_occurrences.order_id
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
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_events.order_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_order_events_insert_by_scope on public.store_order_events;
create policy store_order_events_insert_by_scope
on public.store_order_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_orders
    where store_orders.id = store_order_events.order_id
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
  exists (
    select 1
    from public.store_occurrences
    join public.store_orders on store_orders.id = store_occurrences.order_id
    where store_occurrences.id = store_occurrence_events.occurrence_id
      and public.can_access_store(store_orders.store_id)
  )
);

drop policy if exists store_occurrence_events_insert_by_scope on public.store_occurrence_events;
create policy store_occurrence_events_insert_by_scope
on public.store_occurrence_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.store_occurrences
    join public.store_orders on store_orders.id = store_occurrences.order_id
    where store_occurrences.id = store_occurrence_events.occurrence_id
      and public.can_access_store(store_orders.store_id)
  )
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'loja'::public.user_role
  )
);

-- ============================================================
-- Seed
-- Source: supabase/seed.sql
-- ============================================================
