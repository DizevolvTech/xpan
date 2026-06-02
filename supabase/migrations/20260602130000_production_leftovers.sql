-- 2.3-B: Registro de sobras e ajustes para futuros pedidos.
-- DECISÃO DO PRODUCT OWNER: REGISTRAR + RELATAR APENAS. Esta tabela apenas
-- registra a sobra/falta de cada item de produção CONCLUÍDO e a expõe num
-- relatório. NÃO realimenta o motor de planejamento nem deduz de pedidos
-- futuros — é uma trilha de observação para o gestor.
--
-- Escolha de design: registramos um snapshot por item de OP no momento em que
-- ele atinge `concluido`. A chave natural é a mesma usada pelo engine
-- (production_item_key — chave canônica de 3 partes data|linha|produto),
-- garantindo idempotência (índice único por tenant + chave).
--
-- leftover_quantity = produced_quantity - planned_quantity
--   positivo = sobra (produziu a mais que o planejado)
--   negativo = falta (produziu a menos que o planejado)

create table if not exists public.production_leftovers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- production_item_key: chave canônica estável do item (productionDate|lineId|productId)
  planning_key text not null,
  product_id text not null,
  production_date date not null,
  planned_quantity numeric not null default 0,
  produced_quantity numeric not null default 0,
  -- produced - planned (positivo = sobra, negativo = falta)
  leftover_quantity numeric not null default 0,
  unit text not null default 'Kg',
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default timezone('utc', now())
);

-- Idempotência: um único registro de sobra por item de OP concluído (por tenant).
create unique index if not exists idx_production_leftovers_tenant_planning_key
on public.production_leftovers (tenant_id, planning_key);

create index if not exists idx_production_leftovers_tenant_date_desc
on public.production_leftovers (tenant_id, production_date desc);

create index if not exists idx_production_leftovers_tenant_recorded
on public.production_leftovers (tenant_id, recorded_at desc);

alter table public.production_leftovers enable row level security;

drop policy if exists production_leftovers_select_factory_scope on public.production_leftovers;
drop policy if exists production_leftovers_insert_factory_scope on public.production_leftovers;

create policy production_leftovers_select_factory_scope
on public.production_leftovers
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

create policy production_leftovers_insert_factory_scope
on public.production_leftovers
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.current_user_role() in (
    'administrador'::public.user_role,
    'gestor-fabrica'::public.user_role,
    'chao-fabrica'::public.user_role
  )
);

-- Append-only por design: sem políticas de update/delete.
