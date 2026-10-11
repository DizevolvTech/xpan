-- Histórico de alterações do cronograma (linha de produção).
--
-- Antes, o status da revisão era sobrescrito (pendente -> ativo -> inativo) e só ficavam o último
-- aprovador e a última nota; revisões pendentes eram apagadas ao reconstruir. Agora cada abertura,
-- ativação (automática ou manual), devolução, desativação e ajuste de prioridade vira uma linha
-- imutável: quem, quando, de qual para qual status e por quê.
--
-- Aditiva e idempotente. Nenhuma linha existente muda; revisões antigas simplesmente não têm
-- eventos. A tabela é só de acréscimo (sem update/delete pelo app).
create table if not exists public.schedule_line_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  schedule_line_id uuid not null references public.schedule_lines(id) on delete cascade,
  event_type text not null check (event_type in (
    'revisao_aberta',
    'ativado_automatico',
    'aprovado',
    'confirmado_com_ordens_em_andamento',
    'devolvido_ajuste',
    'desativado',
    'reativado',
    'prioridades_atualizadas'
  )),
  from_status text,
  to_status text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  note text,
  details jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_schedule_line_events_schedule
  on public.schedule_line_events(schedule_line_id, created_at desc);
create index if not exists idx_schedule_line_events_tenant_id
  on public.schedule_line_events(tenant_id);

alter table public.schedule_line_events enable row level security;

drop policy if exists schedule_line_events_tenant_scope on public.schedule_line_events;
create policy schedule_line_events_tenant_scope
  on public.schedule_line_events
  for all
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

comment on table public.schedule_line_events is
  'Histórico imutável do cronograma da linha: abertura, ativação (automática/manual), devolução, desativação e prioridades.';

-- Só acréscimo: sem anon e sem update/delete para usuários autenticados (o app grava via service role).
revoke all on public.schedule_line_events from anon;
revoke update, delete, truncate on public.schedule_line_events from authenticated;
