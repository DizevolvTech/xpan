-- Unidade de peso com que a Ordem de Produção é VISTA e IMPRESSA (kg ou g), por cliente.
--
-- Só apresentação: ingredientes, receitas e produtos continuam em Kg no banco e a conversão
-- kg -> g é feita na hora de montar a tela/folha (src/lib/weight-display.ts). Nada é regravado.
--
-- Aditiva e idempotente. O default 'kg' mantém todo cliente existente exatamente como está.
alter table public.operational_settings
  add column if not exists op_weight_unit text not null default 'kg';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'operational_settings_op_weight_unit_check'
  ) then
    alter table public.operational_settings
      add constraint operational_settings_op_weight_unit_check
      check (op_weight_unit in ('kg', 'g'));
  end if;
end
$$;

comment on column public.operational_settings.op_weight_unit is
  'Unidade de exibicao/impressao das quantidades de peso da OP: kg (padrao) ou g. Nao altera o cadastro, que segue em Kg.';
