-- AJ-A5: Timeline append-only de OPs.
-- O motor já reconstrói a OP em runtime a partir do planning_key
-- (productionDate × sectorId × lineId × scheduleId). O que faltava era persistir
-- QUANDO cada transição aconteceu — base para auditoria, métricas (lead time,
-- ocupação) e futuros gatilhos automatizados.
--
-- Escolha de design: NÃO criamos uma tabela production_orders separada, pois
-- duplicaria dados que o engine já deriva. Persistimos apenas a timeline
-- indexada pelo planning_key (chave natural estável da OP).

create table if not exists public.production_order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- planning_key: chave estável da OP (productionDate|sectorId|lineId|scheduleId)
  -- O op_code (OP-AAMMDD-001) é gerado por ordem em cada render — não confiável
  -- como chave persistente — mas guardamos snapshot pra inspeção retroativa.
  planning_key text not null,
  op_code_snapshot text,
  event_type text not null,
  status_from text,
  status_to text,
  production_item_key text,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_production_order_events_tenant_planning_key_desc
on public.production_order_events (tenant_id, planning_key, created_at desc);

create index if not exists idx_production_order_events_tenant_created
on public.production_order_events (tenant_id, created_at desc);

create index if not exists idx_production_order_events_item_key
on public.production_order_events (production_item_key)
where production_item_key is not null;

alter table public.production_order_events enable row level security;

drop policy if exists production_order_events_select_factory_scope on public.production_order_events;
drop policy if exists production_order_events_insert_factory_scope on public.production_order_events;

create policy production_order_events_select_factory_scope
on public.production_order_events
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

create policy production_order_events_insert_factory_scope
on public.production_order_events
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

-- Append-only: sem políticas de update/delete por design.
