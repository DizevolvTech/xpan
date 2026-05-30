-- AJ-0009 Fase 4a (ADR_modelo_fabrica_abre_pedido, Opção B / modelo C híbrido):
-- "fábrica abre o pedido → loja só preenche".
--
-- Esta migração adiciona a base de dados SEM mudar comportamento por si só:
--   * store_orders.status: ciclo de vida do pedido (aberto → preenchido → enviado).
--     Default 'preenchido' para que TODO pedido legado (criado pela loja) já conte
--     como preenchido — migração trivial, sem backfill.
--   * store_orders.opened_by_profile_id: quem (fábrica) abriu o pedido, quando o
--     fluxo "fábrica abre" estiver ativo. Nulo no legado (loja criou).
--   * índice UNIQUE parcial (tenant_id, store_id, delivery_date) para pedidos ativos:
--     fecha a Dívida Técnica D03 / bônus AJ-0007 (duplicidade só era barrada em código).
--
-- A inversão de UX (loja deixa de criar) fica atrás da feature flag FACTORY_OPENS_ORDERS
-- (default OFF) na aplicação — esta migração é segura para produção por si só.

alter table public.store_orders
  add column if not exists status text not null default 'preenchido',
  add column if not exists opened_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists opened_at timestamptz;

alter table public.store_orders
  drop constraint if exists store_orders_status_check;

alter table public.store_orders
  add constraint store_orders_status_check
  check (status in ('aberto', 'preenchido', 'enviado'));

-- Duplicidade de pedido ativo por (tenant, loja, data de entrega) passa a ser barrada
-- no banco — antes só havia a checagem em createStoreOrder (store-orders.ts). Parcial
-- para não conflitar com pedidos cancelados (que podem repetir a data).
create unique index if not exists idx_store_orders_active_unique
  on public.store_orders (tenant_id, store_id, delivery_date)
  where management_status = 'ativo';

comment on column public.store_orders.status is
  'AJ-0009 Fase 4a: ciclo do pedido — aberto (fábrica abriu, loja ainda não preencheu) | preenchido (loja preencheu) | enviado. Legado = preenchido.';
comment on column public.store_orders.opened_by_profile_id is
  'AJ-0009 Fase 4a: perfil (fábrica) que abriu o pedido. Nulo quando a loja criou diretamente (legado / flag off).';
