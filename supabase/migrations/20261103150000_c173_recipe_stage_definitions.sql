-- Cartão #173 (Xpan, 03/11): etapas da ficha técnica cadastradas pela empresa.
-- As 7 etapas padrão continuam no código (os cálculos dependem delas). A empresa cadastra
-- etapas novas (ex.: "Embalagem"), cada uma seguindo uma etapa padrão nos cálculos: a chave
-- guarda essa etapa (`operacional__embalagem`). Linha com chave padrão só liga/desliga a
-- etapa padrão na lista de "Adicionar etapa".
create table if not exists public.recipe_stage_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  label text not null,
  base_stage text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, key),
  constraint recipe_stage_definitions_base_check
    check (base_stage = any (array['esponja', 'massa', 'recheio', 'cobertura', 'operacional', 'acabamento', 'montagem'])),
  constraint recipe_stage_definitions_key_check
    check (key ~ '^(esponja|massa|recheio|cobertura|operacional|acabamento|montagem)(__[a-z0-9][a-z0-9_]{0,47})?$'
      and split_part(key, '__', 1) = base_stage),
  constraint recipe_stage_definitions_label_check check (length(btrim(label)) between 1 and 60)
);

create index if not exists idx_recipe_stage_definitions_tenant_id
  on public.recipe_stage_definitions(tenant_id);

drop trigger if exists set_recipe_stage_definitions_updated_at on public.recipe_stage_definitions;
create trigger set_recipe_stage_definitions_updated_at
  before update on public.recipe_stage_definitions
  for each row execute function public.set_updated_at();

alter table public.recipe_stage_definitions enable row level security;

drop policy if exists recipe_stage_definitions_tenant_scope on public.recipe_stage_definitions;
create policy recipe_stage_definitions_tenant_scope
  on public.recipe_stage_definitions
  for all
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- A linha da receita passa a aceitar as etapas cadastradas.
alter table public.product_recipe_items
  drop constraint if exists product_recipe_items_stage_check;

alter table public.product_recipe_items
  add constraint product_recipe_items_stage_check
  check (stage ~ '^(esponja|massa|recheio|cobertura|operacional|acabamento|montagem)(__[a-z0-9][a-z0-9_]{0,47})?$');
