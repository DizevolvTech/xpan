-- XPAN-Lote: a FÁBRICA abre um LOTE (janela) para as lojas CRIAREM pedidos, em vez de
-- pré-criar N pedidos vazios (status 'aberto') que poluíam a lista do gestor.
--
-- Um order_batch = os SLOTS elegíveis (loja × data de entrega) derivados do cronograma
-- no momento da abertura. A loja cria seu pedido real DENTRO do lote (createStoreOrder
-- gateado por cobertura). O pedido real referencia o lote via store_orders.batch_id.

create table if not exists public.order_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reference_date date not null,
  -- slots elegíveis: [{"storeId":"store-01","deliveryDate":"2026-07-27"}, ...] (storeId = legacy id).
  slots jsonb not null default '[]'::jsonb,
  opened_by_profile_id uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default timezone('utc', now()),
  status text not null default 'aberto',
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.order_batches drop constraint if exists order_batches_status_check;
alter table public.order_batches
  add constraint order_batches_status_check check (status in ('aberto', 'fechado'));

create index if not exists idx_order_batches_tenant_status
  on public.order_batches (tenant_id, status);

drop trigger if exists set_order_batches_updated_at on public.order_batches;
create trigger set_order_batches_updated_at
  before update on public.order_batches
  for each row execute function public.set_updated_at();

comment on table public.order_batches is
  'XPAN-Lote: janela aberta pela fábrica (slots loja×data derivados do cronograma) para as lojas criarem pedidos. Substitui a pré-criação de pedidos vazios.';

alter table public.order_batches enable row level security;

-- Leitura: fábrica/admin gerenciam; a LOJA precisa ver o lote aberto para criar pedido.
drop policy if exists order_batches_select_scope on public.order_batches;
create policy order_batches_select_scope
on public.order_batches
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

-- Escrita (abrir/fechar lote): só fábrica/admin.
drop policy if exists order_batches_manage_scope on public.order_batches;
create policy order_batches_manage_scope
on public.order_batches
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

-- Vínculo do pedido REAL ao lote em que a loja o criou (rastreabilidade + contagem X/Y).
alter table public.store_orders add column if not exists batch_id uuid;
create index if not exists idx_store_orders_batch on public.store_orders (batch_id);
comment on column public.store_orders.batch_id is
  'XPAN-Lote: lote (order_batches) em que a loja criou este pedido. null = pedido fora de lote.';
