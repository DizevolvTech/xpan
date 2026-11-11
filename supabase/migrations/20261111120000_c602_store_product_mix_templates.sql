-- Cartão #602 (Xpan, 11/11): mix de produtos por loja com MODELOS.
--
-- Cada loja vende um conjunto de produtos (o "mix"). Num lote aberto a loja vê só o seu mix.
-- O mix é configuração (não vem do histórico de pedidos) e pode mudar a qualquer momento:
--   - stores.product_mix_template_id preenchido  -> a loja usa o modelo (lista do modelo);
--   - senão stores.product_mix (lista manual)     -> só esses produtos;
--   - os dois vazios                               -> todos os produtos (padrão de toda loja).
-- Pedido já feito, importação por planilha e pedido centralizado da fábrica não são bloqueados.
--
-- Aditiva e idempotente: nenhuma loja muda de comportamento ao aplicar.
create table if not exists public.store_product_mix_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  product_ids jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint store_product_mix_templates_name_check check (length(btrim(name)) between 1 and 60),
  constraint store_product_mix_templates_products_check
    check (jsonb_typeof(product_ids) = 'array' and jsonb_array_length(product_ids) > 0)
);

create unique index if not exists uq_store_product_mix_templates_tenant_name
  on public.store_product_mix_templates (tenant_id, lower(btrim(name)));

drop trigger if exists set_store_product_mix_templates_updated_at on public.store_product_mix_templates;
create trigger set_store_product_mix_templates_updated_at
  before update on public.store_product_mix_templates
  for each row execute function public.set_updated_at();

alter table public.store_product_mix_templates enable row level security;

drop policy if exists store_product_mix_templates_select_scope on public.store_product_mix_templates;
create policy store_product_mix_templates_select_scope
  on public.store_product_mix_templates
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists store_product_mix_templates_manage_scope on public.store_product_mix_templates;
create policy store_product_mix_templates_manage_scope
  on public.store_product_mix_templates
  for all
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('administrador'::public.user_role, 'gestor-dados'::public.user_role)
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('administrador'::public.user_role, 'gestor-dados'::public.user_role)
  );

alter table public.stores
  add column if not exists product_mix_template_id uuid
    references public.store_product_mix_templates(id) on delete restrict;

create index if not exists idx_stores_product_mix_template_id
  on public.stores (product_mix_template_id)
  where product_mix_template_id is not null;

comment on table public.store_product_mix_templates is
  'Cartao #602: modelos de mix de produtos (lista de ids de produto) usados por varias lojas.';
comment on column public.stores.product_mix_template_id is
  'Cartao #602: modelo de mix da loja. Preenchido = a loja ve os produtos do modelo nos lotes.';
comment on column public.stores.product_mix is
  'Mix manual da loja: NULL = todos os produtos; lista de ids = so esses nos lotes (cartao #602). Ignorado quando ha modelo.';
