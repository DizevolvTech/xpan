-- S1: medições do teste de laboratório (ficha amarela) e flag de carga da masseira.
--
-- O usuário lança pesos do teste (massa crua, kg assados, sobra, unidades, etiqueta).
-- Quebra e rendimento passam a ser DERIVADOS — não se digitam mais.
-- `products.break_percent` continua existindo como valor derivado (legado / totais).
--
-- `counts_toward_mixer`: óleo na mesa e chocolate no fim do panetone não entram
-- no limite físico da masseira. Default true; o app aplica false nas etapas
-- cobertura/acabamento/montagem quando o campo ainda não foi gravado.

alter table public.products
  add column if not exists lab_test jsonb;

comment on column public.products.lab_test is
  'Medições do teste de laboratório (ficha amarela): rawUnitWeightKg, rawDoughKg, bakedKg, leftoverBakedKg, unitCount, labelWeightKg. Quebra/rendimento/unidade assada são derivados no app. Null = produto legado sem teste.';

alter table public.product_recipe_items
  add column if not exists counts_toward_mixer boolean not null default true;

comment on column public.product_recipe_items.counts_toward_mixer is
  'Se a linha entra na carga da masseira. False = incorporação fora do mixer (óleo na mesa, chocolate no fim). Default true.';
