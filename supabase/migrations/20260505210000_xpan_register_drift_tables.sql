-- MIGRATION RETROATIVA: alinha o repo com tabelas que foram aplicadas direto no banco.
-- Objetos cobertos:
--   1. Tabela `production_line_types` (catálogo de tipos de linhas, escopo tenant).
--   2. Tabela `product_changelog` (versionamento de alterações em produtos).
--   3. Coluna `subcategories.line_type_id` apontando para `production_line_types`.
--   4. Substitui RLS policies que usavam `current_setting('app.current_tenant_id')` (não populado no fluxo SaaS) por `public.current_tenant_id()` (helper canônico).
--   5. Cobertura de índice em todas as FKs novas.
-- Idempotente: pode ser re-aplicada sem efeito colateral.

-- =========================================================================
-- 1. production_line_types
-- =========================================================================

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

drop trigger if exists set_production_line_types_updated_at on public.production_line_types;
create trigger set_production_line_types_updated_at
  before update on public.production_line_types
  for each row execute function public.set_updated_at();

alter table public.production_line_types enable row level security;

drop policy if exists tenant_isolation_production_line_types on public.production_line_types;
create policy production_line_types_tenant_scope
  on public.production_line_types
  for all
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- =========================================================================
-- 2. subcategories.line_type_id
-- =========================================================================

alter table public.subcategories
  add column if not exists line_type_id uuid;

do $$ begin
  alter table public.subcategories
    add constraint subcategories_line_type_id_fkey
    foreign key (line_type_id) references public.production_line_types(id) on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists idx_subcategories_line_type_id
  on public.subcategories(line_type_id);

-- =========================================================================
-- 3. product_changelog
-- =========================================================================

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

create index if not exists idx_product_changelog_product
  on public.product_changelog(product_id);

create index if not exists idx_product_changelog_tenant_id
  on public.product_changelog(tenant_id);

create index if not exists idx_product_changelog_changed_by_profile_id
  on public.product_changelog(changed_by_profile_id);

alter table public.product_changelog enable row level security;

drop policy if exists tenant_isolation_product_changelog on public.product_changelog;
create policy product_changelog_tenant_scope
  on public.product_changelog
  for all
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
