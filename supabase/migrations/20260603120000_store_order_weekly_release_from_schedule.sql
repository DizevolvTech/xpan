-- A10 (FEATURE A10): "a fábrica gera os pedidos da semana POR DIA a partir do cronograma".
-- Estende o modelo "fábrica abre o pedido → loja preenche" (migration 20260530120000):
-- agora a fábrica LIBERA um pedido `aberto` por dia que a loja recebe, no horizonte de
-- 7 dias, derivado da cobertura real do cronograma ativo (produto×linha×dia-de-produção
-- mapeado para a data de entrega da loja). A loja só seleciona e preenche.
--
-- Esta migração é ADITIVA e segura para produção por si só (não muda comportamento):
--   * store_orders.delivery_weekday: dia-da-semana (pt-BR) da data de entrega liberada.
--     Redundante com delivery_date, mas materializado para listagem/agrupamento por dia
--     sem recomputar no servidor. Nulo no legado.
--   * store_orders.release_origin: como o pedido nasceu — 'loja' (legado: a loja criou),
--     'fabrica_manual' (abertura manual de UMA data) ou 'cronograma' (liberação semanal
--     A10). Default 'loja' preserva 100% do legado.
--   * store_orders.source_schedule_ids: ids dos cronogramas (linhas) cuja cobertura
--     justificou abrir aquele pedido — rastreabilidade da auditoria. Nulo no legado.
--
-- NÃO cria tabela nova. NÃO faz backfill. A inversão de UX (loja deixa de criar) fica
-- atrás da feature flag FACTORY_OPENS_ORDERS na aplicação.

alter table public.store_orders
  add column if not exists delivery_weekday text,
  add column if not exists release_origin text not null default 'loja',
  add column if not exists source_schedule_ids text[];

alter table public.store_orders
  drop constraint if exists store_orders_delivery_weekday_check;

alter table public.store_orders
  add constraint store_orders_delivery_weekday_check
  check (
    delivery_weekday is null
    or delivery_weekday in ('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo')
  );

alter table public.store_orders
  drop constraint if exists store_orders_release_origin_check;

alter table public.store_orders
  add constraint store_orders_release_origin_check
  check (release_origin in ('loja', 'fabrica_manual', 'cronograma'));

comment on column public.store_orders.delivery_weekday is
  'A10: dia-da-semana (pt-BR: segunda..domingo) da data de entrega do pedido liberado pela fábrica a partir do cronograma. Nulo no legado / criação pela loja.';
comment on column public.store_orders.release_origin is
  'A10: origem do pedido — loja (loja criou; legado/default) | fabrica_manual (abertura manual de uma data) | cronograma (liberação semanal derivada do cronograma).';
comment on column public.store_orders.source_schedule_ids is
  'A10: ids dos cronogramas (linhas) cuja cobertura justificou a abertura deste pedido. Rastreabilidade da liberação semanal. Nulo no legado.';
