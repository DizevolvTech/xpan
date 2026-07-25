-- Gestão de receita por ETAPA (call 24/07, ponto do Adriano).
--
-- A coluna `product_recipe_items.stage` (migration 20260724191500) disse QUAL a função de cada
-- ingrediente. Faltavam as duas outras coisas que ele descreveu ao mostrar a ficha da cuca:
--
--  1. SEQUENCIAMENTO — a ordem das etapas era fixa pelo enum. Uma cuca monta massa → recheio →
--     montagem; um pão com esponja começa pela esponja. Quem define é a ficha, não o sistema.
--  2. MODO DE PREPARO POR ETAPA — `products.preparation_mode` é um texto único do produto
--     inteiro. O padeiro precisa da instrução DAQUELE bloco junto dos ingredientes dele.
--
-- As duas coisas moram na mesma estrutura porque são a mesma decisão editorial da ficha: um
-- ARRAY ORDENADO de etapas, cada uma com suas instruções.
--
--   [{"stage": "esponja",  "instructions": "Misturar e fermentar 12h."},
--    {"stage": "massa",    "instructions": "Juntar a esponja e sovar 8 min."},
--    {"stage": "montagem", "instructions": "Rechear e finalizar com farofa."}]
--
-- Array vazio (default) = ordem canônica do enum e sem instrução por etapa, que é exatamente o
-- comportamento de hoje. Etapa ausente do array entra depois das configuradas, na ordem do enum
-- — assim adicionar um ingrediente numa etapa nova nunca some da tela.
--
-- `products.preparation_mode` CONTINUA existindo e não muda de significado: é a instrução geral
-- do produto. O que entra aqui é a instrução de cada bloco.

alter table public.products
  add column if not exists recipe_stage_config jsonb not null default '[]'::jsonb;

comment on column public.products.recipe_stage_config is
  'Array ORDENADO de etapas da receita, cada item {stage, instructions}. A ordem do array é a sequência de preparo da ficha; instructions é o modo de preparo daquele bloco. Vazio = ordem canônica do enum e sem instrução por etapa. Não substitui preparation_mode, que segue sendo a instrução geral do produto.';
