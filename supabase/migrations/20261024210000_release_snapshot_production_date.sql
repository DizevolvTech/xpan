-- Reunião 22/10 (bloco 8, 36:25–38:35): "o que passou, passou" — alterar o cadastro do produto
-- (dias de produção, lead, cronograma) não pode mexer em OP já gerada. A receita já era
-- congelada na liberação; agora a DATA DE PRODUÇÃO e a ENTREGA de cada produto do pedido
-- também ficam congeladas. Nulo = pedido liberado antes desta mudança (segue o cálculo ao vivo).
alter table public.workflow_release_recipe_snapshots
  add column if not exists production_date date,
  add column if not exists delivery_date date;

comment on column public.workflow_release_recipe_snapshots.production_date is
  'Data de produção do produto do pedido no momento da liberação (congelada).';
comment on column public.workflow_release_recipe_snapshots.delivery_date is
  'Data de entrega do produto do pedido no momento da liberação (congelada).';
