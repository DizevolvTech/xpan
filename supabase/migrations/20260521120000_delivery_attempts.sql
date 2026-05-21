-- AJ-A3: Histórico estruturado de tentativas de entrega.
-- Antes da migração, uma falha de entrega virava apenas `delivery_executions.status='tentativa_falha'`
-- (sobrescrevendo a anterior) + um evento livre em store_order_events. Sem histórico,
-- sem motivo estruturado, sem reagendamento.

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'delivery_failure_reason'
  ) then
    create type public.delivery_failure_reason as enum (
      'cliente_ausente',
      'endereco_errado',
      'recusa_cliente',
      'estabelecimento_fechado',
      'veiculo_avaria',
      'acesso_bloqueado',
      'documentacao_pendente',
      'outro'
    );
  end if;
end
$$;

create table if not exists public.delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  failed_at timestamptz not null default timezone('utc', now()),
  failure_reason public.delivery_failure_reason not null,
  reason_notes text,
  reschedule_to date,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_delivery_attempts_order_attempt_unique
on public.delivery_attempts (order_id, attempt_number);

create index if not exists idx_delivery_attempts_tenant_failed_at
on public.delivery_attempts (tenant_id, failed_at desc);

create index if not exists idx_delivery_attempts_order_failed_at
on public.delivery_attempts (order_id, failed_at desc);

alter table public.delivery_attempts enable row level security;

drop policy if exists delivery_attempts_select_factory_scope on public.delivery_attempts;
drop policy if exists delivery_attempts_insert_factory_scope on public.delivery_attempts;
drop policy if exists delivery_attempts_update_factory_scope on public.delivery_attempts;
drop policy if exists delivery_attempts_delete_factory_scope on public.delivery_attempts;

create policy delivery_attempts_select_factory_scope
on public.delivery_attempts
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

create policy delivery_attempts_insert_factory_scope
on public.delivery_attempts
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

-- Histórico é append-only: sem update/delete por padrão. Correções devem ser
-- feitas via nova tentativa ou via flow administrativo separado.
