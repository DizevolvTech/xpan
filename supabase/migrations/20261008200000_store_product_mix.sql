-- Mix de produtos por loja (cliente, 07/10/2026).
--
-- Filtro de APRESENTAÇÃO: qual loja vê qual produto por padrão nos pedidos abertos do dia.
-- Não bloqueia pedido manual, encomenda fora do padrão nem importação por planilha.
--
--   NULL            = a loja recebe TODOS os produtos (padrão; toda loja existente fica como está).
--   ["id", "id"...] = só esses produtos por padrão (ids de produto, mesmo formato do snapshot).
--
-- Lista vazia é proibida (esconderia todo o catálogo da loja): use NULL.
-- Aditiva e idempotente. Nenhum cálculo, cronograma ou produção lê esta coluna.
alter table public.stores
  add column if not exists product_mix jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_product_mix_check'
  ) then
    alter table public.stores
      add constraint stores_product_mix_check
      check (
        product_mix is null
        or (jsonb_typeof(product_mix) = 'array' and jsonb_array_length(product_mix) > 0)
      );
  end if;
end
$$;

comment on column public.stores.product_mix is
  'Mix padrao da loja: NULL = todos os produtos; lista de ids de produto = so esses por padrao. Filtro de apresentacao, nao bloqueia pedido.';
