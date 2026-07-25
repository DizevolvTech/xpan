-- Item 4 (ajustes da call de 24/07): quantidade EFETIVAMENTE produzida.
--
-- Até aqui `produced_quantity` era SEMPRE uma ESTIMATIVA derivada do plano de
-- batidas (capacidade cheia × nº de batidas) contra `planned_quantity` = soma
-- das batidas. Logo `leftover_quantity` nunca podia ser negativo e o KPI
-- "Total de faltas" da tela de Sobras e Desvios ficava travado em zero. O caso
-- relatado pelo cliente — "a OP dizia 100 pães, saíram 98 porque pesaram a
-- massa crua errado" — não tinha onde ser registrado.
--
-- `reported_produced_quantity` guarda o número que o OPERADOR informou ao
-- concluir o item da OP (o campo vem pré-preenchido com a estimativa, então
-- quem não mexe mantém o comportamento anterior):
--   NOT NULL = medido no chão   → `produced_quantity` espelha esse valor
--   NULL     = não informado    → `produced_quantity` é a estimativa do plano
--
-- Com isso `leftover_quantity` passa a poder ser NEGATIVO = falta. A coluna já
-- é `numeric` sem CHECK desde 20260602130000, então nada precisa cair.
--
-- Continua REGISTRO INTERNO: nenhum consumidor no motor de planejamento. A
-- sobra/falta não realimenta plano, não deduz de pedido futuro e não gera
-- crédito para a loja — é trilha de observação do gestor.

alter table public.production_leftovers
  add column if not exists reported_produced_quantity numeric;

comment on table public.production_leftovers is
  'Registro interno de sobras e faltas por item de OP concluído. Somente rastreabilidade/relatório — não realimenta o planejamento nem compensa pedidos futuros.';

comment on column public.production_leftovers.reported_produced_quantity is
  'Quantidade informada pelo operador ao concluir o item da OP. NULL = não informada (produced_quantity é a estimativa do plano de batidas).';

-- O registro passou a ser CORRIGÍVEL: desfazer a batida e reconcluir com o número certo é
-- um caminho real da tela do chão, e o upsert virou DO UPDATE (antes era DO NOTHING, que
-- descartava a correção em silêncio). A tabela só tinha policy de select e insert — sem
-- esta, qualquer caller que não use service role falha ao regravar.
drop policy if exists production_leftovers_update_factory_scope on public.production_leftovers;
create policy production_leftovers_update_factory_scope
on public.production_leftovers
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);
