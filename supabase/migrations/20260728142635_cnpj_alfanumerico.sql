-- CNPJ alfanumérico (IN RFB 2.229/2024, em produção desde julho/2026).
--
-- Adiciona identificação fiscal ao tenant (a rede dona da conta) e à loja
-- (que pode ter CNPJ próprio de filial). Ambos opcionais: as bases existentes
-- não têm o dado e não podem quebrar.
--
-- Armazenamento canônico: 14 caracteres SEM máscara, em caixa alta.
--   - posições 1-12: alfanuméricas (0-9, A-Z)
--   - posições 13-14: dígitos verificadores, sempre numéricos
-- O check valida apenas o FORMATO. O dígito verificador (módulo 11 com
-- ASCII-48) é validado na aplicação — ver src/lib/cnpj.ts.
--
-- Nunca migrar esta coluna para tipo numérico: com o formato alfanumérico o
-- CNPJ deixou de ser um número.

alter table public.tenants
  add column if not exists cnpj text;

alter table public.stores
  add column if not exists cnpj text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_cnpj_format_check'
  ) then
    alter table public.tenants
      add constraint tenants_cnpj_format_check
      check (cnpj is null or cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'stores_cnpj_format_check'
  ) then
    alter table public.stores
      add constraint stores_cnpj_format_check
      check (cnpj is null or cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$');
  end if;
end
$$;

-- Um mesmo CNPJ não pode identificar duas lojas dentro do mesmo tenant.
create unique index if not exists idx_stores_tenant_cnpj
on public.stores (tenant_id, cnpj)
where cnpj is not null;

create index if not exists idx_tenants_cnpj
on public.tenants (cnpj)
where cnpj is not null;
