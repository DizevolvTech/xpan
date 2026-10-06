-- Versões do produto: guarda o cadastro INTEIRO (receita, teste de laboratório, etapas, unidades,
-- dias de produção...) no momento de cada versão, para a tela poder restaurar uma versão antiga.
--
-- Restaurar nunca apaga nem reescreve o histórico: a versão antiga é carregada no formulário e,
-- ao salvar, vira uma NOVA versão. Por isso a coluna é só leitura depois de gravada.
--
-- Aditiva e idempotente. Linhas antigas ficam com null (não restauráveis) e nada mais muda.
alter table public.product_changelog
  add column if not exists product_snapshot jsonb;

comment on column public.product_changelog.product_snapshot is
  'Cadastro do produto (sem codigo/GTIN/ativo) como estava nesta versao; usado para restaurar. Null = versao sem foto.';
