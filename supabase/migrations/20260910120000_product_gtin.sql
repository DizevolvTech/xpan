-- Call 02/09: Chama imprime etiqueta com GTIN (dígito verificador).
-- Código interno / código da loja não carregam DV — o GTIN é campo próprio.

alter table public.products
  add column if not exists gtin text;

comment on column public.products.gtin is
  'GTIN/EAN da etiqueta (8, 12, 13 ou 14 dígitos). Opcional; independente do código da loja.';
