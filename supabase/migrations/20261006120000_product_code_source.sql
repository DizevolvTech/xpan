-- Qual código do CLIENTE aparece em telas e impressões: o do ERP dele (padrão) ou o GTIN.
--
-- Só apresentação: nenhum código é regravado e o produto segue identificado pelo id. Sem o
-- código escolhido (produto sem GTIN, por exemplo), a tela cai no código do ERP e, por fim, no
-- da fábrica. O código da fábrica nunca é o primeiro quando o cliente tem o dele.
--
-- Aditiva e idempotente. O default 'erp' mantém todo cliente existente exatamente como está.
alter table public.operational_settings
  add column if not exists product_code_source text not null default 'erp';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'operational_settings_product_code_source_check'
  ) then
    alter table public.operational_settings
      add constraint operational_settings_product_code_source_check
      check (product_code_source in ('erp', 'gtin'));
  end if;
end
$$;

comment on column public.operational_settings.product_code_source is
  'Codigo do cliente exibido nas telas e impressoes: erp (padrao) ou gtin. Nao altera nenhum cadastro.';
