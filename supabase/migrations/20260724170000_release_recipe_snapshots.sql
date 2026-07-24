-- XPAN item #6 (parte 2): alterações de receita NÃO devem impactar OPs já liberadas.
--
-- O motor de planejamento expande a receita AO VIVO a cada render (recipe-expansion). Sem
-- congelar a receita na liberação, editar a receita mudava os itens/MPI de uma OP já
-- liberada/em produção. Esta tabela guarda a receita de cada produto da árvore do pedido
-- COMO ESTAVA no momento da liberação; o motor usa esse snapshot p/ pedidos liberados.
--
-- Chaves no espaço de id do motor (legacy_id ?? id): order_id = store_orders.legacy_id ?? id
-- (== PlannedOrderItem.orderId); product_id = products.legacy_id ?? id (== ProductionProduct.id).
-- Uma linha por (pedido × produto da árvore de receita). recipe = RecipeIngredientReference[].

create table if not exists public.workflow_release_recipe_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id text not null,
  product_id text not null,
  recipe jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Uma receita congelada por (tenant, pedido, produto). Re-liberar sobrescreve (onConflict).
create unique index if not exists uq_release_recipe_snapshots_scope
  on public.workflow_release_recipe_snapshots (tenant_id, order_id, product_id);

create index if not exists idx_release_recipe_snapshots_order
  on public.workflow_release_recipe_snapshots (tenant_id, order_id);

drop trigger if exists set_release_recipe_snapshots_updated_at
  on public.workflow_release_recipe_snapshots;
create trigger set_release_recipe_snapshots_updated_at
  before update on public.workflow_release_recipe_snapshots
  for each row execute function public.set_updated_at();

comment on table public.workflow_release_recipe_snapshots is
  'XPAN #6: receita congelada de cada produto da árvore do pedido no momento da liberação da OP — o motor a usa p/ pedidos liberados, para que edições de receita não impactem OPs já liberadas.';

alter table public.workflow_release_recipe_snapshots enable row level security;

-- Leitura: quem enxerga o planejamento (fábrica/chão/loja/admin) — o snapshot é aplicado
-- na expansão do motor, então precisa ser legível pelas mesmas personas.
drop policy if exists release_recipe_snapshots_select_scope
  on public.workflow_release_recipe_snapshots;
create policy release_recipe_snapshots_select_scope
on public.workflow_release_recipe_snapshots
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role,
    'loja'::public.user_role
  )
);

-- Escrita (congelar na liberação): fábrica/admin (mesma persona que libera OP).
drop policy if exists release_recipe_snapshots_manage_scope
  on public.workflow_release_recipe_snapshots;
create policy release_recipe_snapshots_manage_scope
on public.workflow_release_recipe_snapshots
for all
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role
  )
);
